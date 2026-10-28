// Offline review aid, not a scoring tool. Raw DOM and source files stay private.
import {readFile} from 'node:fs/promises';
const id=process.argv[2];if(!id)throw Error('Ministry id required');
const root=(process.env.EVIDENCE_ROOT??'evidence/national-campaign-2026-10-20')+'/'+id;
const raw=JSON.parse(await readFile(root+'/report.json'));
const normal=JSON.parse(await readFile(root+'/manual-followup.json'));
console.log(id,normal.completedAt?'FOLLOW-UP COMPLETE':'FOLLOW-UP INCOMPLETE');
for(const r of normal.records){
 console.log('\nPAGE',r.type,r.url,r.dom?.title,r.error??'');if(!r.dom)continue;
 const lines=r.dom.text.split('\n').map(s=>s.trim()).filter(Boolean);
 console.log('LANG',r.dom.lang,'WIDTHS',JSON.stringify(r.viewports));
 console.log('HEADINGS',JSON.stringify(r.dom.headings.slice(0,10)));
 console.log('CONTENT',r.type==='homepage'?lines.filter(s=>/(@|\b20(?:2[0-6]|1[0-9])\b|mission|organisation|attributions|contact|téléphone|phone|مهام|اتصل|صلاحيات|هاتف|وزارة|خدمة|التعريف)/i.test(s)).slice(0,25).join('\n'):r.dom.text.slice(0,6500));
 console.log('FOOTER',lines.slice(-18).join('\n'));
 console.log('FORMS',JSON.stringify(r.dom.forms.map(f=>({method:f.method,action:f.action,inputs:f.inputs.filter(i=>i.type!=='hidden'),text:f.text.slice(0,500)}))));
 console.log('AXE',JSON.stringify(r.axe?.violations.map(v=>({id:v.id,count:v.nodes.length,example:v.nodes.slice(0,1)}))));
 const p=raw.pages.find(p=>p.type===r.type);console.log('GUARDED META',Object.entries(p.observations??{}).map(([profile,o])=>({profile,title:o.title,description:o.description,lang:o.lang,canonical:o.canonical,landmarks:o.semanticLandmarks})));
}
