// Resumable foreground campaign. Collection stages must not overlap timing runs.
import {readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const manifestPath='docs/pilots/national-campaign-manifest.json';
const manifest=JSON.parse(await readFile(manifestPath));
const run=(args,env={})=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,...env}});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(args[0]+' exited '+code)));});
const samePages=(a,b)=>JSON.stringify(a.map(p=>[p.type,p.url]))===JSON.stringify(b.map(p=>[p.type,p.url]));
const deadline=Date.now()+3*60*60*1000;
for(const t of manifest.targets){
 while(true){
  let ready=false;
  try{const raw=JSON.parse(await readFile(t.root+'/report.json'));if(!samePages(raw.pages,t.pages))throw Error('Page manifest mismatch: '+t.id);ready=Boolean(raw.observationsCompletedAt)}catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error}
  if(ready)break;
  if(Date.now()>deadline)throw Error('Observation stage incomplete; no timing runs launched');
  await new Promise(resolve=>setTimeout(resolve,15000));
 }
 let complete=false;
 try{const normal=JSON.parse(await readFile(t.root+'/manual-followup.json'));complete=Boolean(normal.completedAt)&&samePages(normal.records,t.pages)}catch{}
 if(!complete)await run(['scripts/manual-revision-batch.mjs',t.id],{PILOT_MANIFEST:manifestPath});
}
console.log('Normal-browser collection complete. Starting sequential timing attempts.');
await run(['scripts/collect-additional-pilots.mjs',manifestPath,'timings']);
await writeFile('evidence/national-campaign-2026-10-20/collection-completed.json',JSON.stringify({at:new Date().toISOString(),targets:manifest.targets.map(t=>t.id),note:'Collection complete; row-specific evaluator review and publication are separate required stages.'},null,2),{mode:0o600});
console.log('All declared collection attempts finished. Review and publication still required.');
