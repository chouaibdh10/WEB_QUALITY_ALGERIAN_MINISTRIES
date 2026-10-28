import test from 'node:test';import assert from 'node:assert/strict';
import{mkdtemp,mkdir,writeFile,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';
import{timingFollowup}from'./timing-followup.mjs';
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'timing-followup-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(root+'/home');
 const raw={startedAt:'2026-10-26T08:59:08Z',completedAt:'2026-10-26T09:00:23Z',versions:{lighthouse:'13.5.0',chrome:'Chrome/156.0.8078.47'},halted:'HTTP 429 from third-party',pages:[{id:'home',type:'homepage',url:'https://ministry.example/',performance:{mobile:{runs:[1,2,3].map(index=>({index,status:'Collected'}))}}},{id:'contact',type:'contact',url:'https://ministry.example/contact',performance:{}}]};
 await writeFile(root+'/report.json',JSON.stringify(raw));
 for(const [i,n]of [30,10,20].entries()){
  const lhr={lighthouseVersion:'13.5.0',mainDocumentUrl:'https://ministry.example/',environment:{hostUserAgent:'HeadlessChrome/156.0.0.0',networkUserAgent:'Chrome/156.0.0.0'},configSettings:{screenEmulation:{width:412},throttling:{rttMs:150},throttlingMethod:'simulate',formFactor:'mobile'},audits:Object.fromEntries(['largest-contentful-paint','cumulative-layout-shift','total-blocking-time','first-contentful-paint','server-response-time','total-byte-weight'].map(k=>[k,{numericValue:n}]))};lhr.audits['network-requests']={details:{items:[{resourceType:'Document',statusCode:200,resourceSize:2000,url:'https://ministry.example/'}]}};
  await writeFile(`${root}/home/mobile-lighthouse-${i+1}.json`,JSON.stringify(lhr));
 }
 return root;
}
test('retains separate incomplete pairs, actual counts, non-selected median and range',async t=>{
 const root=await fixture(t);const{publicRecord:r,artifacts}=await timingFollowup(root);assert.equal(r.successfulRuns,3);assert.equal(r.plannedRuns,12);assert.equal(r.unattemptedRuns,9);assert.equal(r.affectsScore,false);assert.equal(r.complete,false);assert.equal(r.metrics[0].lcp,20);assert.equal(r.metrics[0].lcpMin,10);assert.equal(r.metrics[0].lcpMax,30);assert.equal(r.metrics[1].lcp,null);assert.equal(r.metrics[1].runs,0);assert.equal(artifacts.length,4);assert.match(r.stopReason,/429/);
});
test('rejects a successful iframe when the main document failed',async t=>{
 const root=await fixture(t);const{readFile}=await import('node:fs/promises');const p=root+'/home/mobile-lighthouse-1.json',r=JSON.parse(await readFile(p));r.audits['network-requests'].details.items[0].url='https://ministry.example/frame';await writeFile(p,JSON.stringify(r));await assert.rejects(timingFollowup(root));
});
test('rejects inconsistent browser major version and mixed throttling',async t=>{
 const root=await fixture(t);const{readFile}=await import('node:fs/promises');const p=root+'/home/mobile-lighthouse-2.json',r=JSON.parse(await readFile(p));r.environment.hostUserAgent='HeadlessChrome/153.0.0.0';await writeFile(p,JSON.stringify(r));await assert.rejects(timingFollowup(root),/browser major version/);r.environment.hostUserAgent='HeadlessChrome/156.0.0.0';r.configSettings.throttling.rttMs=0;await writeFile(p,JSON.stringify(r));await assert.rejects(timingFollowup(root));
});
