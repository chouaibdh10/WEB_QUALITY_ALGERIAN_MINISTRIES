// One benign GET query per observed search form; no service form submission.
import {readFile,writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createCollector} from './quality/network.mjs';
const roots=JSON.parse(await readFile('evidence/completion-review-2026-10-21/roots.json'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox'],protocolTimeout:20000,targetFilter:t=>t.type()!=='other'});
try {for(const [id,root] of Object.entries(roots)){
 const dest=root+'/completion-search-check-2026-10-21.json';
 try{if(JSON.parse(await readFile(dest)).completedAt)continue}catch(e){if(e.code!=='ENOENT')throw e}
 let source;for(let i=0;i<120;i++){try{source=JSON.parse(await readFile(root+'/completion-page-checks-2026-10-21.json'));if(source.completedAt)break}catch{}await wait(10000)}
 const record={id,startedAt:new Date().toISOString(),scope:'One observed same-origin GET search form, one benign keyword, no service submission. Trusted TLS and robots enforced.',blocked:[]};let p;
 const pub=JSON.parse(await readFile('public/evaluations/'+id+'-pilot.json'));
 const existing=pub.categories.flatMap(c=>c.rows).find(r=>r.id==='technical.site-search');
 const candidate=source?.records?.filter(r=>r.representative).flatMap(r=>(r.dom.forms??[]).map(form=>({page:r.finalUrl,form,lang:r.dom.lang}))).find(x=>x.form.method.toLowerCase()==='get'&&x.form.fields.some(f=>['s','q','searchword','keys','search'].includes(f.name)));
 if(existing.points!==null)record.note='Existing reviewed search task retained; not repeated.';
 else if(!candidate)record.note='No verified eligible GET search form in representative core captures; no inferred search pass/failure.';
 else try{
  const origin=new URL(candidate.page).origin;
  if(new URL(candidate.form.action).origin!==origin)throw Error('Observed search action is outside the sampled origin');
  const c=createCollector({origins:[origin],robotsMode:'rfc9309-recovery',delayMs:1500,timeoutMs:12000});
  p=await b.newPage();await p.setViewport({width:1280,height:900});await p.setRequestInterception(true);
  p.on('request',async r=>{try{if(c.halted||!['GET','HEAD'].includes(r.method()))throw Error('Read-only request constraint');if(/^https?:/.test(r.url()))await c.validatePublicUrl(r.url());if(r.isNavigationRequest())await c.guard(r.url());else if(new URL(r.url()).origin===origin)await c.guard(r.url());await r.continue()}catch(e){record.blocked.push({url:r.url().split('?')[0],reason:e.message});await r.abort().catch(()=>{})}});
  p.on('response',r=>c.observeStatus(r.status(),r.url()));
  await c.guard(candidate.page);await p.goto(candidate.page,{waitUntil:'domcontentloaded',timeout:18000});await wait(500);
  record.form=await p.evaluate(()=>{for(const f of document.forms){const input=[...f.elements].find(e=>['s','q','searchword','keys','search'].includes(e.name));if(input&&f.method.toLowerCase()==='get')return{action:f.action,name:input.name,hidden:[...f.querySelectorAll('input[type="hidden"]')].filter(e=>e.name&&!/token|nonce|csrf/i.test(e.name)).map(e=>({name:e.name,value:e.value}))}}return null});
  if(!record.form||new URL(record.form.action).origin!==origin)throw Error('Observed eligible form not present on follow-up');
  const query=candidate.lang?.startsWith('ar')?'وزارة':candidate.lang?.startsWith('fr')?'ministère':'ministry';const url=new URL(record.form.action);for(const x of record.form.hidden)url.searchParams.set(x.name,x.value);url.searchParams.set(record.form.name,query);record.query=query;
  await c.guard(url.href);const response=await p.goto(url.href,{waitUntil:'domcontentloaded',timeout:18000}).catch(e=>{record.navigationError=e.message;return null});await wait(1200);record.status=response?.status();
  record.result=await p.evaluate(()=>({url:location.href,title:document.title,text:document.body.innerText.slice(0,23000),headings:[...document.querySelectorAll('h1,h2,h3')].map(e=>e.innerText).slice(0,40),links:[...document.querySelectorAll('main a,article a,.search-results a,.post-title a,h2 a,h3 a')].map(e=>({text:e.innerText.trim().slice(0,160),url:e.href})).filter(e=>e.text).slice(0,70)}));
  record.robots=c.robotsEvidence;record.stopReason=c.halted;
 }catch(e){record.error=e.message}finally{if(p)await p.close().catch(()=>{})}
 record.completedAt=new Date().toISOString();await writeFile(dest,JSON.stringify(record,null,2)+'\n',{mode:0o600});console.log(id,record.note??record.error??record.result?.title);
}}finally{await b.close()}
