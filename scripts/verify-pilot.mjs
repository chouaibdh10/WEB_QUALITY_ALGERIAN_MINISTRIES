import {pilotSummaries} from '../src/data/pilotSummaries.js';
import assert from 'node:assert/strict';import{readFile,readdir}from'node:fs/promises';import{rubric}from'./quality/rubric.mjs';
for(const file of (await readdir('public/evaluations')).filter(f=>f.endsWith('-pilot.json'))){
const report=JSON.parse(await readFile('public/evaluations/'+file,'utf8'));
assert.equal(pilotSummaries[report.ministryId].points,report.points);assert.equal(pilotSummaries[report.ministryId].assessedPoints,report.assessedPoints);
assert.equal(report.overallScore,null);assert.equal(report.rank,null);assert.equal(report.independentReview,'Pending');
const rows=report.categories.flatMap(c=>c.rows);assert.equal(rows.length,57);assert.equal(new Set(rows.map(r=>r.id)).size,57);
for(const category of rubric){const actual=report.categories.find(c=>c.key===category.key);assert.equal(actual.maxPoints,category.maxPoints);for(const expected of category.rows){const r=actual.rows.find(r=>r.id===expected.id);assert.equal(r.maxPoints,expected.maxPoints);assert.ok([null,0,r.maxPoints/2,r.maxPoints].includes(r.points));assert.ok(r.reason.length>20&&r.evidence.length);assert.equal(r.points===null,r.status==='unmeasured');}assert.equal(actual.points,actual.rows.reduce((s,r)=>s+(r.points??0),0));assert.equal(actual.assessedPoints,actual.rows.reduce((s,r)=>s+(r.points===null?0:r.maxPoints),0));}
assert.equal(report.categories.reduce((s,c)=>s+c.maxPoints,0),100);assert.equal(report.points,report.categories.reduce((s,c)=>s+c.points,0));assert.equal(report.assessedPoints,report.categories.reduce((s,c)=>s+c.assessedPoints,0));assert.ok(report.points<=report.assessedPoints);assert.ok(report.assessedPoints<100);assert.ok(report.categories.find(c=>c.key==='reliability').rows.every(r=>r.points===null));
for(const metric of report.metrics){assert.ok(metric.runs>=0&&metric.runs<=3);for(const k of ['lcp','cls','tbt','fcp'])assert.ok(metric[k]===null||Number.isFinite(metric[k]));}
const serialized=JSON.stringify(report);assert.ok(!/"(?:authorization|set-cookie|requestBody|postData|html|snippet|cookieValue)"\s*:/i.test(serialized));
console.log(`Verified ${report.ministryId}, 57 criteria: ${report.points}/${report.assessedPoints} confirmed; ${100-report.assessedPoints} points unmeasured. No final score/rank or private request data.`);

}
