// Applies explicit evaluator decisions, never derives awards from tool pass counts.
import {readFile,writeFile,mkdir,copyFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {writePilotIndexes} from './quality/publication.mjs';
const roots=JSON.parse(await readFile('evidence/completion-review-2026-10-21/roots.json'));
const decisions=JSON.parse(await readFile('docs/pilots/completion-review/decisions.json'));
const baseline='evidence/completion-review-2026-10-21/baseline-reports';await mkdir(baseline,{recursive:true,mode:0o700});
const at=new Date().toISOString(), reports={}, entries=[];
// Validate the entire batch before changing any published report.
for(const [id,root] of Object.entries(roots)){
 const capture=JSON.parse(await readFile(root+'/completion-page-checks-2026-10-21.json'));assert.ok(capture.completedAt,`${id}: finish collection first`);
 for(const decision of Object.values(decisions[id]??{}))for(const ref of decision.evidence)await access(root+'/'+ref.split('#')[0]);
}
const pendingRequirement=row=>{
 if(row.id.startsWith('reliability.'))return 'Complete the declared 28-day multi-network observation log, including gaps and critical endpoints.';
 if(row.id==='security.tls-configuration')return 'Complete a trusted, non-invasive supported-protocol and cipher assessment; a negotiated TLS connection is insufficient.';
 if(row.id==='accessibility.complete-process')return 'Review the entire selected service process, including the destination service and authenticated/submission stages with an eligible test account.';
 if(['accessibility.form-access','mobile.mobile-forms','mobile.recovery','mobile.journey','content.service-function'].includes(row.id))return 'Complete the relevant task/form, error and recovery checks with a safe test fixture where submission or authentication is required; limited DOM inspection is insufficient for full credit.';
 if(row.id==='content.identity')return 'Establish the current sampled hostname through an independent primary government link or verified official migration chain; self-branding and legacy labels alone are insufficient.';
 if(row.id==='content.multilingual')return 'Compare substantive equivalent task content across the languages actually offered, including destination links.';
 if(row.id==='technical.obsolete-technology')return 'Establish the precise deployed public component version and verify its support status against a primary vendor source; a product name or old-looking page is insufficient.';
 if(row.id==='technical.site-search')return 'Complete a relevant benign query through an actually observed eligible search form and review the results. A missing eligible GET form is not a website failure.';
 if(row.id==='security.cookies')return 'Review the flags and client-side requirement of the cookies actually issued; absence in a constrained capture is insufficient.';
 if(['security.mixed-content','security.tracking','security.configuration-exposure','technical.broken-resources'].includes(row.id))return 'Review an adequate representative resource/content inventory and distinguish intrinsic faults from collector policy restrictions. An absence claim cannot be awarded from an incomplete or constrained capture.';
 if(row.id.startsWith('performance.'))return 'Complete three valid representative Lighthouse runs for every declared page/device pair in a separate sequential timing campaign. Original blocked, invalid and unattempted runs remain retained.';
 return 'Further row-specific manual evidence is required across the declared representative sample; this follow-up does not establish the complete criterion.';
};
for(const [id,root] of Object.entries(roots)){
 const path=`public/evaluations/${id}-pilot.json`, base=`${baseline}/${id}.json`;
 try{await access(base)}catch(e){if(e.code!=='ENOENT')throw e;await copyFile(path,base)}
 const report=JSON.parse(await readFile(base)), before={points:report.points,assessedPoints:report.assessedPoints};
 const capture=JSON.parse(await readFile(root+'/completion-page-checks-2026-10-21.json'));assert.ok(capture.completedAt,`${id}: finish collection first`);
 const rows=report.categories.flatMap(c=>c.rows), changes=[];
 for(const [key,decision] of Object.entries(decisions[id]??{})){
  const row=rows.find(r=>r.id===key);assert.ok(row,key);assert.equal(row.points,null,`${id}/${key}: explicit correction required for an existing award`);
  assert.ok([0,row.maxPoints/2,row.maxPoints].includes(decision.points));assert.ok(decision.reason.length>90);assert.ok(decision.evidence.length);
  for(const ref of decision.evidence)await access(root+'/'+ref.split('#')[0]);
  Object.assign(row,decision,{status:decision.points===row.maxPoints?'full':decision.points===0?'zero':'partial'});
  changes.push({criterion:key,before:null,after:row.points,budget:row.maxPoints,reason:row.reason,evidence:row.evidence});
 }
 for(const c of report.categories){c.points=c.rows.reduce((n,r)=>n+(r.points??0),0);c.assessedPoints=c.rows.reduce((n,r)=>n+(r.points===null?0:r.maxPoints),0)}
 report.points=report.categories.reduce((n,c)=>n+c.points,0);report.assessedPoints=report.categories.reduce((n,c)=>n+c.assessedPoints,0);
 const unresolved=rows.filter(r=>r.points===null).map(r=>({criterion:r.id,budget:r.maxPoints,requiredEvidence:pendingRequirement(r)}));
 const review={schemaVersion:1,id,reviewedAt:at,method:'Implementing-evaluator review of retained normal-browser evidence and additive read-only follow-up, using the unchanged full/half/zero protocol. No independent reviewer approval.',baseline:before,after:{points:report.points,assessedPoints:report.assessedPoints},changes,unresolved};
 const decisionFile='completion-review-decisions-2026-10-21.json';await writeFile(root+'/'+decisionFile,JSON.stringify(review,null,2)+'\n',{mode:0o600});
 const artifacts=[decisionFile,'completion-page-checks-2026-10-21.json'];
 for(const optional of ['completion-page-checks-attempt-1-2026-10-21.json','completion-search-check-2026-10-21.json','completion-search-check-attempt-1-2026-10-21.json','completion-homepage-390.png'])try{await access(root+'/'+optional);artifacts.push(optional)}catch(e){if(e.code!=='ENOENT')throw e}
 for(const artifact of artifacts){const bytes=await readFile(root+'/'+artifact);report.evidence.artifactHashes.push({artifact,sha256:createHash('sha256').update(bytes).digest('hex')})}
 report.reviewedAt=at;report.overallScore=null;report.rank=null;report.independentReview='Pending';
 const representative=capture.records.filter(r=>r.representative).length;
 report.completionReview={reviewedAt:at,changedCriteria:changes.length,additionalAssessedPoints:report.assessedPoints-before.assessedPoints,representativeFollowUpPages:representative,declaredPages:capture.records.length,remainingCriteria:unresolved.length,remainingPoints:100-report.assessedPoints,protocol:'/evaluations/completion-review-2026-10-21.md',record:'/evaluations/completion-review-2026-10-21.json'};
 report.collectionNotes??=[];
 report.collectionNotes.push(`Completion review ${at.slice(0,10)} of the 21 October follow-up: ${changes.length} previously unmeasured criteria resolved, adding ${report.assessedPoints-before.assessedPoints} assessed budget points. ${representative}/${capture.records.length} additional core-page follow-ups were representative; excluded captures and original attempts are retained. Prior valid timing samples are unchanged. ${unresolved.length} criteria remain unmeasured; see the completion record for required evidence.`);
 report.collectionNotes.push('Supplementary GET search tasks, where present, use observed search forms and do not expand the original Lighthouse timing sample. Retained visual comparison is explicitly distinguished from fresh capture. Collector connection failures, robots exclusions and incomplete responses are never website zeros.');
 const entry={id,before,after:{points:report.points,assessedPoints:report.assessedPoints},resolvedCriteria:changes.length,followUp:{startedAt:capture.startedAt,completedAt:capture.completedAt,representativePages:representative,declaredPages:capture.records.length,excluded:capture.records.filter(r=>!r.representative).map(r=>({role:r.type,reason:/robots/i.test(r.error??'')?'Robots-policy restriction':/Connection closed|detached|Target closed/i.test(r.error??'')?'Local browser collection failure':'Incomplete or nonrepresentative capture; excluded from scoring'}))},changes,unresolved};
 entries.push(entry);reports[id]=report;await writeFile(path,JSON.stringify(report,null,2)+'\n');
}
await writePilotIndexes(reports);
const summary={schemaVersion:1,reviewedAt:at,protocol:'/evaluations/completion-review-2026-10-21.md',reports:entries.length,resolvedCriteria:entries.reduce((n,r)=>n+r.resolvedCriteria,0),additionalAssessedPoints:entries.reduce((n,r)=>n+r.after.assessedPoints-r.before.assessedPoints,0),allCriteriaMeasured:entries.every(r=>r.unresolved.length===0),independentReview:'Pending',interpretation:'A completed follow-up batch is not a complete website evaluation. Confirmed points remain on the unchanged 100-point budget; unmeasured points are not failures. The 28-day multi-network monitoring period, constrained collections, complete service processes and remaining row-specific checks are explicit. Existing valid timing measurements are unchanged.',entries};
await writeFile('public/evaluations/completion-review-2026-10-21.json',JSON.stringify(summary,null,2)+'\n');await copyFile('docs/pilots/completion-review-2026-10-21.md','public/evaluations/completion-review-2026-10-21.md');
console.log(JSON.stringify({reports:summary.reports,resolvedCriteria:summary.resolvedCriteria,additionalAssessedPoints:summary.additionalAssessedPoints,allCriteriaMeasured:summary.allCriteriaMeasured}));
