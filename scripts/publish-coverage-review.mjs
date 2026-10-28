// Additive evaluator decisions; existing reviewed awards and original raw files are preserved.
import {readFile,writeFile,copyFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {acceptedRetainedLabDocument} from './quality/reviewed-lab-validity.mjs';
import {timingFollowup} from './quality/timing-followup.mjs';
import {writePilotIndexes} from './quality/publication.mjs';
const root='evidence/coverage-review-2026-10-26',date=new Date().toISOString();
const roots=JSON.parse(await readFile('evidence/completion-review-2026-10-21/roots.json'));
const decisions=JSON.parse(await readFile('docs/pilots/coverage-review-decisions-2026-10-26.json'));
const structuralDecisions=JSON.parse(await readFile('docs/pilots/structural-review-decisions-2026-10-28.json'));
for(const [id,rows] of Object.entries(structuralDecisions)){decisions[id]??={};for(const[key,decision]of Object.entries(rows)){assert.ok(!decisions[id][key],'A new review must not silently overwrite a prior decision');decisions[id][key]=decision}}
const previous=JSON.parse(await readFile('public/evaluations/completion-review-2026-10-21.json'));
const hash=b=>createHash('sha256').update(b).digest('hex');const median=xs=>{xs=[...xs].sort((a,b)=>a-b);return xs.length%2?xs[(xs.length-1)/2]:(xs[xs.length/2-1]+xs[xs.length/2])/2};
await mkdir(root+'/baseline-reports',{recursive:true,mode:0o700});
const reports={},entries=[];
// Prepare the whole batch before publishing any report.
for(const [id,rawRoot] of Object.entries(roots)){
 const baseline=root+'/baseline-reports/'+id+'.json';try{await access(baseline)}catch(e){if(e.code!=='ENOENT')throw e;await copyFile('public/evaluations/'+id+'-pilot.json',baseline)}
 const report=JSON.parse(await readFile(baseline));const supplementary=JSON.parse(await readFile(root+'/'+id+'-supplementary.json'));assert.ok(supplementary.completedAt);
 await copyFile(root+'/'+id+'-supplementary.json',rawRoot+'/coverage-supplementary-2026-10-26.json');
 const formSource='evidence/coverage-review-2026-10-28/'+id+'-mobile-forms.json';let formReview=null;
 try{formReview=JSON.parse(await readFile(formSource));assert.ok(formReview.completedAt);await copyFile(formSource,rawRoot+'/mobile-form-review-2026-10-28.json');for(const width of [320,390,844])if(formReview.representative)await copyFile('evidence/coverage-review-2026-10-28/'+id+'-form-'+width+'.png',rawRoot+'/mobile-form-'+width+'-2026-10-28.png')}catch(e){if(e.code!=='ENOENT')throw e}
 const rows=report.categories.flatMap(c=>c.rows);const changes=[];const before={points:report.points,assessedPoints:report.assessedPoints};
 for(const [key,decision] of Object.entries(decisions[id]??{})){
  const row=rows.find(r=>r.id===key);assert.ok(row);assert.equal(row.points,null,`${id}/${key}: already scored`);assert.ok([0,row.maxPoints/2,row.maxPoints].includes(decision.points));
  for(const ref of decision.evidence)await access(rawRoot+'/'+ref.split('#')[0]);
  Object.assign(row,decision,{status:decision.points===row.maxPoints?'full':decision.points===0?'zero':'partial'});changes.push({criterion:key,before:null,...decision,budget:row.maxPoints});
 }
 const artifacts=['coverage-supplementary-2026-10-26.json'];
 for(const decision of Object.values(structuralDecisions[id]??{}))artifacts.push(...decision.evidence.map(ref=>ref.split('#')[0]));
 if(formReview){artifacts.push('mobile-form-review-2026-10-28.json');if(formReview.representative)for(const width of [320,390,844])artifacts.push('mobile-form-'+width+'-2026-10-28.png')}
 if(['industry','energy-renewable-energies'].includes(id))artifacts.push('input-mode-review-2026-10-28.json');

 if(decisions[id]?.['content.identity']?.evidence.includes('government-directory-review-2026-10-28.json')){
  const identity=JSON.parse(await readFile(rawRoot+'/government-directory-review-2026-10-28.json'));
  assert.equal(new URL(identity.target).hostname.replace(/^www\./,''),new URL(report.pages.find(p=>p.type==='homepage').url).hostname.replace(/^www\./,''));
  assert.equal(identity.sourceSha256,hash(await readFile(rawRoot+'/turkiye-trade-algeria-may-2026.pdf')));
  report.ownership={status:'Government directory confirmed',source:identity.source+'#page='+identity.page,checkedAt:identity.checkedAt,publisher:identity.sourcePublisher,evidence:'government-directory-review-2026-10-28.json',note:identity.limitations};
  artifacts.push('government-directory-review-2026-10-28.json','turkiye-trade-algeria-may-2026.pdf','directory-layout.xml');
 }

 if(id==='youth'){
  const raw=JSON.parse(await readFile(rawRoot+'/report.json'));const reviews=JSON.parse(await readFile(rawRoot+'/rendered-lab-review-2026-10-26.json'));const metrics=[],pairs=[];
  const fields={lcp:'largest-contentful-paint',cls:'cumulative-layout-shift',tbt:'total-blocking-time',fcp:'first-contentful-paint',ttfb:'server-response-time',transferBytes:'total-byte-weight'};
  for(const page of raw.pages)for(const profile of ['mobile','desktop']){
   const samples=[];
   for(const index of [1,2,3]){
    const artifact=`${page.id}/${profile}-lighthouse-${index}.json`,bytes=await readFile(rawRoot+'/'+artifact),lhr=JSON.parse(bytes);
    assert.ok(acceptedRetainedLabDocument(lhr,[new URL(page.url).origin],bytes,reviews.runs[artifact]),artifact);
    assert.deepEqual(lhr.configSettings.screenEmulation,report.measurementProfiles[profile].screen);assert.deepEqual(lhr.configSettings.throttling,report.measurementProfiles[profile].throttling);
    const sample=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,lhr.audits[v]?.numericValue]));sample.requests=lhr.audits['network-requests'].details.items.length;assert.ok(Object.values(sample).every(Number.isFinite));samples.push(sample);
   }
   const m={page:page.type,profile,...Object.fromEntries(Object.keys(samples[0]).map(k=>[k,median(samples.map(s=>s[k]))])),runs:3,lcpMin:Math.min(...samples.map(s=>s.lcp)),lcpMax:Math.max(...samples.map(s=>s.lcp))};metrics.push(m);pairs.push({...m,ratio:m.lcpMax/m.lcpMin});
  }
  assert.equal(metrics.length,6);const worst=k=>Math.max(...pairs.map(p=>p[k]));
  const rules={lcp:worst('lcp')<=2500?4:worst('lcp')<=4000?2:0,responsiveness:worst('tbt')<=200?3:worst('tbt')<=600?1.5:0,cls:worst('cls')<=.1?3:worst('cls')<=.25?1.5:0,'server-content':worst('fcp')<=1800&&worst('ttfb')<=800?2:worst('fcp')<=3000&&worst('ttfb')<=1800?1:0,resources:worst('transferBytes')<=2e6&&worst('requests')<=80?2:worst('transferBytes')<=4e6&&worst('requests')<=150?1:0,consistency:worst('ratio')<=1.5?1:worst('ratio')<=2?.5:0};
  for(const [key,points] of Object.entries(rules)){
   const row=rows.find(r=>r.id==='performance.'+key);assert.equal(row.points,null);
   const reason=`Recovered all 18 original valid rendered-application runs after exact per-file and per-screenshot review corrected a false HTML-size exclusion. The unchanged frozen ${key} threshold is applied to the worst three-run page/device median (or original spread rule). No timing or profile was changed; original exclusion notes remain retained. TBT remains a laboratory proxy, not field INP.`;
   Object.assign(row,{points,status:points===row.maxPoints?'full':points===0?'zero':'partial',reason,evidence:['rendered-lab-review-2026-10-26.json','coverage-review-decisions-2026-10-26.json#recoveredMetrics']});changes.push({criterion:row.id,before:null,points,budget:row.maxPoints,reason,evidence:row.evidence});
  }
  report.metrics=metrics;report.collectionNotes=report.collectionNotes.map(n=>/703|tiny|nonrepresentative|18.*invalid|invalid.*18/i.test(n)?'Historical exclusion note, superseded by the explicit rendered-document review: '+n:n);
  report.collectionNotes.push('26 October correction: all 18 retained Youth timing screenshots show substantive ministry content. Exact-source visual review corrects the 703-byte-bootstrap false exclusion. Existing raw files, original N/M annotations and failed-attempt history remain unchanged. See the coverage-revision protocol.');
  report.findings=report.findings.filter(f=>!/timing|performance.*unmeasured|invalid.*document/i.test(f.title+' '+f.detail));
  report.findings.unshift({title:'Recovered mobile loading evidence',detail:`The original three-run mobile homepage LCP median is ${(metrics.find(m=>m.page==='homepage'&&m.profile==='mobile').lcp/1000).toFixed(2)} seconds. The rendered application was incorrectly excluded by the collector's HTML byte-size heuristic; the source timings are unchanged.`});
  artifacts.push('rendered-lab-review-2026-10-26.json');
  report.recoveredLabRuns={count:18,originalSourceUnchanged:true,reviewedAt:date,protocol:'/evaluations/coverage-review-2026-10-26.md'};
 }
 if(id==='foreign-affairs'){
  const source=root+'/foreign-affairs-timing-attempt-2',subdir='timing-followup-2026-10-26';
  const followup=await timingFollowup(source);report.timingFollowup=followup.publicRecord;
  for(const file of followup.artifacts){await mkdir(rawRoot+'/'+subdir+'/'+file.split('/').slice(0,-1).join('/'),{recursive:true,mode:0o700});await copyFile(source+'/'+file,rawRoot+'/'+subdir+'/'+file);artifacts.push(subdir+'/'+file)}
 }
 if(id==='foreign-affairs'){
  const source='evidence/coverage-review-2026-10-28/foreign-affairs-timing',subdir='timing-remeasurement-2026-10-28';let fresh=null;
  try{fresh=JSON.parse(await readFile(source+'/report.json'))}catch(e){if(e.code!=='ENOENT')throw e}
  if(fresh?.completedAt){
   const followup=await timingFollowup(source);
   for(const file of [...followup.artifacts,'preflight.json']){await mkdir(rawRoot+'/'+subdir+'/'+file.split('/').slice(0,-1).join('/'),{recursive:true,mode:0o700});await copyFile(source+'/'+file,rawRoot+'/'+subdir+'/'+file);artifacts.push(subdir+'/'+file)}
   if(followup.publicRecord.complete){
    assert.equal(followup.publicRecord.successfulRuns,18);assert.equal(followup.publicRecord.excludedAttempts,0);assert.equal(followup.publicRecord.stopReason,null);
    report.labSourceReplacement={directory:subdir,startedAt:fresh.startedAt,completedAt:fresh.completedAt,previousMainSource:'report.json',previousMainMetrics:report.metrics,previousConditions:report.conditions,reason:'A separate, fully declared 18-run campaign completed all three original pages and both device profiles. The historical single successful main-sample run and all earlier stopped attempts are retained, not merged or selectively retried.'};
    report.metrics=followup.publicRecord.metrics.map(({plannedRuns,...m})=>m);report.measurementProfiles=followup.publicRecord.profiles;report.labCompletedAt=fresh.completedAt;
    report.conditions='28 October 2026 separate full remeasurement: Lighthouse '+fresh.versions.lighthouse+'; '+fresh.versions.chrome+'; three fresh-process simulated-throttling runs per original page/device pair. Operator workstation; physical network/geography unverified. No physical-device, field-INP or complete-service claim.';
    const pairs=report.metrics;assert.equal(pairs.length,6);const worst=k=>Math.max(...pairs.map(p=>p[k]));const ratio=Math.max(...pairs.map(p=>p.lcpMax/p.lcpMin));
    const rules={lcp:worst('lcp')<=2500?4:worst('lcp')<=4000?2:0,responsiveness:worst('tbt')<=200?3:worst('tbt')<=600?1.5:0,cls:worst('cls')<=.1?3:worst('cls')<=.25?1.5:0,'server-content':worst('fcp')<=1800&&worst('ttfb')<=800?2:worst('fcp')<=3000&&worst('ttfb')<=1800?1:0,resources:worst('transferBytes')<=2e6&&worst('requests')<=80?2:worst('transferBytes')<=4e6&&worst('requests')<=150?1:0,consistency:ratio<=1.5?1:ratio<=2?.5:0};
    for(const[key,points]of Object.entries(rules)){const row=rows.find(r=>r.id==='performance.'+key);assert.equal(row.points,null);const reason='All 18 declared 28 October timing runs are valid across the three original pages and mobile/desktop profiles. The unchanged frozen '+key+' threshold uses the worst three-run page/device median (or repetition-spread rule). Older incomplete campaigns are preserved separately. TBT remains a lab proxy, not measured field INP.';Object.assign(row,{points,status:points===row.maxPoints?'full':points===0?'zero':'partial',reason,evidence:[subdir+'/report.json','coverage-review-decisions-2026-10-26.json#changes']});changes.push({criterion:row.id,before:null,points,budget:row.maxPoints,reason,evidence:row.evidence})}
    report.collectionNotes=report.collectionNotes.map(n=>/timing attempts recorded|Collection stopped|Completion review/.test(n)?'Historical original-sample note, superseded for timing coverage by the 28 October full remeasurement: '+n:n);
    report.findings.push({title:'Repeated mobile loading measurements',detail:'The worst mobile page LCP median in the separate 28 October campaign is '+(Math.max(...report.metrics.filter(m=>m.profile==='mobile').map(m=>m.lcp))/1000).toFixed(2)+' seconds across three repeated runs per page. This is a simulated laboratory result, not field-user telemetry.'});
    report.collectionNotes.push('28 October full remeasurement completed the entire 18-run performance sample; the main timing table and performance rows now use that separate Chrome 156 campaign. Historical timings and earlier failures remain retained in labSourceReplacement and private artifacts. This resolves performance sampling only, not all criteria.');
   }else{
    report.previousTimingFollowups=[report.timingFollowup];report.timingFollowup=followup.publicRecord;report.collectionNotes.push('28 October separate timing retry remains incomplete. Its valid observations are shown separately; historical main-sample timings and performance scores remain unchanged. Earlier 26 October follow-up observations are retained in previousTimingFollowups.');
   }
  }
 }
 if(id==='national-defence'){
  const source='evidence/coverage-review-2026-10-28/defence-robots-refresh.json';let refresh=null;try{refresh=JSON.parse(await readFile(source))}catch(e){if(e.code!=='ENOENT')throw e}
  if(refresh?.response?.status===200){assert.ok(refresh.body.includes('Disallow: /site_principal/css/'));assert.ok(refresh.body.includes('Disallow: /site_principal/js/'));await copyFile(source,rawRoot+'/robots-refresh-2026-10-28.json');artifacts.push('robots-refresh-2026-10-28.json');report.constraintReview={checkedAt:refresh.at,source:'https://www.mdn.dz/robots.txt',reason:'The refreshed public robots policy still explicitly excludes the sampled site CSS and JavaScript directories. No excluded resource was retrieved and no stylesheet-free performance result is scored.',evidence:'robots-refresh-2026-10-28.json'};report.collectionNotes.push('28 October policy refresh: Defence still excludes the sampled CSS and JavaScript paths in robots.txt. Its six performance criteria remain unmeasured because representative automated loading cannot be collected under the declared protocol. This is a collection constraint, not a zero score or proof of website outage.');}
 }
 for(const c of report.categories){c.points=c.rows.reduce((s,r)=>s+(r.points??0),0);c.assessedPoints=c.rows.reduce((s,r)=>s+(r.points===null?0:r.maxPoints),0)}
 report.points=report.categories.reduce((s,c)=>s+c.points,0);report.assessedPoints=report.categories.reduce((s,c)=>s+c.assessedPoints,0);
 const requirements=new Map(previous.entries.find(e=>e.id===id).unresolved.map(r=>[r.criterion,r.requiredEvidence]));
 const unresolved=rows.filter(r=>r.points===null).map(r=>({criterion:r.id,budget:r.maxPoints,requiredEvidence:requirements.get(r.id)??r.reason}));
 const decisionFile='coverage-review-decisions-2026-10-26.json';await writeFile(rawRoot+'/'+decisionFile,JSON.stringify({id,reviewedAt:date,changes,unresolved,...(id==='youth'?{recoveredMetrics:report.metrics}:{})},null,2)+'\n',{mode:0o600});artifacts.push(decisionFile);
 for(const artifact of new Set(artifacts)){const bytes=await readFile(rawRoot+'/'+artifact);report.evidence.artifactHashes.push({artifact,sha256:hash(bytes)})}
 report.reviewedAt=date;report.independentReview='Pending';report.overallScore=null;report.rank=null;
 report.completionReview={...report.completionReview,reviewedAt:date,changedCriteria:report.completionReview.changedCriteria+changes.length,additionalAssessedPoints:report.completionReview.additionalAssessedPoints+report.assessedPoints-before.assessedPoints,remainingCriteria:unresolved.length,remainingPoints:100-report.assessedPoints,protocol:'/evaluations/coverage-review-2026-10-26.md',record:'/evaluations/coverage-review-2026-10-26.json'};
 report.collectionNotes??=[];report.collectionNotes.push(`Coverage revision ${date.slice(0,10)}: ${changes.length} further criteria resolved using explicit reviewed evidence. Restricted, untested and monitoring-dependent criteria remain unmeasured. Scores and measurement coverage are different quantities; no conversion of missing evidence to passes or zeros.`);
 reports[id]=report;entries.push({id,before,after:{points:report.points,assessedPoints:report.assessedPoints},resolvedCriteria:changes.length,changes,unresolved,supplementary:{attempted:supplementary.records.length,representative:supplementary.records.filter(r=>r.representative).length,restricted:supplementary.records.filter(r=>/Web Page Blocked/i.test(r.dom?.title??'')).length}});
}
const summary={schemaVersion:1,reviewedAt:date,protocol:'/evaluations/coverage-review-2026-10-26.md',reports:entries.length,resolvedCriteria:entries.reduce((s,e)=>s+e.resolvedCriteria,0),recoveredLabRuns:18,allCriteriaMeasured:false,independentReview:'Pending',interpretation:'An additional evidence review, not a complete evaluation or rank. Youth original timings are recovered by explicit rendered-document review, without changing source data or thresholds. Access-restricted, monitoring-dependent, untested and remaining manual criteria retain unmeasured budgets. Missing evidence is not a failure or a pass.',entries};
for(const [id,report] of Object.entries(reports))await writeFile('public/evaluations/'+id+'-pilot.json',JSON.stringify(report,null,2)+'\n');
await writePilotIndexes(reports);await writeFile('public/evaluations/coverage-review-2026-10-26.json',JSON.stringify(summary,null,2)+'\n');await copyFile('docs/pilots/coverage-review-2026-10-26.md','public/evaluations/coverage-review-2026-10-26.md');console.log(JSON.stringify({reports:summary.reports,resolvedCriteria:summary.resolvedCriteria,recoveredLabRuns:18}));
