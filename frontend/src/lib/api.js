const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export async function analyzeDemo() {
  const r = await fetch(`${API}/api/analyze/demo`, {method:'POST'});
  if (!r.ok) throw new Error('Could not analyze demo reviews');
  return r.json();
}
export async function analyzeUrl(url) {
  const r = await fetch(`${API}/api/analyze/url`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || 'Could not analyze this URL');
  return data;
}
export async function analyzeCsv(file) {
  const fd = new FormData(); fd.append('file', file);
  const r = await fetch(`${API}/api/analyze/csv`, {method:'POST',body:fd});
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || 'Could not analyze CSV');
  return data;
}
