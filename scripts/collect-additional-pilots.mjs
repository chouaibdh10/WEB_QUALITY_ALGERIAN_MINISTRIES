// Evidence only: fixed manifest, repeated lab runs; no automatic ministry scores.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import puppeteer from 'puppeteer-core';
import axe from 'axe-core';
import {createCollector} from './quality/network.mjs';
import {validLabDocument} from './quality/lab-validity.mjs';
import {observePage,aggregate,axeEvidence} from './quality/browser.mjs';
const exec=promisify(execFile),require=createRequire(import.meta.url),wait=ms=>new Promise(r=>setTimeout(r,ms));
const manifest=JSON.parse(await readFile(process.argv[2],'utf8'));
const mode=process.argv[3]??'observations';
const profiles={mobile:{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1},desktop:{width:1365,height:768,isMobile:false,deviceScaleFactor:1}};
const ua='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';
for(const spec of manifest.targets){
 const root=spec.root;await mkdir(root,{recursive:true,mode:0o700});
 const save=async(name,v)=>writeFile(root+'/'+name,JSON.stringify(v,null,2)+'\n',{mode:0o600});
 const collector=createCollector({origins:spec.origins,delayMs:1500,timeoutMs:25000,robotsMode:spec.robotsMode??'strict'});
 let report;try{report=JSON.parse(await readFile(root+'/report.json','utf8'))}catch{report={schemaVersion:1,ministryId:spec.id,startedAt:new Date().toISOString(),root,pages:spec.pages.map((p,i)=>({...p,id:'page-'+(i+1)})),versions:{node:process.version,axe:axe.version,lighthouse:require('lighthouse/package.json').version},settings:{protocolVersion:spec.protocolVersion??'Additional pilot 1.3',collectionAmendment:spec.collectionAmendment,robotsMode:spec.robotsMode??'strict',runs:3,observationConcurrency:4,lighthouseRunConcurrency:1,delayMs:1500,location:'Operator workstation; physical network and geography unverified',method:'Same Pilot 1.2 award thresholds; three preselected observed page roles per target. Separate sequential observation and timing phases; fresh-process Lighthouse with normal browser concurrency; guarded DOM observations. No submissions. No all-site certification.'},ownership:spec.ownership}}
 console.log(mode,spec.id,root);
 if(mode==='observations'&&report.observationsCompletedAt)throw Error('Refusing to overwrite completed observations; choose a fresh evidence root.');
 if(mode==='timings'&&report.completedAt){console.log('Completed target preserved',spec.id);continue;}
 if(mode==='observations'){
  if(spec.httpEntry){try{report.httpRedirect=await collector.request(spec.httpEntry)}catch(e){report.httpRedirect={error:e.message}}}else report.httpRedirect={error:'HTTP entry not in this separate HTTPS-only recovery scope; HTTP enforcement remains N/M.'};
  const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-background-networking'],targetFilter:t=>t.type()!=='other',protocolTimeout:45000});report.versions.chrome=await browser.version();
  try{for(const p of report.pages){
   if(collector.halted)break;await mkdir(root+'/'+p.id,{recursive:true,mode:0o700});
   try{p.http=await collector.request(p.url)}catch(e){p.http={error:e.message}}
   p.observations={};p.accessibility={};p.manual={};p.resources=[];p.blocked=[];p.inventory=[];p.errors=[];
   for(const [profile,viewport] of Object.entries(profiles)){
    let page;try{
     await collector.guard(p.url);page=await browser.newPage();await page.setUserAgent(ua);await page.setBypassServiceWorker(true);await page.setCacheEnabled(false);await page.setViewport(viewport);await page.setRequestInterception(true);
     let active=0;const pending=[],running=new Set();const drain=()=>{while(active<4&&pending.length){const r=pending.shift();active++;running.add(r);void allow(r)}};const release=r=>{if(running.delete(r)){active--;drain()}};
     const allow=async r=>{try{if(!['GET','HEAD'].includes(r.method()))throw Error('GET/HEAD only');const u=new URL(r.url());if(['data:','blob:','about:'].includes(u.protocol)){await r.continue();return}if(spec.origins.includes(u.origin))await collector.guard(u.href);else{if(r.isNavigationRequest())throw Error('External document outside scope');await collector.validatePublicUrl(u.href)}p.inventory.push(u.origin+u.pathname);await r.continue()}catch(e){p.blocked.push({url:r.url().split('?')[0],reason:e.message});await r.abort().catch(()=>{});release(r)}};
     page.on('request',r=>{pending.push(r);drain()});page.on('requestfinished',release);page.on('requestfailed',r=>{p.resources.push({url:r.url().split('?')[0],error:r.failure()?.errorText});release(r)});page.on('response',r=>{collector.observeStatus(r.status(),r.url());if(r.status()>=400)p.resources.push({url:r.url().split('?')[0],status:r.status()})});
     await page.goto(p.url,{waitUntil:'domcontentloaded',timeout:35000});await wait(3500);if(await page.title()==='Web Page Blocked')throw Error('Local network interstitial excluded, not a ministry failure');
     p.observations[profile]=await observePage(page);p.observations[profile].finalUrl=page.url();await page.screenshot({path:root+'/'+p.id+'/'+profile+'.png'});
     await page.addScriptTag({content:axe.source});p.accessibility[profile]=axeEvidence(await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})));await save(p.id+'/'+profile+'-axe.json',p.accessibility[profile]);
     p.manual[profile]=await page.evaluate(()=>{const es=s=>[...document.querySelectorAll(s)],visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'};return{at:new Date().toISOString(),main:(document.querySelector('main,#content,#sp-main-body')??document.body).innerText.slice(0,32000),headings:es('h1,h2,h3').map(e=>({tag:e.tagName,text:e.innerText.slice(0,180)})),images:es('img').slice(0,70).map(e=>({alt:e.getAttribute('alt'),src:e.currentSrc,naturalWidth:e.naturalWidth})),forms:es('form').map(f=>({action:f.action,method:f.method,text:f.innerText.slice(0,2000),controls:[...f.querySelectorAll('input,select,textarea')].filter(visible).map(e=>({type:e.type,name:e.name,label:[...(e.labels??[])].map(l=>l.innerText).join(' '),aria:e.getAttribute('aria-label'),placeholder:e.placeholder,required:e.required}))})),policyMeta:es('meta[http-equiv]').map(e=>({name:e.httpEquiv,value:e.content})),generator:document.querySelector('meta[name="generator"]')?.content,unnamedLinks:es('a[href]').filter(visible).filter(e=>!e.innerText.trim()&&!e.getAttribute('aria-label')&&!e.getAttribute('title')&&!e.querySelector('img[alt]:not([alt=""])')).slice(0,20).map(e=>({href:e.href,html:e.outerHTML.slice(0,900)})),languageLinks:es('a[hreflang],.mod-languages a,.lang-item a').map(e=>({text:e.innerText,url:e.href,lang:e.hreflang})),links:es('a[href]').filter(visible).map(e=>({text:e.innerText.trim().slice(0,120),url:e.href})).slice(0,200)}});
     const keyboard=[];await page.evaluate(()=>document.activeElement?.blur());for(let i=0;i<14;i++){await page.keyboard.press('Tab');keyboard.push(await page.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e);return{tag:e.tagName,text:(e.innerText??'').slice(0,100),href:e.href,aria:e.getAttribute('aria-label'),outline:s.outline,shadow:s.boxShadow}}))}p.manual[profile].keyboard=keyboard;
     p.manual[profile].viewports=[];for(const width of [320,390,844]){await page.setViewport({width,height:width===844?390:844,isMobile:false,deviceScaleFactor:1});await wait(300);p.manual[profile].viewports.push(await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth+1})));await page.screenshot({path:root+'/'+p.id+'/'+profile+'-width-'+width+'.png'})}
     console.log('observed',spec.id,p.type,profile,p.observations[profile].title,p.accessibility[profile].violations.map(v=>v.id).join(','));
    }catch(e){p.errors.push({profile,error:e.message});console.log('unavailable',spec.id,p.type,profile,e.message.slice(0,140))}finally{await save('report.json',report);if(page)await Promise.race([page.close().catch(()=>{}),wait(2000)])}
   }
   await save(p.id+'/page.json',p);await save('report.json',report);
  }}finally{await browser.close()}
  // Only actually declared sitemap locations, or standard sitemap endpoint, are checked.
  report.robots=collector.robotsEvidence;try{report.sitemap=await collector.request(spec.origins.find(x=>x.startsWith('https://'))+'/sitemap.xml',{body:true})}catch(e){report.sitemap={error:e.message}}report.observationsCompletedAt=new Date().toISOString();report.halted=collector.halted;await save('report.json',report);
 }else if(mode==='timings'){
  if(!report.observationsCompletedAt)throw Error('Complete observations first');
  if(spec.blockedUrlPatterns?.length)report.timingPreflight={at:new Date().toISOString(),status:'Declined',reason:'Explicit resource robots exclusions prevent representative visitor timings; no Lighthouse runs sent.',blockedUrlPatterns:spec.blockedUrlPatterns};
  for(const p of report.pages){await mkdir(root+'/'+p.id,{recursive:true,mode:0o700});p.performance??={};for(const profile of Object.keys(profiles)){
   const runs=p.performance[profile]?.runs??[];
   for(let i=runs.length+1;i<=3&&!collector.halted;i++){
    try{await collector.guard(p.url);if(spec.blockedUrlPatterns?.length)throw Error('Timing preflight declined: explicit robots exclusions for CSS/JS prevent representative visitor performance. No Lighthouse run sent; performance remains N/M.');await wait(1500);console.log('Lighthouse',spec.id,p.type,profile,i);const file=root+'/'+p.id+'/'+profile+'-lighthouse-'+i+'.json';
     // Chrome-launcher handles SIGINT by killing its own detached Chrome group.
     const args=['node_modules/lighthouse/cli/index.js',p.url,'--only-categories=performance','--chrome-path=/usr/bin/google-chrome','--chrome-flags=--headless=new --no-sandbox --disable-background-networking','--output=json','--output-path='+file,'--quiet','--max-wait-for-load=30000','--max-wait-for-fcp=30000'];if(profile==='desktop')args.push('--preset=desktop');await exec(process.execPath,args,{timeout:80000,maxBuffer:200000,killSignal:'SIGINT'});const lhr=JSON.parse(await readFile(file,'utf8'));
     const docs=lhr.audits['network-requests']?.details?.items?.filter(r=>r.resourceType==='Document')??[];for(const r of docs)collector.observeStatus(r.statusCode,r.url);
     if(!validLabDocument(lhr,spec.origins))throw Error(lhr.runtimeError?.message||'Successful ministry document not established; excluded');
     const map={LCP:'largest-contentful-paint',CLS:'cumulative-layout-shift',FCP:'first-contentful-paint',TBT:'total-blocking-time',TTFB:'server-response-time',transferBytes:'total-byte-weight'};const metrics=Object.fromEntries(Object.entries(map).map(([k,id])=>[k,Number.isFinite(lhr.audits[id]?.numericValue)?lhr.audits[id].numericValue:null]));metrics.requests=lhr.audits['network-requests']?.details?.items?.length??null;runs.push({index:i,status:'Collected',metrics});console.log(JSON.stringify(metrics));
    }catch(e){runs.push({index:i,status:'N/M',metrics:{},error:e.message});console.log('N/M',e.message.slice(0,140))}
    p.performance[profile]={runs,metrics:aggregate(runs)};await save('report.json',report);
   }
  }}report.completedAt=new Date().toISOString();report.robotsTimings=collector.robotsEvidence;report.halted=collector.halted;await save('report.json',report);console.log('completed',spec.id);
 }else throw Error('Use observations or timings');
}
