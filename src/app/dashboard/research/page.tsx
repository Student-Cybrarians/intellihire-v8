import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth/current";
import ResearchConsole from "@/components/ResearchConsole";

export default async function ResearchPage(){
  const auth=await getCurrentAuth();
  if(!auth)redirect("/?returnTo=/dashboard/research");
  return <main style={{minHeight:"100vh",padding:"2rem",background:"var(--ih-bg)",color:"var(--ih-text)",fontFamily:"var(--ih-font-body)"}}><div style={{maxWidth:1100,margin:"0 auto"}}>
    <Link href="/dashboard" style={{color:"var(--ih-accent)",textDecoration:"none"}}>← Dashboard</Link>
    <header style={{margin:"2rem 0"}}><p style={{margin:0,color:"var(--ih-accent)",font:"500 .72rem var(--ih-font-mono)",letterSpacing:".14em"}}>PERSONAL AI RESEARCH INTERN / EVIDENCE RAG</p><h1 style={{fontFamily:"var(--ih-font-display)",fontSize:"clamp(2rem,5vw,3.5rem)",margin:".5rem 0"}}>Research from your skill graph.</h1><p style={{maxWidth:760,color:"var(--ih-text-muted)",lineHeight:1.7}}>Research is personalized with your persisted Career Digital Twin, but candidate context is never treated as external evidence. Only retrieved source URLs can support research claims.</p></header>
    <ResearchConsole />
  </div></main>;
}
