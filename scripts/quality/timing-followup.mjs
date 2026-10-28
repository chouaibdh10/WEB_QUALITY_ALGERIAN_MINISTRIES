import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validLabDocument} from './lab-validity.mjs';
const median=xs=>{xs=[...xs].sort((a,b)=>a-b);return xs.length?xs.length%2?xs[(xs.length-1)/2]:(xs[xs.length/2-1]+xs[xs.length/2])/2:null};
const fields={lcp:'largest-contentful-paint',cls:'cumulative-layout-shift',tbt:'total-blocking-time',fcp:'first-contentful-paint',ttfb:'server-response-time',transferBytes:'total-byte-weight'};
// Separate campaign: never merge browser versions, prior runs or incomplete samples into scores.
export async function timingFollowup(root){
 const raw=JSON.parse(await readFile(root+'/report.json'));const metrics=[],artifacts=['report.json'];const profiles={};let attemptedRuns=0;
 for(const page of raw.pages)for(const profile of ['mobile','desktop']){
  const samples=[];const attempts=page.performance?.[profile]?.runs??[];assert.ok(attempts.length<=3);assert.equal(new Set(attempts.map(a=>a.index)).size,attempts.length);assert.ok(attempts.every(a=>Number.isInteger(a.index)&&a.index>=1&&a.index<=3));attemptedRuns+=attempts.length;
  for(const attempt of attempts){
   if(attempt.status!=='Collected')continue;
   const file=`${page.id}/${profile}-lighthouse-${attempt.index}.json`,lhr=JSON.parse(await readFile(root+'/'+file));
   assert.ok(validLabDocument(lhr,[new URL(page.url).origin]),file);assert.equal(lhr.lighthouseVersion,raw.versions.lighthouse);
   const browserVersion=raw.versions.chrome.split('/')[1];assert.ok(lhr.environment.hostUserAgent.includes('Chrome/'+browserVersion.split('.')[0]+'.'),'Actual browser major version must match the declared follow-up (Chrome reduces UA minor/build versions)');
   const settings={screen:lhr.configSettings.screenEmulation,throttling:lhr.configSettings.throttling,throttlingMethod:lhr.configSettings.throttlingMethod,formFactor:lhr.configSettings.formFactor,userAgent:lhr.environment.networkUserAgent};
   if(profiles[profile])assert.deepEqual(settings,profiles[profile]);else profiles[profile]=settings;
   const sample=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,lhr.audits[v]?.numericValue]));sample.requests=lhr.audits['network-requests'].details.items.length;assert.ok(Object.values(sample).every(Number.isFinite));samples.push(sample);artifacts.push(file);
  }
  const lcps=samples.map(s=>s.lcp);metrics.push({page:page.type,profile,runs:samples.length,plannedRuns:3,...Object.fromEntries([...Object.keys(fields),'requests'].map(k=>[k,median(samples.map(s=>s[k]))])),lcpMin:lcps.length?Math.min(...lcps):null,lcpMax:lcps.length?Math.max(...lcps):null});
 }
 const successfulRuns=metrics.reduce((n,m)=>n+m.runs,0),plannedRuns=raw.pages.length*6;
 if(raw.halted)assert.match(raw.halted,/HTTP 429/,'Only the reviewed rate-limit stop is supported by this follow-up publisher');
 return {publicRecord:{startedAt:raw.startedAt,completedAt:raw.completedAt,versions:raw.versions,profiles,plannedRuns,attemptedRuns,successfulRuns,excludedAttempts:attemptedRuns-successfulRuns,unattemptedRuns:plannedRuns-attemptedRuns,complete:metrics.every(m=>m.runs===3),affectsScore:false,stopReason:raw.halted?'Collection stopped after a third-party HTTP 429 rate-limit response. Remaining runs were not attempted. No rate limit was bypassed.':null,interpretation:'Separate follow-up campaign; historical main-sample timings and scores are unchanged. Incomplete page/device groups are observations, not a completed performance score. TBT is a laboratory proxy, not measured field INP.',metrics},artifacts};
}
