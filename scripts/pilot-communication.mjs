// Repeatable passive pilot. No automatic point awards or raw-evidence publication.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
const execFileAsync=promisify(execFile);
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import puppeteer from 'puppeteer-core';
import {launch} from 'chrome-launcher';
import axe from 'axe-core';
import {createCollector} from './quality/network.mjs';
import {observePage,aggregate,axeEvidence} from './quality/browser.mjs';
const require=createRequire(import.meta.url);
const root=`evidence/communication-pilot-${new Date().toISOString().replace(/[:.]/g,'-')}`;
await mkdir(root,{recursive:true,mode:0o700});
const save=async(name,value)=>writeFile(`${root}/${name}`,JSON.stringify(value,null,2)+'\n',{mode:0o600});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const collector=createCollector({origins:['http://mcomm.gov.dz','https://mcomm.gov.dz'],delayMs:1500,timeoutMs:30000});
const pages=[{type:'homepage',url:'https://mcomm.gov.dz/ar'}];
const profiles={mobile:{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1},desktop:{width:1365,height:768,deviceScaleFactor:1}};
const report={schemaVersion:1,startedAt:new Date().toISOString(),root,pages,versions:{node:process.version,axe:axe.version,lighthouse:require('lighthouse/package.json').version},settings:{protocolVersion:'1.2',runs:3,observationConcurrency:4,lighthouseRunConcurrency:1,lighthouseNetworkConcurrency:'Normal browser defaults',delayMs:1500,location:'Operator workstation; physical network and geography unverified',method:'Lighthouse uses a fresh normal-concurrency browser per CLI run. DOM observations use page-level Puppeteer interception; no recursive target attachment; service workers bypassed; child workers not fully intercepted. This limitation prevents a complete absence-of-network-issues claim.'}};
console.log(root);
report.httpRedirect=await collector.request('http://mcomm.gov.dz/');
async function guardedPage(browser){
 const page=await browser.newPage();await page.setBypassServiceWorker(true);await page.setCacheEnabled(false);page.setDefaultNavigationTimeout(30000);page.setDefaultTimeout(15000);
 const cdp=await page.createCDPSession();await cdp.send('Network.setBlockedURLs',{urls:['ws://*','wss://*']});
 await page.evaluateOnNewDocument(()=>{window.open=()=>null;});
 await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36');await page.setRequestInterception(true);
 const blocked=[],resources=[],inventory=new Set(),pending=[],active=new Set();
 const release=req=>{active.delete(req);drain()};
 const drain=()=>{while(active.size<4&&pending.length){const req=pending.shift();active.add(req);void allow(req)}};
 const allow=async req=>{try{
  if(collector.halted)throw Error(collector.halted);
  if(!['GET','HEAD'].includes(req.method()))throw Error('Only GET/HEAD allowed');
  const u=new URL(req.url());
  if(['data:','blob:','about:'].includes(u.protocol)){await req.continue();return}
  if(u.hostname==='mcomm.gov.dz')await collector.guard(u.href);
  else {if(req.isNavigationRequest())throw Error('External document outside pilot scope');await collector.validatePublicUrl(u.href)}
  inventory.add(u.origin+u.pathname);await req.continue();
 }catch(e){blocked.push({url:req.url().split('?')[0],reason:e.message});await req.abort('blockedbyclient').catch(()=>{});release(req)}};
 page.on('request',req=>{pending.push(req);drain()});
 page.on('requestfinished',release);page.on('requestfailed',req=>{resources.push({url:req.url().split('?')[0],error:req.failure()?.errorText});release(req)});
 page.on('response',res=>{collector.observeStatus(res.status(),res.url());if(res.status()>=400)resources.push({url:res.url().split('?')[0],status:res.status()})});
 return {page,blocked,resources,inventory};
}
for(let pi=0;pi<pages.length&&!collector.halted;pi++){
 const entry=pages[pi];const dir=`page-${pi+1}`;await mkdir(`${root}/${dir}`,{mode:0o700});entry.id=dir;console.log(entry.type,entry.url);
 try{entry.http=await collector.request(entry.url)}catch(e){entry.http={error:e.message};continue}
 if(pi===0){try{entry.sitemap=await collector.request('https://mcomm.gov.dz/sitemap.xml')}catch(e){entry.sitemap={error:e.message}}}
 entry.observations={};entry.accessibility={};entry.performance={};entry.blocked=[];entry.resources=[];entry.inventory=[];entry.errors=[];
 const chrome=await launch({chromePath:'/usr/bin/google-chrome',chromeFlags:['--headless=new','--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run'],handleSIGINT:false,logLevel:'silent'});
 const browser=await puppeteer.connect({browserURL:`http://127.0.0.1:${chrome.port}`,defaultViewport:null,protocolTimeout:45000,targetFilter:target=>target.type()!=='other'});report.versions.chrome=await browser.version();
 try{
 for(const [profile,viewport] of Object.entries(profiles)){
  if(collector.halted)break;
  const context=browser;let current;
  try{current=await guardedPage(context);await current.page.setViewport(viewport);await wait(1500);await current.page.goto(entry.url,{waitUntil:'networkidle2',timeout:30000});await wait(1000);
   if((await current.page.title())==='Web Page Blocked')throw Error('Local network block interstitial: excluded, not a ministry failure');entry.observations[profile]=await observePage(current.page);entry.observations[profile].finalUrl=current.page.url();
   await current.page.screenshot({path:`${root}/${dir}/${profile}.png`,fullPage:false});await current.page.addScriptTag({content:axe.source});
   entry.accessibility[profile]=axeEvidence(await current.page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})));
   await save(`${dir}/${profile}-axe.json`,entry.accessibility[profile]);
   if(pi===0&&profile==='desktop'){
    const links=await current.page.$$eval('a[href]',els=>els.map(e=>({url:e.href,text:e.textContent.trim()})).filter(x=>x.url.startsWith('https://mcomm.gov.dz/')&&!x.url.includes('?')&&!x.url.includes('#')));
    report.observedLinks=links;
    const specs=[['service',/book-an-appointment/],['contact',/\/contact$/],['news',/\/news\//],['deep',/ministry-structure/],['language',/\/fr\/?$/]];
    const picked=new Set([new URL(entry.url).href,'https://mcomm.gov.dz/ar']);
    for(const[type,pattern]of specs){const found=links.find(l=>pattern.test(l.url)&&!picked.has(l.url));if(found){await collector.guard(found.url);picked.add(found.url);pages.push({type,url:found.url,note:'Observed homepage link; declared role selection before scoring'})}else console.log('Missing role',type)}
    await save('sample-manifest.json',pages.map(({type,url,note})=>({type,url,note})));
   }
  }catch(e){entry.errors.push({profile,stage:'observation',message:e.message});console.log('Observation unavailable',profile,e.message)}
  finally{if(current){entry.blocked.push(...current.blocked);entry.resources.push(...current.resources);entry.inventory.push(...current.inventory)}await save(`${dir}/observation-progress.json`,entry);await save('report.json',report);if(current)await Promise.race([current.page.close().catch(()=>{}),wait(3000)])}

 }
 }finally{await browser.disconnect();await chrome.kill()}
 await save(`${dir}/page.json`,entry);await save('report.json',report);
}
// Standard fresh-process Lighthouse CLI, sequential; excludes network block documents.
for(const entry of pages){
 for(const profile of Object.keys(profiles)){
  const runs=[];entry.performance??={};
  for(let i=1;i<=3&&!collector.halted;i++){
   await collector.guard(entry.url);await wait(1500);const name=`${entry.id}/${profile}-lighthouse-${i}.json`;console.log('Lighthouse',entry.type,profile,i);
   try{
    const args=['node_modules/lighthouse/cli/index.js',entry.url,'--only-categories=performance','--chrome-path=/usr/bin/google-chrome','--chrome-flags=--headless=new --disable-background-networking','--output=json',`--output-path=${root}/${name}`,'--quiet','--max-wait-for-load=30000','--max-wait-for-fcp=30000'];if(profile==='desktop')args.push('--preset=desktop');
    await execFileAsync(process.execPath,args,{timeout:70000,maxBuffer:200000});const lhr=JSON.parse(await readFile(`${root}/${name}`,'utf8'));
    const docs=lhr.audits['network-requests']?.details?.items?.filter(r=>r.resourceType==='Document')??[];
    const synthetic=docs.some(r=>r.statusCode>=400)||!docs.some(r=>r.statusCode===200&&r.resourceSize>15000);
    if(lhr.runtimeError||synthetic)throw Error(lhr.runtimeError?.message||'Non-ministry or unsuccessful document excluded');
    const map={LCP:'largest-contentful-paint',CLS:'cumulative-layout-shift',FCP:'first-contentful-paint',TBT:'total-blocking-time',TTFB:'server-response-time',transferBytes:'total-byte-weight'};
    const metrics=Object.fromEntries(Object.entries(map).map(([key,id])=>[key,lhr.audits[id]?.numericValue??null]));metrics.requests=lhr.audits['network-requests']?.details?.items?.length??null;
    runs.push({index:i,status:'Collected',metrics});console.log(JSON.stringify(metrics));
   }catch(e){runs.push({index:i,status:'N/M',metrics:{},error:e.message});console.log('Unavailable',e.message.slice(0,180))}
   entry.performance[profile]={runs,metrics:aggregate(runs)};await save('report.json',report);
  }
 }
 await save(`${entry.id}/page.json`,entry);
}
report.robots=collector.robotsEvidence;report.halted=collector.halted;report.completedAt=new Date().toISOString();await save('report.json',report);console.log('Completed',root);
