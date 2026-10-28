// Additive, read-only follow-up. Never changes existing captures or awards scores.
import {readFile,writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import axe from 'axe-core';
import {createCollector} from './quality/network.mjs';
import {axeEvidence} from './quality/browser.mjs';
const roots=JSON.parse(await readFile('evidence/completion-review-2026-10-21/roots.json'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const launch=()=>puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox'],protocolTimeout:20000,targetFilter:t=>t.type()!=='other'});
let browser;
try {for(const [id,root] of Object.entries(roots)) {
 if(process.argv[2]&&id!==process.argv[2])continue;
 const file=root+'/completion-page-checks-2026-10-21.json';
 try{if(JSON.parse(await readFile(file)).completedAt){console.log(id,'preserved completed follow-up');continue}}catch(e){if(e.code!=='ENOENT')throw e}
 browser=await launch();
 const raw=JSON.parse(await readFile(root+'/report.json'));
 const origins=[...new Set(raw.pages.flatMap(p=>[new URL(p.url).origin,...(p.http?.finalUrl?[new URL(p.http.finalUrl).origin]:[])]))];
 const c=createCollector({origins,robotsMode:'rfc9309-recovery',delayMs:1500,timeoutMs:12000});
 const report={id,startedAt:new Date().toISOString(),scope:'Same declared core pages, fresh normal Chrome read-only follow-up. GET/HEAD only; trusted TLS and robots enforced. DOM, metadata, visible images, form labels, keyboard, menu and 320/390/844 CSS widths. No form submission, authentication, completed service, field INP or long-term monitoring.',records:[]};
 for(const target of raw.pages) {
  if(c.halted){report.stopReason=c.halted;break}
  const record={type:target.type,url:target.url,startedAt:new Date().toISOString(),blocked:[],responses:[]};let p;
  try {
   await c.guard(target.url);p=await browser.newPage();await p.setBypassServiceWorker(true);
   await p.setViewport({width:390,height:844});await p.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36');
   await p.setRequestInterception(true);
   p.on('request',async r=>{try{
    if(c.halted||!['GET','HEAD'].includes(r.method()))throw Error('Only read-only GET/HEAD while collector is active');
    if(/^https?:/.test(r.url()))await c.validatePublicUrl(r.url());
    if(r.isNavigationRequest())await c.guard(r.url());
    else if(raw.settings?.collectionAmendment&&origins.includes(new URL(r.url()).origin))await c.guard(r.url());
    await r.continue();
   }catch(e){record.blocked.push({url:r.url().split('?')[0],type:r.resourceType(),reason:e.message});await r.abort().catch(()=>{})}});
   p.on('response',r=>{c.observeStatus(r.status(),r.url());if(r.request().isNavigationRequest()&&r.frame()===p.mainFrame())record.documentResponse={url:r.url(),status:r.status(),headers:r.headers()};if(r.status()>=400)record.responses.push({url:r.url().split('?')[0],status:r.status(),type:r.request().resourceType()})});
   const response=await p.goto(target.url,{waitUntil:'domcontentloaded',timeout:18000}).catch(e=>{record.navigationError=e.message;return null});
   await wait(1400);record.httpStatus=response?.status()??record.documentResponse?.status;record.finalUrl=p.url();
   record.dom=await p.evaluate(()=>{
    const es=s=>[...document.querySelectorAll(s)];const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
    return {title:document.title,lang:document.documentElement.lang,text:document.body.innerText.slice(0,45000),description:document.querySelector('meta[name="description"]')?.content??null,generator:document.querySelector('meta[name="generator"]')?.content??null,canonical:document.querySelector('link[rel="canonical"]')?.href??null,viewport:document.querySelector('meta[name="viewport"]')?.content??null,policyMeta:es('meta[http-equiv]').map(e=>({name:e.httpEquiv,value:e.content})),headings:es('h1,h2,h3').filter(visible).map(e=>({tag:e.tagName,text:e.innerText})),images:es('img').filter(visible).map(e=>({alt:e.getAttribute('alt'),src:(e.currentSrc||e.src).split('?')[0],loaded:e.complete&&e.naturalWidth>0,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,linkText:e.closest('a')?.innerText??null,linkLabel:e.closest('a')?.getAttribute('aria-label')??null})),links:es('a[href]').filter(visible).map(e=>({text:e.innerText.trim().slice(0,200),href:e.href,aria:e.getAttribute('aria-label'),title:e.title,images:[...e.querySelectorAll('img')].map(i=>i.alt)})),buttons:es('button,[role="button"]').filter(visible).map(e=>({text:e.innerText,aria:e.getAttribute('aria-label'),expanded:e.getAttribute('aria-expanded'),role:e.getAttribute('role')})),forms:es('form').map(f=>({action:f.action,method:f.method,text:f.innerText.slice(0,2500),fields:[...f.querySelectorAll('input,select,textarea')].filter(e=>e.type!=='hidden').map(e=>({type:e.type,name:e.name,required:e.required,label:[...(e.labels??[])].map(l=>l.innerText).join(' '),aria:e.getAttribute('aria-label'),placeholder:e.placeholder,visible:visible(e)}))}))};
   });
   if(record.httpStatus!==200||record.dom.text.length<160||/Web Page Blocked|Access Denied|Just a moment/i.test(record.dom.title))throw Error('Nonrepresentative document; excluded from website scoring');
   record.representative=true;
   await p.addScriptTag({content:axe.source});record.axe=axeEvidence(await p.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})));
   record.viewports=[];
   for(const width of [320,390,844]){await p.setViewport({width,height:width===844?390:844});await wait(150);record.viewports.push(await p.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyFont:getComputedStyle(document.body).fontSize})));}
   await p.setViewport({width:390,height:844});await p.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0)});record.keyboard=[];
   for(let i=0;i<20;i++){await p.keyboard.press('Tab');record.keyboard.push(await p.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e),r=e.getBoundingClientRect();return{tag:e.tagName,text:(e.innerText??'').slice(0,100),aria:e.getAttribute('aria-label'),href:e.getAttribute('href'),visible:r.width>0&&r.height>0,outline:s.outline,shadow:s.boxShadow,focusVisible:e.matches(':focus-visible')}}))}
   const menu=await p.evaluateHandle(()=>[...document.querySelectorAll('button[aria-expanded]')].find(e=>!e.closest('form')&&e.getBoundingClientRect().width>0&&/menu|قائمة/i.test([e.innerText,e.getAttribute('aria-label'),e.className].join(' '))));
   if(menu.asElement()){
    await menu.asElement().focus();await p.keyboard.press('Enter');await wait(150);record.menu={afterEnter:await menu.asElement().evaluate(e=>e.getAttribute('aria-expanded'))};await p.keyboard.press('Escape');await wait(100);record.menu.afterEscape=await menu.asElement().evaluate(e=>e.getAttribute('aria-expanded'));
   }
   if(target.type==='homepage')await p.screenshot({path:root+'/completion-homepage-390.png'});
  }catch(e){record.error=e.message}finally{record.completedAt=new Date().toISOString();report.records.push(record);if(p)await p.close().catch(()=>{});await writeFile(file,JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(id,target.type,record.representative?'captured':'excluded',record.error??'')}
 }
 report.completedAt=new Date().toISOString();report.robots=c.robotsEvidence;report.stopReason??=c.halted;await writeFile(file,JSON.stringify(report,null,2)+'\n',{mode:0o600});
 await browser.close();browser=null;
}}
finally{await browser?.close()}
