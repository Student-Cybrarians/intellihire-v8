"use client";
import { useEffect, useState } from "react";

type Brief={id:string;question:string;synthesis:string;sources:Array<{title:string;url:string;snippet:string;relevance:number}>;mode:"ai"|"fallback";createdAt:string};

export default function ResearchConsole(){
  const [question,setQuestion]=useState(""); const [briefs,setBriefs]=useState<Brief[]>([]); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function load(){const r=await fetch("/api/research",{cache:"no-store"}); if(r.ok){const b=await r.json();setBriefs(b.briefs??[]);}}
  useEffect(()=>{void load();},[]);
  async function run(){setError("");setBusy(true);try{const r=await fetch("/api/research",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question})});const b=await r.json();if(!r.ok)throw new Error(b.message??"Research failed");setBriefs((old)=>[b.brief,...old].slice(0,10));setQuestion("");}catch(e){setError(e instanceof Error?e.message:"Research failed");}finally{setBusy(false);}}
  return <section style={{display:"grid",gap:"1.25rem"}}>
    <div style={{padding:"1.25rem",border:"1px solid var(--ih-border)",borderRadius:18,background:"var(--ih-panel)"}}>
      <label style={{display:"block",fontWeight:700,marginBottom:8}}>Research question</label>
      <textarea value={question} onChange={e=>setQuestion(e.target.value)} maxLength={500} rows={4} placeholder="Example: Which cloud-security skills are becoming important for my target role?" style={{width:"100%",resize:"vertical",background:"var(--ih-bg)",color:"var(--ih-text)",border:"1px solid var(--ih-border)",borderRadius:12,padding:12}} />
      {error&&<p style={{color:"#ff7b7b"}}>{error}</p>}
      <button disabled={busy||question.trim().length<8} onClick={run} style={{marginTop:12,padding:".8rem 1.1rem",borderRadius:10,border:0,background:"var(--ih-accent)",color:"#07111d",fontWeight:800,cursor:"pointer"}}>{busy?"Researching…":"Research with Career Twin context"}</button>
    </div>
    {briefs.map(b=><article key={b.id} style={{padding:"1.25rem",border:"1px solid var(--ih-border)",borderRadius:18,background:"var(--ih-panel)"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><strong>{b.question}</strong><span style={{fontFamily:"var(--ih-font-mono)",fontSize:12,color:"var(--ih-text-muted)"}}>{b.mode.toUpperCase()}</span></div>
      <p style={{lineHeight:1.7,color:"var(--ih-text-muted)",whiteSpace:"pre-wrap"}}>{b.synthesis}</p>
      {b.sources.length>0?<div style={{display:"grid",gap:8}}>{b.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer" style={{color:"var(--ih-accent)",textDecoration:"none"}}>{s.title} ↗</a>)}</div>:<p style={{fontSize:13,color:"var(--ih-text-muted)"}}>No external evidence was available; no unsupported research claims were generated.</p>}
    </article>)}
  </section>;
}
