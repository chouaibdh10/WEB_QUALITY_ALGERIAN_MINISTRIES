import {mkdir,readFile,writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {ministries} from '../src/data/ministries.js';
import {pilotSummaries} from '../src/data/pilotSummaries.js';
import {createCollector} from './quality/network.mjs';
const root='evidence/national-campaign-2026-10-20';await mkdir(root,{recursive:true,mode:0o700});
const identities=JSON.parse(await readFile('public/ministries/sources.json')).identities;
const ua='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';
const directory='https://www.mfa.gov.dz/fr/miscellaneous/useful-links',edu='https://www.education.gov.dz/liens-utiles/';
const confirmed={
 'national-defence':directory,'interior-local-authorities-transport':directory,justice:directory,'national-education':directory,
 'energy-renewable-energies':directory,'national-solidarity-family':directory,'housing-spatial-planning':directory,
 'internal-trade-market-regulation':directory,'labour-employment-social-security':directory,'relations-parliament':directory,
 industry:edu,'agriculture-rural-development-fisheries':edu,'tourism-handicrafts':edu,
};
const overrides={justice:'https://www.mjustice.dz/ar/',industry:'https://www.industrie.gov.dz/'};
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox'],targetFilter:t=>t.type()!=='other'});
try{for(const ministry of ministries){if(pilotSummaries[ministry.id])continue;const file=root+'/'+ministry.id+'-discovery.json';try{const old=JSON.parse(await readFile(file));if(old.completedAt){console.log('Preserved',ministry.id,old.status);continue}}catch{}
 const entry=overrides[ministry.id]??identities.find(i=>i.id===ministry.id)?.page??(ministry.domain?'https://www.'+ministry.domain+'/':null);
 const record={id:ministry.id,name:ministry.name,seed:entry,startedAt:new Date().toISOString(),ownership:confirmed[ministry.id]?{status:'Government directory confirmed',source:confirmed[ministry.id],checkedAt:new Date().toISOString(),note:'Directory host association plus observed trusted redirect and institutional identity. Legacy portfolio titles in directories may differ; no endorsement implied.'}:{status:'Unverified',note:'Institutional page identity alone is not independent domain verification.'}};
 if(!entry){record.status='Unresolved domain';record.reason='No independently established dedicated website in the frozen project corpus; no URL guessed.'}else{
 const host=new URL(entry).hostname.replace(/^www\./,'');record.origins=[host,'www.'+host].flatMap(h=>['http://'+h,'https://'+h]);const c=createCollector({origins:record.origins,delayMs:1500,timeoutMs:20000});let p;
 try{record.http=await c.request(entry);if(record.http.status!==200)throw Error('Non-successful document HTTP '+record.http.status);await c.guard(entry);p=await browser.newPage();await p.setUserAgent(ua);await p.setViewport({width:1365,height:900});await p.setBypassServiceWorker(true);await p.setRequestInterception(true);p.on('request',async r=>{try{if(!['GET','HEAD'].includes(r.method()))throw Error('GET/HEAD only');if(r.isNavigationRequest()){if(!record.origins.includes(new URL(r.url()).origin))throw Error('Outside approved origin');await c.guard(r.url())}await r.continue()}catch{await r.abort().catch(()=>{})}});p.on('response',r=>c.observeStatus(r.status(),r.url()));
 try{await p.goto(entry,{waitUntil:'domcontentloaded',timeout:35000})}catch(e){record.navigationWarning=e.message}await new Promise(r=>setTimeout(r,2000));record.title=await p.title();record.url=p.url();record.body=await p.$eval('body',e=>e.innerText.slice(0,24000));if(record.title==='Web Page Blocked'||record.body.length<160)throw Error('No substantive ministry DOM; local interstitial or unavailable document excluded');
 record.links=await p.$$eval('a[href]',es=>es.map(e=>({text:e.innerText.trim().slice(0,150),url:e.href})).filter(e=>e.text));await p.screenshot({path:root+'/'+ministry.id+'-discovery.png'});record.status='Discovered';console.log(ministry.id,record.status,record.url,record.title,record.links.length);
 }catch(e){record.status='Collection gap';record.reason=e.message;console.log(ministry.id,record.status,e.message)}finally{record.robots=c.robotsEvidence;if(p)await p.close().catch(()=>{})}
 }record.completedAt=new Date().toISOString();await writeFile(file,JSON.stringify(record,null,2)+'\n',{mode:0o600});
}}finally{await browser.close()}
