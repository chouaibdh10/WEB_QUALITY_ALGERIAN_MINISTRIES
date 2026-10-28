// Supplementary observed-link checks. Collection never awards points.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createCollector} from './quality/network.mjs';
const root='evidence/coverage-review-2026-10-26';await mkdir(root,{recursive:true,mode:0o700});
const roots=JSON.parse(await readFile('evidence/completion-review-2026-10-21/roots.json'));
const targets=[];
for(const [id,rawRoot] of Object.entries(roots)){
 const pub=JSON.parse(await readFile(`public/evaluations/${id}-pilot.json`));
 const pending=new Set(pub.categories.flatMap(c=>c.rows).filter(r=>r.points===null).map(r=>r.id));
 const source=JSON.parse(await readFile(rawRoot+'/completion-page-checks-2026-10-21.json'));
 const core=source.records.filter(r=>r.representative);const links=core.flatMap(r=>r.dom.links.map(l=>({...l,source:r.finalUrl})));
 const hosts=new Set(pub.pages.map(p=>new URL(p.url).hostname.replace(/^www\./,'')));
 const eligible=l=>{try{return /^https?:/.test(l.href)&&hosts.has(new URL(l.href).hostname.replace(/^www\./,''))&&!/\.(pdf|zip|rar|docx?|xlsx?)(?:$|\?)/i.test(l.href)}catch{return false}};
 const selected=[];
 if(pending.has('content.mission')){const l=links.find(l=>eligible(l)&&/attributions|missions?|organisation|organization|مهام|صلاحيات|هيكل|من نحن/i.test(l.text+' '+l.title)&&!l.href.endsWith('#'));if(l)selected.push({kind:'mission',url:l.href,observedLabel:l.text,source:l.source})}
 if(pending.has('content.multilingual')){const l=links.find(l=>eligible(l)&&/^(fran[cç]ais|english|العربية|عربي|fr|en|ar)$/i.test(l.text.trim())&&!core.some(r=>r.finalUrl===l.href));if(l)selected.push({kind:'language',url:l.href,observedLabel:l.text,source:l.source})}
 if(pending.has('technical.site-search')){
  const candidate=core.flatMap(r=>r.dom.forms.map(form=>({form,source:r.finalUrl,lang:r.dom.lang}))).find(x=>x.form.method==='get'&&x.form.fields.some(f=>['s','q','searchword','keys','search'].includes(f.name)));
  if(candidate&&eligible({href:candidate.form.action})){const field=candidate.form.fields.find(f=>['s','q','searchword','keys','search'].includes(f.name));const u=new URL(candidate.form.action);const query=candidate.lang?.startsWith('ar')?'وزارة':candidate.lang?.startsWith('fr')?'ministère':'ministry';u.searchParams.set(field.name,query);selected.push({kind:'search',url:u.href,source:candidate.source,query,observedAction:candidate.form.action,observedField:field.name,note:'GET action and field came from a retained representative DOM capture. This task does not guess a search route.'})}
 }
 targets.push({id,rawRoot,selected,origins:[...new Set([...pub.pages.map(p=>new URL(p.url).origin),...core.map(r=>new URL(r.finalUrl).origin),...selected.map(t=>new URL(t.url).origin)])]});
}
await writeFile(root+'/supplementary-manifest.json',JSON.stringify({declaredAt:new Date().toISOString(),scope:'At most one observed same-site mission link, offered-language link and benign GET search per ministry. Existing score budgets unchanged. No forms, authentication, guessed routes or personal data.',targets},null,2),{mode:0o600});
for(const target of targets){
 const file=root+'/'+target.id+'-supplementary.json';try{if(JSON.parse(await readFile(file)).completedAt)continue}catch(e){if(e.code!=='ENOENT')throw e}
 const record={id:target.id,startedAt:new Date().toISOString(),records:[]};let browser;
 try{
  if(target.selected.length)browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox'],protocolTimeout:20000});
  const collector=createCollector({origins:target.origins,robotsMode:'rfc9309-recovery',delayMs:1500,timeoutMs:12000});
  for(const task of target.selected){if(collector.halted)break;const item={...task,startedAt:new Date().toISOString(),blocked:[]};let page;
   try{
    await collector.guard(task.url);page=await browser.newPage();await page.setViewport({width:1280,height:900});await page.setRequestInterception(true);
    page.on('request',async req=>{try{if(collector.halted||!['GET','HEAD'].includes(req.method()))throw Error('Only GET/HEAD while active');if(/^https?:/.test(req.url()))await collector.validatePublicUrl(req.url());if(req.isNavigationRequest())await collector.guard(req.url());await req.continue()}catch(e){item.blocked.push({type:req.resourceType(),url:req.url().split('?')[0],reason:e.message});await req.abort().catch(()=>{})}});
    page.on('response',res=>{collector.observeStatus(res.status(),res.url());if(res.request().isNavigationRequest()&&res.frame()===page.mainFrame())item.document={url:res.url(),status:res.status()}});
    await page.goto(task.url,{waitUntil:'domcontentloaded',timeout:18000}).catch(e=>{item.navigationError=e.message});await new Promise(r=>setTimeout(r,1500));
    item.dom=await page.evaluate(()=>({url:location.href,title:document.title,lang:document.documentElement.lang,text:document.body.innerText.slice(0,50000),description:document.querySelector('meta[name="description"]')?.content??null,headings:[...document.querySelectorAll('h1,h2,h3')].map(e=>({tag:e.tagName,text:e.innerText})).slice(0,60),links:[...document.querySelectorAll('a[href]')].map(e=>({text:e.innerText.trim().slice(0,180),href:e.href})).filter(e=>e.text).slice(0,250)}));
    item.representative=item.document?.status===200&&item.dom.text.length>=160&&!/access denied|just a moment|application error/i.test(item.dom.title);
   }catch(e){item.error=e.message}finally{if(page)await page.close().catch(()=>{});item.completedAt=new Date().toISOString();record.records.push(item);console.log(target.id,task.kind,item.representative?'captured':item.error??item.navigationError??'excluded')}
  }
  record.robots=collector.robotsEvidence;record.stopReason=collector.halted;
 }catch(e){record.error=e.message}finally{await browser?.close().catch(()=>{})}
 record.completedAt=new Date().toISOString();await writeFile(file,JSON.stringify(record,null,2)+'\n',{mode:0o600});
}
