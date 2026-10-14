import React, {useState} from 'react';
import { Activity, ArrowUpRight, BadgeCheck, BarChart3, BrainCircuit, Check, ChevronDown, CircleHelp, Download, ExternalLink, FileText, Link2, LoaderCircle, MessageSquareText, Package, ShieldCheck, Sparkles, Star, ThumbsDown, ThumbsUp, UploadCloud, WandSparkles, Zap } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { analyzeCsv, analyzeDemo, analyzeUrl } from './lib/api';

const COLORS = ['#52d6a4','#9ca9c7','#ff7188'];
function App(){
 const [url,setUrl]=useState('');
 const [file,setFile]=useState(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [data,setData]=useState(null);
 const [tab,setTab]=useState('overview');
 const [search,setSearch]=useState('');
 const [sentimentFilter,setSentimentFilter]=useState('All');
 const [exportStatus,setExportStatus]=useState('');
 async function run(mode){
  setLoading(true);setError('');setExportStatus('');
  try{
   let result;
   if(mode==='csv' && file) result=await analyzeCsv(file);
   else if(mode==='url') result=await analyzeUrl(url);
   else result=await analyzeDemo();
   setData(result);setTab('overview');
  }catch(e){setError(e.message || 'Something went wrong.');}
  finally{setLoading(false);}
 }
 function downloadCsv(){
  if(!data?.reviews?.length){setExportStatus('No review rows are available to export.');return;}
  // Fixed, human-readable column order for Excel and Power BI.
  const columns=[
   ['Review ID',(_,i)=>i+1],
   ['Review Text',r=>r.review_text],
   ['Sentiment',r=>r.sentiment],
   ['Sentiment Score',r=>r.sentiment_score],
   ['Customer Rating (out of 5)',r=>r.rating],
   ['Product Category',r=>r.product_category],
   ['Data Source',()=>data.source_label||'Review dataset'],
   ['Dataset Type',()=>data.demo_mode?'Illustrative demo':'Analyzed reviews']
  ];
  const safeCell=value=>{
   let text=String(value??'');
   // Avoid spreadsheet formula execution from untrusted review text.
   if(/^[\s]*[=+@]/.test(text) || /^[\s]*-[^0-9.]/.test(text)) text="'"+text;
   return '"'+text.replaceAll('"','""')+'"';
  };
  const csv=[columns.map(([label])=>safeCell(label)).join(','),...data.reviews.map((review,index)=>columns.map(([,getValue])=>safeCell(getValue(review,index))).join(','))].join('\r\n');
  // UTF-8 BOM keeps Hindi and other non-English text readable in Excel.
  const blob=new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8;'});
  const objectUrl=URL.createObjectURL(blob);
  const link=document.createElement('a');
  const slug=(data.product_name||'reviewlens-analysis').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55)||'reviewlens-analysis';
  link.href=objectUrl;link.download=`${slug}-reviews-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
  setExportStatus(`Exported ${data.reviews.length.toLocaleString()} reviews · CSV ready for Excel and Power BI.`);
 }
 const stats=data?.summary;
 const filtered=(data?.reviews||[]).filter(r=>(sentimentFilter==='All'||r.sentiment===sentimentFilter)&&String(r.review_text||'').toLowerCase().includes(search.toLowerCase()));
 return <div className="app-shell">
  <aside className="sidebar">
   <div className="brand"><div className="brand-mark"><BrainCircuit size={22}/></div><div><b>reviewlens<span>.ai</span></b><small>PRODUCT INTELLIGENCE</small></div></div>
   <div className="side-label">WORKSPACE</div>
   <button className={`nav-item ${!data?'active':''}`} onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}><BarChart3 size={17}/> Review analyzer</button>
   <button className="nav-item" onClick={()=>setTab('reviews')}><MessageSquareText size={17}/> Review explorer</button>
   <button className="nav-item" onClick={()=>setTab('insights')}><WandSparkles size={17}/> AI insights <span className="new-pill">AI</span></button>
   <div className="sidebar-bottom"><div className="secure-icon"><ShieldCheck size={17}/></div><b>Your data, handled carefully</b><p>Review text is analyzed for this session. Never upload personal or sensitive information.</p><div className="version">REVIEWLENS · WEB EDITION 1.0</div></div>
  </aside>
  <main className="main">
   <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>Review analyzer</b></div><div className="top-right"><span className="status-dot"></span> Analysis engine <span className="engine-badge">READY</span><div className="avatar">RL</div></div></header>
   <section className="hero">
    <div className="hero-glow"></div><div className="hero-copy"><div className="eyebrow"><Sparkles size={14}/> CUSTOMER REVIEW INTELLIGENCE</div><h1>Know what customers<br/><span>really think.</span></h1><p>Turn thousands of opinions into a clear product verdict.<br/>Less scrolling. More confident decisions.</p><div className="hero-tags"><span><Check size={13}/> Sentiment analysis</span><span><Check size={13}/> Pain-point detection</span><span><Check size={13}/> Evidence-led insights</span></div></div>
    <div className="hero-art"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="brain-orb"><BrainCircuit size={70} strokeWidth={1.2}/><Sparkles className="orb-spark" size={23}/></div><div className="float-card float-positive"><span className="mini-dot green"></span><div><small>Positive sentiment</small><b>Customer love</b></div><ThumbsUp size={18}/></div><div className="float-card float-negative"><span className="mini-dot pink"></span><div><small>Negative signals</small><b>Issues detected</b></div><Activity size={18}/></div></div>
   </section>
   <section className="input-panel"><div className="section-heading"><div><span className="step">01</span><h2>Analyze a product</h2></div><span className="helper"><CircleHelp size={14}/> Works with supported sources</span></div>
    <label className="field-label">Product page URL <span>AMAZON / FLIPKART</span></label>
    <div className="url-row"><div className="url-input"><Link2 size={19}/><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Paste an Amazon or Flipkart product link…"/></div><button className="primary-btn" onClick={()=>run('url')} disabled={loading||!url.trim()}>{loading?<LoaderCircle className="spin" size={17}/>:<Sparkles size={17}/>} Analyze link <ArrowUpRight size={16}/></button></div>
    <div className="or-divider"><span>OR USE REVIEW DATA</span></div>
    <div className="data-options"><label className={`upload-zone ${file?'file-ready':''}`}><input type="file" accept=".csv,text/csv" onChange={e=>setFile(e.target.files?.[0]||null)}/><div className="upload-icon"><UploadCloud size={22}/></div><div><b>{file?file.name:'Upload customer reviews'}</b><p>{file?'Ready to analyze · CSV file':'Drop a CSV here or browse files'}</p></div>{file&&<BadgeCheck className="file-check" size={19}/>}</label><button className="demo-btn" onClick={()=>run('demo')} disabled={loading}><Zap size={17}/> Preview with sample data <span>→</span></button></div>
    <div className="privacy-note"><ShieldCheck size={14}/> Amazon live review analysis needs a SerpApi key in backend/.env. Flipkart review fetching needs a permitted provider. Sample data is only for preview.</div>
    {error&&<div className="error-box">{error}</div>}
    {file&&<button className="text-action" onClick={()=>run('csv')} disabled={loading}>{loading?'Analyzing…':'Analyze uploaded CSV →'}</button>}
   </section>
   {!data?<section className="empty-grid"><div className="empty-card large"><div className="card-icon violet"><BarChart3 size={20}/></div><h3>From raw reviews to real clarity</h3><p>Sentiment, common themes, customer pain points and a balanced verdict — all in one place.</p><div className="preview-bars"><i style={{height:'35%'}}/><i style={{height:'62%'}}/><i style={{height:'49%'}}/><i style={{height:'85%'}}/><i style={{height:'68%'}}/><i style={{height:'100%'}}/><i style={{height:'76%'}}/><i style={{height:'91%'}}/></div></div><div className="empty-card"><div className="card-icon green-bg"><ThumbsUp size={20}/></div><h3>What people love</h3><p>Spot the strengths customers mention most often.</p><div className="fake-chip-row"><span>Quality</span><span>Value</span><span>Comfort</span></div></div><div className="empty-card"><div className="card-icon pink-bg"><ThumbsDown size={20}/></div><h3>What needs attention</h3><p>Surface recurring complaints before they get missed.</p><div className="fake-chip-row"><span>Durability</span><span>Delivery</span></div></div></section>:
   <section className="results">
    <div className="results-heading"><div><div className="eyebrow dark"><span className="status-dot"></span> ANALYSIS COMPLETE</div><h2>{data.product_name||'Product review report'}</h2><p>{data.source_label||'Review dataset'} · {stats.total} reviews analyzed</p></div><div className="export-wrap"><button className="outline-btn" onClick={downloadCsv} disabled={!data.reviews?.length}><Download size={16}/> Export CSV <span className="export-count">{data.reviews.length}</span></button><small>Excel / Power BI ready</small>{exportStatus&&<p className="export-status" role="status">{exportStatus}</p>}</div></div>
    {data.demo_mode&&<div className="notice"><CircleHelp size={17}/><span><b>Demo dataset:</b> these illustrative results are not based on the product URL entered.</span></div>}
    {data.product&&<section className="product-preview" aria-label="Analyzed product details">
      <div className="product-image-wrap">{data.product.image_url?<img src={data.product.image_url} alt={data.product.title} onError={e=>{e.currentTarget.style.display='none';e.currentTarget.nextElementSibling.style.display='grid';}}/>:null}<div className="product-image-fallback" style={{display:data.product.image_url?'none':'grid'}}><Package size={30}/><span>Product image</span></div></div>
      <div className="product-details"><span className="product-kicker">PRODUCT YOU SHARED · {data.product.marketplace||'PRODUCT'}</span><h3>{data.product.title}</h3><div className="product-meta">{data.product.price&&<b className="product-price">{data.product.price}</b>}{data.product.rating&&<span><Star size={14} fill="currentColor"/> {data.product.rating}</span>}{data.product.review_count&&<span>{Number(data.product.review_count).toLocaleString()} reviews on listing</span>}</div><p>Review analysis below is associated with this product listing.</p></div>
      {data.product.url&&<a className="product-link-btn" href={data.product.url} target="_blank" rel="noreferrer">View product <ExternalLink size={15}/></a>}
    </section>}
    <div className="kpi-grid"><div className="kpi"><span>Total reviews</span><b>{stats.total.toLocaleString()}</b><small><MessageSquareText size={13}/> Reviews processed</small></div><div className="kpi"><span>Positive sentiment</span><b className="green-text">{stats.positive_pct}%</b><small><ThumbsUp size={13}/> Favorable signals</small></div><div className="kpi"><span>Negative sentiment</span><b className="pink-text">{stats.negative_pct}%</b><small><ThumbsDown size={13}/> Concerns detected</small></div><div className="kpi"><span>Average rating</span><b>{stats.average_rating??'—'}<small className="out-of"> / 5</small></b><small><Star size={13}/> {stats.average_rating==null?'No rating data':'Customer star rating'}</small></div></div>
    <div className="tabs"><button className={tab==='overview'?'selected':''} onClick={()=>setTab('overview')}>Overview</button><button className={tab==='insights'?'selected':''} onClick={()=>setTab('insights')}>AI insights</button><button className={tab==='reviews'?'selected':''} onClick={()=>setTab('reviews')}>Review explorer <span>{data.reviews.length}</span></button></div>
    {tab==='overview'&&<div className="chart-grid"><div className="chart-card"><div className="chart-title"><div><h3>Sentiment breakdown</h3><p>Distribution across analyzed reviews</p></div><span className="chart-tag">NLP</span></div><div className="chart-body"><ResponsiveContainer width="100%" height={245}><PieChart><Pie data={data.sentiment_distribution} dataKey="count" nameKey="sentiment" innerRadius={68} outerRadius={94} paddingAngle={4}>{data.sentiment_distribution.map((e,i)=><Cell key={e.sentiment} fill={COLORS[i]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="legend">{data.sentiment_distribution.map((e,i)=><div key={e.sentiment}><i style={{background:COLORS[i]}}></i><span>{e.sentiment}</span><b>{e.pct}%</b></div>)}</div></div></div><div className="chart-card"><div className="chart-title"><div><h3>Customer sentiment</h3><p>Volume by sentiment category</p></div><span className="chart-tag">REVIEWS</span></div><ResponsiveContainer width="100%" height={285}><BarChart data={data.sentiment_distribution} margin={{top:25,right:12,left:-18,bottom:4}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f6"/><XAxis dataKey="sentiment" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="count" radius={[7,7,0,0]}>{data.sentiment_distribution.map((e,i)=><Cell key={e.sentiment} fill={COLORS[i]}/>)}</Bar></BarChart></ResponsiveContainer></div></div>}
    {tab==='insights'&&<div className="insights-grid"><div className="verdict-card"><div className="card-icon violet"><WandSparkles size={20}/></div><span className="field-label">OVERALL IMPRESSION</span><h2>{data.verdict.headline}</h2><p>{data.verdict.explanation}</p><div className="evidence-note"><ShieldCheck size={15}/> Based on {stats.total} analyzed reviews</div></div><div className="chart-card"><h3>What customers appreciate</h3>{data.positive_themes.length?data.positive_themes.map(t=><div className="theme-row" key={t.theme}><span>{t.theme}</span><b>{t.count}</b></div>):<p>No clear positive themes detected.</p>}</div><div className="chart-card"><h3>Common concerns</h3>{data.negative_themes.length?data.negative_themes.map(t=><div className="theme-row" key={t.theme}><span>{t.theme}</span><b>{t.count}</b></div>):<p>No clear negative themes detected.</p>}</div></div>}
    {tab==='reviews'&&<div className="chart-card review-card"><div className="review-tools"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search review text…"/><select value={sentimentFilter} onChange={e=>setSentimentFilter(e.target.value)}><option>All</option><option>Positive</option><option>Neutral</option><option>Negative</option></select></div><div className="review-list">{filtered.map((r,i)=><div className="review-row" key={i}><span className={`sentiment-pill ${r.sentiment.toLowerCase()}`}>{r.sentiment}</span><div className="review-text">{r.review_text}<small>{r.rating?`★ ${r.rating}/5`:''} {r.product_category&&r.product_category!=='Unspecified'?` · ${r.product_category}`:''}</small></div></div>)}{!filtered.length&&<p>No reviews match your filters.</p>}</div></div>}
    <p className="method-note">Sentiment labels are automated estimates. Keyword themes are approximate and depend on the quality and representativeness of the available reviews.</p>
   </section>}
   <footer><span>© 2026 ReviewLens AI</span><span>Built for clearer decisions <span className="footer-heart">✦</span></span></footer>
  </main>
 </div>
}
export default App;
