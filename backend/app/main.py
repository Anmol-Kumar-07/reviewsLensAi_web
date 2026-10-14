from __future__ import annotations
import io, re, os
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from typing import Optional
import pandas as pd
import requests
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

# Load simple KEY=value entries from backend/.env for local development.
_env_file = Path(__file__).resolve().parents[1] / ".env"
if _env_file.exists():
    for _line in _env_file.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _key, _value = _line.split("=", 1)
            os.environ.setdefault(_key.strip(), _value.strip().strip('"').strip("'"))

app = FastAPI(title="ReviewLens AI API", version="1.0.0", description="Customer review analysis API")
# Set FRONTEND_ORIGINS on the hosting provider, comma-separated, e.g.
# https://your-site.vercel.app,https://your-custom-domain.com
_origins = os.getenv("FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
_allowed_origins = [origin.strip().rstrip("/") for origin in _origins.split(",") if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=_allowed_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

SAMPLE = [
("Great quality and very comfortable. Excellent value for money.",5,"Clothing"),
("Love the design and soft material. Fits perfectly.",5,"Clothing"),
("Good product, looks nice and feels sturdy.",4,"Clothing"),
("Comfortable fit and beautiful color. I recommend it.",5,"Clothing"),
("Very good quality and fast delivery.",5,"Clothing"),
("Material feels cheap and the stitching is poor.",2,"Clothing"),
("Disappointed with the quality. It was damaged on arrival.",1,"Clothing"),
("Not comfortable and the size is too small.",2,"Clothing"),
("Delivery was late and customer service was unhelpful.",2,"Clothing"),
("Average product. It looks fine but the fit is not great.",3,"Clothing"),
("Nice design, good price and comfortable to wear.",4,"Clothing"),
("Works well and feels durable after several uses.",5,"Clothing"),
("Poor quality for the price. I returned it.",1,"Clothing"),
("Soft fabric and great fit, I am happy with this purchase.",5,"Clothing"),
("Not worth the money. The material feels weak.",2,"Clothing"),
("Okay overall, neither great nor terrible.",3,"Clothing"),
("Excellent product and quality is amazing.",5,"Clothing"),
("Color was different from the photo and package was damaged.",2,"Clothing"),
("Comfortable, lightweight and easy to use.",4,"Clothing"),
("Bad stitching and disappointing fit.",1,"Clothing"),
]
POS={"amazing","awesome","best","beautiful","comfortable","easy","excellent","fast","good","great","happy","love","loved","perfect","recommend","satisfied","soft","sturdy","useful","value","wonderful","well","nice","durable","quality","lightweight","fits","fit"}
NEG={"awful","bad","broken","cheap","complaint","damaged","delay","disappointed","disappointing","poor","problem","return","slow","terrible","uncomfortable","waste","worst","defective","issue","issues","small","large","scratch","missing","late","weak","fail","failed","expensive"}
NEGATIONS={"not","never","no","hardly","isn't","wasn't","don't","didn't","doesn't"}
ASPECTS={
"battery life":["battery","backup","charging","charge"],
"quality and durability":["quality","durable","broken","defective","damage","sturdy","material","stitching"],
"comfort and fit":["comfortable","comfort","fit","size","tight","loose","soft"],
"delivery and packaging":["delivery","delivered","shipping","package","packaging","late","delay"],
"price and value":["price","value","money","expensive","cheap","cost","worth"],
"performance":["performance","works","working","speed","slow","power","sound"],
"customer service":["service","support","return","refund","replacement","seller"],
"appearance and design":["design","look","color","colour","beautiful","appearance"],
}

class URLRequest(BaseModel):
    url: str

def parse_url(url: str):
    value=url.strip()
    if not re.match(r"^https?://",value,re.I): value="https://"+value
    p=urlparse(value); host=(p.hostname or "").lower()
    # Amazon product pages and recognized Amazon short-link domains.
    # Short links are recognized as Amazon URLs, but resolving/fetching reviews
    # requires an authorized provider and is intentionally not done here.
    if host in {"amazon.in","www.amazon.in","amazon.com","www.amazon.com","amazon.co.uk","www.amazon.co.uk","amazon.ca","www.amazon.ca","amzn.in","www.amzn.in","amzn.to"}:
        # amzn.in/amzn.to /d/ tokens are redirect codes, not ASINs; resolve them first.
        if host in {"amzn.in","www.amzn.in","amzn.to"}:
            product_id = None
        else:
            m=re.search(r"/(?:dp|gp/product)/([A-Z0-9]{8,14})",p.path,re.I)
            product_id = m.group(1) if m else None
        return {"valid":True,"marketplace":"Amazon","product_id":product_id,"url":value}
    if host in {"flipkart.com","www.flipkart.com","dl.flipkart.com"}:
        pid=parse_qs(p.query).get("pid",[None])[0]
        return {"valid":True,"marketplace":"Flipkart","product_id":pid,"url":value}
    return {"valid":False,"marketplace":None,"product_id":None}

def sentiment(text):
    tokens=re.findall(r"[a-z']+",str(text).lower())
    score=0
    for i,t in enumerate(tokens):
        weight=-1 if i>0 and tokens[i-1] in NEGATIONS else 1
        if t in POS: score+=weight
        elif t in NEG: score-=weight
    s=max(-1.0,min(1.0,score/max(3.0,len(tokens)**0.45))) if tokens else 0.0
    label="Positive" if s>=.12 else "Negative" if s<=-.12 else "Neutral"
    return round(s,4),label

def analyze(rows, source_label, product_name, demo=False):
    cleaned=[]
    seen=set()
    for row in rows:
        text=str(row.get("review_text",row.get("Review Text",row.get("review",row.get("content",row.get("text",""))))) or "").strip()
        text=re.sub(r"\s+"," ",text)
        if not text or text.lower() in seen: continue
        seen.add(text.lower())
        try: rating=float(row.get("rating",row.get("Rating",row.get("score"))))
        except (TypeError,ValueError): rating=None
        if rating is not None and not 1<=rating<=5: rating=None
        category=str(row.get("product_category",row.get("Department Name",row.get("category","Unspecified"))) or "Unspecified")
        score,label=sentiment(text)
        cleaned.append({"review_text":text,"rating":rating,"product_category":category,"sentiment_score":score,"sentiment":label})
    if not cleaned: raise HTTPException(status_code=400,detail="No usable review text found. Include a review text column.")
    counts={s:sum(1 for r in cleaned if r["sentiment"]==s) for s in ["Positive","Neutral","Negative"]}
    total=len(cleaned)
    dist=[{"sentiment":s,"count":counts[s],"pct":round(counts[s]/total*100,1)} for s in ["Positive","Neutral","Negative"]]
    ratings=[r["rating"] for r in cleaned if r["rating"] is not None]
    pos=[r for r in cleaned if r["sentiment"]=="Positive"]
    neg=[r for r in cleaned if r["sentiment"]=="Negative"]
    def themes(subset):
        out=[]
        for aspect,words in ASPECTS.items():
            n=sum(1 for r in subset if any(re.search(r"\b"+re.escape(w)+r"\b",r["review_text"].lower()) for w in words))
            if n: out.append({"theme":aspect,"count":n})
        return sorted(out,key=lambda x:x["count"],reverse=True)
    pp=counts["Positive"]/total*100; npct=counts["Negative"]/total*100
    if pp>=65 and npct<20: headline="Overall impression: Mostly positive"; explanation="Most analyzed reviews express positive sentiment. Check recurring concerns before deciding."
    elif npct>=35: headline="Overall impression: Mixed to negative"; explanation="A substantial share of analyzed reviews is negative. Investigate the most frequent concerns carefully."
    elif pp>npct+10: headline="Overall impression: Generally positive, with some concerns"; explanation="Positive sentiment exceeds negative sentiment, but review quality and coverage still matter."
    elif npct>pp: headline="Overall impression: Cautious"; explanation="Negative sentiment is more common in this dataset. Review individual comments before deciding."
    else: headline="Overall impression: Mixed feedback"; explanation="The reviews show a mixed picture. Sentiment alone cannot determine whether the product is right for you."
    return {"product_name":product_name,"source_label":source_label,"demo_mode":demo,
            "summary":{"total":total,"positive_pct":round(pp,1),"neutral_pct":round(counts["Neutral"]/total*100,1),"negative_pct":round(npct,1),"average_rating":round(sum(ratings)/len(ratings),2) if ratings else None},
            "sentiment_distribution":dist,"verdict":{"headline":headline,"explanation":explanation},
            "positive_themes":themes(pos),"negative_themes":themes(neg),"reviews":cleaned}

@app.get("/api/health")
def health(): return {"status":"ok","service":"ReviewLens AI API"}

@app.post("/api/analyze/demo")
def analyze_demo():
    rows=[{"review_text":t,"rating":r,"product_category":c} for t,r,c in SAMPLE]
    return analyze(rows,"Illustrative built-in demo data","Demo product — sample reviews",True)

def resolve_amazon_product(url: str, parsed: dict):
    """Resolve supported Amazon short links while refusing redirects off Amazon domains."""
    product_id = parsed.get("product_id")
    final_url = url
    if not product_id:
        try:
            response = requests.get(url, timeout=12, allow_redirects=True,
                                    headers={"User-Agent":"Mozilla/5.0 ReviewLensAI/1.0"})
            final_url = response.url
            final_host = (urlparse(final_url).hostname or "").lower()
            if final_host not in {"amazon.in","www.amazon.in","amazon.com","www.amazon.com",
                                  "amazon.co.uk","www.amazon.co.uk","amazon.ca","www.amazon.ca"}:
                raise HTTPException(status_code=400, detail="This short link did not resolve to a supported Amazon product page. Paste the full Amazon product URL.")
            m = re.search(r"/(?:dp|gp/product)/([A-Z0-9]{8,14})", urlparse(final_url).path, re.I)
            product_id = m.group(1) if m else None
        except HTTPException:
            raise
        except requests.RequestException:
            raise HTTPException(status_code=400, detail="Could not resolve this Amazon short link. Open the link in your browser and paste the full product URL.")
    if not product_id:
        raise HTTPException(status_code=400, detail="Could not find an Amazon product ID in this link. Paste the full product page URL.")
    host = (urlparse(final_url).hostname or "").lower()
    amazon_domain = "amazon.in" if host.endswith("amazon.in") or "amzn.in" in url else (
        "amazon.co.uk" if host.endswith("amazon.co.uk") else (
        "amazon.ca" if host.endswith("amazon.ca") else "amazon.com"))
    return product_id, amazon_domain

def analyze_amazon_via_serpapi(url: str, parsed: dict):
    api_key = os.getenv("SERPAPI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="Amazon link recognized, but live analysis needs a SerpApi API key. Add SERPAPI_API_KEY to backend/.env, then restart the backend. CSV and sample demo work without a key.")
    asin, amazon_domain = resolve_amazon_product(url, parsed)
    try:
        response = requests.get("https://serpapi.com/search.json", params={
            "engine":"amazon_product", "asin":asin, "amazon_domain":amazon_domain,
            "api_key":api_key
        }, timeout=30)
        payload = response.json()
    except (requests.RequestException, ValueError):
        raise HTTPException(status_code=502, detail="Could not reach the review provider. Check your connection and try again.")
    if response.status_code != 200 or payload.get("error"):
        raise HTTPException(status_code=502, detail="Review provider error: " + str(payload.get("error", "request failed")))
    reviews_info = payload.get("reviews_information") or {}
    authors_reviews = reviews_info.get("authors_reviews") or []
    rows = []
    for item in authors_reviews:
        text = item.get("text") or item.get("title") or ""
        if text.strip():
            rows.append({"review_text":text, "rating":item.get("rating"), "product_category":"Amazon review"})
    if not rows:
        # Do not misrepresent an aggregate summary as individual review data.
        summary_text = (reviews_info.get("summary") or {}).get("text")
        if summary_text:
            rows = [{"review_text":summary_text, "rating":None, "product_category":"Provider review summary"}]
    if not rows:
        raise HTTPException(status_code=404, detail="The provider returned no review text for this product. Try another product URL or upload a review CSV.")
    product_results = payload.get("product_results") or {}
    title = product_results.get("title") or payload.get("product_title") or f"Amazon product {asin}"
    image_url = product_results.get("thumbnail") or product_results.get("main_image") or product_results.get("image")
    price_value = product_results.get("price")
    if isinstance(price_value, dict):
        price_value = price_value.get("value") or price_value.get("raw") or price_value.get("symbol")
    product_url = product_results.get("link") or f"https://{amazon_domain}/dp/{asin}"
    result = analyze(rows, "Amazon via SerpApi", title, False)
    result["product"] = {
        "title": title,
        "image_url": image_url,
        "price": str(price_value) if price_value is not None else None,
        "rating": product_results.get("rating"),
        "review_count": product_results.get("reviews") or product_results.get("reviews_count"),
        "url": product_url,
        "marketplace": "Amazon",
        "asin": asin,
    }
    result["provider_note"] = "Review text retrieved through the configured third-party provider. Coverage depends on provider availability."
    return result

@app.post("/api/analyze/url")
def analyze_url(req: URLRequest):
    parsed=parse_url(req.url)
    if not parsed["valid"]:
        raise HTTPException(status_code=400,detail="Unsupported domain. Use an Amazon or Flipkart product URL.")
    if parsed["marketplace"] == "Amazon":
        return analyze_amazon_via_serpapi(req.url.strip(), parsed)
    raise HTTPException(status_code=501,detail="Flipkart link recognized, but a permitted provider with review-text access is not configured. Upload a CSV of reviews for now. The official Flipkart APIs primarily document seller/product workflows; they do not provide a general public customer-review endpoint for this app.")

@app.post("/api/analyze/csv")
async def analyze_csv(file: UploadFile=File(...)):
    if not file.filename.lower().endswith(".csv"): raise HTTPException(status_code=400,detail="Please upload a CSV file.")
    try:
        content=await file.read()
        df=pd.read_csv(io.BytesIO(content))
    except Exception as exc: raise HTTPException(status_code=400,detail=f"Could not read CSV: {exc}")
    cols={re.sub(r"[\s\-]+","_",str(c).strip().lower()):c for c in df.columns}
    review_col=next((cols[k] for k in ["review_text","review","reviews","content","text","customer_review"] if k in cols),None)
    if review_col is None: raise HTTPException(status_code=400,detail="Could not find a review text column (e.g. Review Text, review, content, text).")
    rating_col=next((cols[k] for k in ["rating","ratings","star_rating","score","review_rating"] if k in cols),None)
    category_col=next((cols[k] for k in ["product_category","department_name","department","category"] if k in cols),None)
    rows=[]
    for _,r in df.head(5000).iterrows():
        rows.append({"review_text":r.get(review_col),"rating":r.get(rating_col) if rating_col else None,"product_category":r.get(category_col) if category_col else "Unspecified"})
    return analyze(rows,f"Uploaded CSV: {file.filename}",file.filename.rsplit(".",1)[0],False)
