from app.main import parse_url, sentiment, analyze, SAMPLE

def test_amazon_url():
    assert parse_url("https://www.amazon.in/dp/B0ABCDE123")["marketplace"] == "Amazon"

def test_flipkart_short_domain_recognized():
    assert parse_url("https://dl.flipkart.com/s/example")["marketplace"] == "Flipkart"

def test_sentiment_output():
    assert sentiment("Amazing quality, I love it")[1] == "Positive"
    assert sentiment("Terrible and broken")[1] == "Negative"

def test_analysis_counts():
    rows=[{"review_text":t,"rating":r,"product_category":c} for t,r,c in SAMPLE]
    out=analyze(rows,"demo","demo",True)
    assert out["summary"]["total"] > 0
    assert sum(x["count"] for x in out["sentiment_distribution"]) == out["summary"]["total"]
