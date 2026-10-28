// Publish an explicit status for every existing project portfolio, never a guessed score.
import {readFile,writeFile} from 'node:fs/promises';
import {ministries} from '../src/data/ministries.js';
const root='evidence/national-campaign-2026-10-20';
const read=async path=>{try{return JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}};
const manifest=await read('docs/pilots/national-campaign-manifest.json');
const entries=[];
for(const ministry of ministries){
 const published=await read(`public/evaluations/${ministry.id}-pilot.json`);
 const discovery=await read(`evidence/recovery-campaign-2026-10-21/${ministry.id}-discovery.json`)??await read(`${root}/${ministry.id}-discovery.json`);
 const recovery=await read('docs/pilots/recovery-campaign-manifest.json');
 const spec=(recovery?.targets??[]).find(t=>t.id===ministry.id)??manifest.targets.find(t=>t.id===ministry.id);
 let status,reason,stage;
 if(published){status='report-published';reason='Reviewed provisional page sample published. Unmeasured criteria and independent review remain explicit; no national rank.'}
 else if(discovery?.status==='Unresolved domain'){status='unresolved-domain';reason=discovery.note??'No independently established dedicated website in the project corpus. No domain or score was invented.'}
 else if(discovery?.status==='Collection gap'){status='collection-gap';reason=/robots/i.test(discovery.reason)?'The collector could not access the declared entry under its robots policy. This is a collection restriction, not evidence of a website outage or a zero score.':'The declared entry could not be collected under the trusted read-only protocol. No website score or availability conclusion is inferred.'}
 else {status='collecting';const raw=spec?await read(spec.root+'/report.json'):null;const normal=spec?await read(spec.root+'/manual-followup.json'):null;stage=raw?.completedAt?'awaiting-evaluator-review':normal?.completedAt?'timing-attempts':raw?.observationsCompletedAt?'normal-browser-follow-up':'page-observations';reason='Collection and review are in progress. No provisional numerical result is published before the declared attempts and evidence review finish.'}
 entries.push({id:ministry.id,name:ministry.name,status,...(stage?{stage}:{}),website:published?.pages.find(p=>p.type==='homepage')?.url??spec?.pages.find(p=>p.type==='homepage')?.url??discovery?.seed??null,checkedAt:published?.reviewedAt??discovery?.completedAt??null,ownership:published?.ownership?.status??discovery?.ownership?.status??'Unverified',reason,...(published?{report:published.download}:{}),score:published?.points??null});
}
const ledger={schemaVersion:1,updatedAt:new Date().toISOString(),scope:`Public directory of ${ministries.length} website entries. Two historical entries without a verified dedicated website were excluded on 21 October 2026; the research record is retained. This is not a claim about the exact current cabinet composition.`,published:entries.filter(e=>e.status==='report-published').length,collectionGaps:entries.filter(e=>e.status==='collection-gap').length,unresolved:entries.filter(e=>e.status==='unresolved-domain').length,inProgress:entries.filter(e=>e.status==='collecting').length,entries};
ledger.collectionAccountedFor=ledger.inProgress===0;
// A published report can still have substantial measurement gaps.
ledger.totalCriteria=0;ledger.assessedCriteria=0;ledger.fullyMeasured=0;ledger.reportsWithPendingCriteria=0;ledger.pendingCriteria=0;ledger.reportsWithPerformanceGaps=0;
for(const entry of ledger.entries){
 const report=await read(`public/evaluations/${entry.id}-pilot.json`);if(!report)continue;
 const rows=report.categories.flatMap(c=>c.rows);ledger.totalCriteria+=rows.length;ledger.assessedCriteria+=rows.filter(r=>r.points!==null).length;
 entry.assessedPoints=report.assessedPoints;entry.pendingCriteria=rows.filter(r=>r.points===null).length;
 entry.performanceComplete=report.categories.find(c=>c.key==='performance').rows.every(r=>r.points!==null);
 if(entry.pendingCriteria)ledger.reportsWithPendingCriteria++;else ledger.fullyMeasured++;
 ledger.pendingCriteria+=entry.pendingCriteria;if(!entry.performanceComplete)ledger.reportsWithPerformanceGaps++;
}
await writeFile('public/evaluations/campaign-status.json',JSON.stringify(ledger,null,2)+'\n');
await writeFile('src/data/campaignStatus.js','// Reviewed publication status only; private source records are excluded.\nexport const campaignStatus = '+JSON.stringify(ledger,null,2)+'\n');
console.log(JSON.stringify({published:ledger.published,collectionGaps:ledger.collectionGaps,unresolved:ledger.unresolved,inProgress:ledger.inProgress}));
