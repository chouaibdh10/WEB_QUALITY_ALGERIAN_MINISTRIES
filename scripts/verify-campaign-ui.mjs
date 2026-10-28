import puppeteer from 'puppeteer-core';import axe from 'axe-core';import assert from 'node:assert/strict';
import {campaignMessages} from '../src/campaignMessages.js';import {campaignStatus} from '../src/data/campaignStatus.js';
const base=process.argv[2]??'http://127.0.0.1:4173';
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox'],targetFilter:t=>t.type()!=='other'});
try{
 for(const language of ['en','fr','ar'])for(const width of [1440,390]){
  const page=await browser.newPage();await page.evaluateOnNewDocument(language=>{localStorage.setItem('wqi-language',language);localStorage.setItem('wqi-theme','dark')},language);await page.setViewport({width,height:950});
  for(const status of ['collection-gap','unresolved-domain','collecting']){
   const entry=campaignStatus.entries.find(e=>e.status===status);if(!entry)continue;
   await page.goto(`${base}/ministries/${entry.id}`,{waitUntil:'networkidle0'});await page.waitForSelector('.profile-collection-status');
   assert.equal(await page.$eval('#collection-status-heading',e=>e.textContent),campaignMessages[language].labels[status]);
   assert.equal(await page.$('.pilot-evaluation'),null);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.addScriptTag({content:axe.source});const result=await page.evaluate(()=>axe.run('.profile-collection-status',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));assert.deepEqual(result.violations.map(v=>v.id),[]);
  }
  console.log(language,width,'campaign states, overflow and accessibility passed');await page.close();
 }
 const p=await browser.newPage();const downloads=[];p.on('request',r=>{if(/\/evaluations\/.*-pilot\.json$/.test(r.url()))downloads.push(new URL(r.url()).pathname)});await p.goto(`${base}/ministries/finance`,{waitUntil:'networkidle0'});await p.waitForSelector('.pilot-evaluation');assert.deepEqual(downloads,['/evaluations/finance-pilot.json']);await p.close();
 const failed=await browser.newPage();await failed.setRequestInterception(true);failed.on('request',r=>r.url().endsWith('/evaluations/finance-pilot.json')?r.abort():r.continue());await failed.goto(`${base}/ministries/finance`,{waitUntil:'networkidle0'});await failed.waitForSelector('[role=alert]');assert.equal(await failed.$('.pilot-evaluation'),null);assert.ok(await failed.$('a[href="/evaluations/finance-pilot.json"]'));await failed.close();
 console.log('Only the requested report is fetched; fetch failure has an explicit recovery state.');
}finally{await browser.close()}
