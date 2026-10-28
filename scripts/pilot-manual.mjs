// Read-only interaction record: no entered personal data and no form submissions.
import puppeteer from 'puppeteer-core';
import {readFile,writeFile} from 'node:fs/promises';
import {createCollector} from './quality/network.mjs';
const root=process.argv[2];if(!root)throw Error('Evidence directory required');
const report=JSON.parse(await readFile(`${root}/report.json`,'utf8'));
const extras=[['news',/\/posts\/\d+$/],['privacy',/privacy-policy/],['mission',/minister-powers/]];for(const[type,pattern]of extras){const found=report.observedLinks.find(l=>pattern.test(l.url));if(found&&!report.pages.some(p=>p.url===found.url))report.pages.push({type,url:found.url,id:`manual-${type}`});}
for(const p of report.pages)await (await import('node:fs/promises')).mkdir(`${root}/${p.id}`,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,targetFilter:t=>t.type()!=='other',args:['--disable-background-networking']});
const page=await browser.newPage();await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36');await page.setRequestInterception(true);page.on('request',r=>['GET','HEAD'].includes(r.method())&&(!r.isNavigationRequest()||new URL(r.url()).hostname==='mcomm.gov.dz')?r.continue():r.abort());
let records=[];try{records=JSON.parse(await readFile(`${root}/manual.json`,'utf8')).records}catch{};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 for(const entry of report.pages){
  if(records.some(r=>r.url===entry.url&&!r.error))continue;
  await page.setViewport({width:1365,height:768});await sleep(1500);await page.goto(entry.url,{waitUntil:'domcontentloaded',timeout:30000});
  await sleep(1000);if((await page.title())==='Web Page Blocked'){records.push({url:entry.url,error:'Local network interstitial; excluded'});continue}
  const r={url:entry.url,at:new Date().toISOString()};
  r.dom=await page.evaluate(()=>({title:document.title,lang:document.documentElement.lang,dir:document.documentElement.dir,headings:[...document.querySelectorAll('h1,h2,h3')].map(e=>({tag:e.tagName,text:e.textContent.trim()})),main:document.querySelector('main')?.innerText.slice(0,14000),buttons:[...document.querySelectorAll('button')].map(e=>({text:e.textContent.trim(),label:e.getAttribute('aria-label'),expanded:e.getAttribute('aria-expanded')})),forms:[...document.forms].map(f=>({action:f.action,method:f.method,fields:[...f.querySelectorAll('input,select,textarea')].map(e=>({tag:e.tagName,type:e.type,id:e.id,labels:[...(e.labels||[])].map(l=>l.textContent.trim()),required:e.required,placeholder:e.placeholder,describedBy:e.getAttribute('aria-describedby'),inputMode:e.inputMode,options:e.tagName==='SELECT'?[...e.options].map(o=>o.text):undefined}))})),images:[...document.images].map(e=>({alt:e.getAttribute('alt'),loaded:e.complete&&e.naturalWidth>0})),links:[...document.querySelectorAll('a[href]')].map(e=>({text:e.textContent.trim(),href:e.href})),searches:[...document.querySelectorAll('input')].filter(e=>/search|بحث|recherch/i.test([e.type,e.placeholder,e.name,e.getAttribute('aria-label')].join(' '))).map(e=>({type:e.type,placeholder:e.placeholder}))}));
  r.keyboard=[];await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0)});
  for(let i=0;i<24;i++){await page.keyboard.press('Tab');r.keyboard.push(await page.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e),b=e.getBoundingClientRect();return {tag:e.tagName,text:(e.textContent||e.getAttribute('aria-label')||e.id||'').trim().slice(0,100),href:e.getAttribute('href'),outline:s.outline,boxShadow:s.boxShadow,visible:b.width>0&&b.height>0,focusVisible:e.matches(':focus-visible')}}))}
  r.viewports=[];
  for(const [w,h]of [[390,844],[320,740],[844,390]]){await page.setViewport({width:w,height:h,isMobile:false,hasTouch:false});await page.evaluate(()=>window.scrollTo(0,0));await sleep(250);r.viewports.push(await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,smallControls:[...document.querySelectorAll('button,input,select,textarea')].map(e=>({e,r:e.getBoundingClientRect()})).filter(({r})=>r.width&&r.height&&(r.width<24||r.height<24)).map(({e,r})=>({tag:e.tagName,text:(e.textContent||e.id||'').trim().slice(0,60),width:r.width,height:r.height})),bodyFont:getComputedStyle(document.body).fontSize})));await page.screenshot({path:`${root}/${entry.id}/manual-${w}.png`,fullPage:true})}
  if(entry.type==='homepage'){
   const language=await page.$('button[aria-label*="Lang"],button[aria-label*="lang"]');
   const buttons=await page.$$('button');let langButton=language;
   if(!langButton)for(const b of buttons){if((await b.evaluate(e=>e.textContent.trim()))==='اللغة'){langButton=b;break}}
   if(langButton){await langButton.click();await sleep(300);r.languageMenu=await page.evaluate(()=>({buttons:[...document.querySelectorAll('button')].map(e=>e.textContent.trim()),links:[...document.querySelectorAll('a[href]')].filter(e=>/fr|en|kab|ar/.test(e.getAttribute('hreflang')||'')||/français|english|العربية|tamazi/i.test(e.textContent)).map(e=>({text:e.textContent.trim(),url:e.href}))}));await page.keyboard.press('Escape')}
   const toggles=await page.$$('button[aria-label]');for(const b of toggles){const label=await b.evaluate(e=>e.getAttribute('aria-label'));if(/menu/i.test(label)){await b.click();await sleep(200);r.mobileMenu={label,after:await page.evaluate(()=>document.body.innerText.slice(0,2000))};await page.keyboard.press('Escape');break}}
  }
  records.push(r);await writeFile(`${root}/manual.json`,JSON.stringify({startedAt:records[0]?.at,records},null,2));console.log(entry.type,'reviewed');
 }
}finally{await browser.close()}
