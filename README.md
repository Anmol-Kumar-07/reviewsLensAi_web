# ReviewLens AI — Product Review Intelligence Website

A modern React website with a FastAPI backend for review sentiment analysis, themes, charts, CSV upload and report export.

## What's included
- React + Vite + Tailwind responsive dashboard
- FastAPI backend with CSV review analysis
- Sentiment labels, keyword-based theme detection, sentiment charts and review explorer
- Amazon live review integration via SerpApi (requires your own API key)
- Flipkart URL validation; review retrieval requires a permitted provider with customer-review access
- Built-in sample dataset for testing the UI
- Windows helper: `run_windows.bat`

## Run on Windows
1. Extract the ZIP.
2. Install Node.js LTS and Python 3.11+ if they are not installed.
3. Double-click `run_windows.bat`, or run commands manually.

### Manual run
Terminal 1:
```powershell
cd backend
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```
Terminal 2:
```powershell
cd frontend
npm install
npm run dev
```
Open the local URL Vite prints, usually `http://localhost:5173`.

## Enable Amazon live reviews
1. Create a SerpApi account and copy your API key from https://serpapi.com/manage-api-key.
2. Open `backend/.env` and set:
   `SERPAPI_API_KEY=your_actual_key`
3. Restart the backend server.
4. Paste a full Amazon product URL or supported Amazon short link and click **Analyze link**.

The app uses SerpApi's Amazon Product endpoint and its `reviews_information.authors_reviews` when available. Provider coverage, limits and pricing depend on your SerpApi account. Keep your API key only in `backend/.env`; never paste it into React code or commit it to GitHub.

## Flipkart support
The app recognizes Flipkart links but does not scrape the site directly. The official public developer documentation is focused on seller/affiliate product and seller workflows; a general public customer-review endpoint is not documented for this use case. To analyze Flipkart products live, connect a provider that explicitly permits access to customer review text. Until then, upload a CSV containing reviews.

## CSV format
At minimum, include a text column named `review_text`, `review`, `reviews`, `content`, `text`, or `customer_review`. Optional columns: `rating`, `category` or `product_category`.

Example:
```csv
review_text,rating,product_category
"Great quality and easy to use",5,Electronics
"Stopped working after a week",1,Electronics
```

## API health
With the backend running, visit `http://localhost:8000/api/health`.

## Deployment
- Frontend: Vercel or Netlify. Set `VITE_API_URL` to your deployed API origin.
- Backend: Render/Railway/any Python ASGI host. Build/install `backend/requirements.txt`; start command:
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Add `SERPAPI_API_KEY` as a backend environment variable on the host.
- Update CORS allowed origins in `backend/app/main.py` to include your frontend domain before production.
- Never commit `.env` or credentials.

## Limitations
- The baseline sentiment model is lightweight lexicon-based analysis, not a trained transformer/LLM.
- Sample demo results are illustrative and do not correspond to the pasted product URL.
- Live Amazon data depends on SerpApi account and provider response.
- Live Flipkart reviews need a separate permitted provider.
