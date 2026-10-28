// One-shot continuation of the authorized campaign. No publication before all gates pass.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,open,unlink,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';

const root='evidence/national-campaign-2026-10-20';
const receiptPath=root+'/publication-receipt.json';
const lockPath=root+'/publication.lock';
const collectorPid=Number(process.argv[2]);
if(!Number.isInteger(collectorPid)||collectorPid<1)throw Error('Running collection coordinator PID required');
const alive=pid=>{try{process.kill(pid,0);return true}catch{return false}};
try{const old=JSON.parse(await readFile(lockPath));if(alive(old.pid))throw Error('Publication continuation already running');await unlink(lockPath)}catch(e){if(e.code!=='ENOENT')throw e}
const lock=await open(lockPath,'wx',0o600);await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));await lock.close();
const manifest=JSON.parse(await readFile('docs/pilots/national-campaign-manifest.json'));
const reviews=JSON.parse(await readFile('docs/pilots/national-manual-review.json'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const baseline={};
for(const file of (await readdir('public/evaluations')).filter(f=>f.endsWith('-pilot.json')))baseline[file]=hash(await readFile('public/evaluations/'+file));
const state={startedAt:new Date().toISOString(),status:'waiting-for-collection',production:'https://algerian-ministries-web-quality.algerian-ministries-web-quality-index.workers.dev',originalReports:baseline,steps:[]};
const save=async()=>{await writeFile(receiptPath+'.tmp',JSON.stringify(state,null,2)+'\n',{mode:0o600});await rename(receiptPath+'.tmp',receiptPath)};
const run=async(label,command,args)=>{
 state.status=label;await save();const log=root+'/finish-'+label+'.log';const fd=await open(log,'w',0o600);
 try{await new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:['ignore',fd.fd,fd.fd],env:process.env});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(label+' exited '+code+'; inspect '+log)));});state.steps.push({step:label,completedAt:new Date().toISOString(),log});await save()}
 finally{await fd.close()}
};
const node=(label,...args)=>run(label,process.execPath,args);
const samePages=(a,b)=>JSON.stringify(a.map(p=>[p.type,p.url]))===JSON.stringify(b.map(p=>[p.type,p.url]));
let preview;
try{
 for(const t of manifest.targets)assert.ok(reviews[t.id]?.reviewedAt,'Missing explicit evaluator review: '+t.id);
 await save();const deadline=Date.now()+8*60*60*1000;
 while(true){
  let complete=false;try{const marker=JSON.parse(await readFile(root+'/collection-completed.json'));assert.deepEqual(marker.targets,manifest.targets.map(t=>t.id));complete=true}catch(e){if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))throw e}
  if(complete)break;
  if(!alive(collectorPid))throw Error('Collection coordinator stopped without completion marker; publication withheld');
  if(Date.now()>deadline)throw Error('Collection waiting deadline reached; publication withheld');
  await new Promise(resolve=>setTimeout(resolve,15000));
 }
 for(const t of manifest.targets){
  const raw=JSON.parse(await readFile(t.root+'/report.json'));const normal=JSON.parse(await readFile(t.root+'/manual-followup.json'));
  assert.ok(raw.completedAt&&normal.completedAt,t.id+' incomplete');assert.ok(samePages(raw.pages,t.pages)&&samePages(normal.records,t.pages),t.id+' page mismatch');
 }
 await node('review','scripts/review-national-campaign.mjs');
 for(const t of manifest.targets)await node('publish-'+t.id,'scripts/publish-additional-pilot.mjs',t.root);
 for(const[file,digest]of Object.entries(baseline))assert.equal(hash(await readFile('public/evaluations/'+file)),digest,'Previously published report changed: '+file);
 await node('status','scripts/publish-campaign-status.mjs');
 const ledger=JSON.parse(await readFile('public/evaluations/campaign-status.json'));
 assert.equal(ledger.entries.length,34);assert.equal(ledger.inProgress,0);assert.equal(ledger.published,23);assert.equal(ledger.collectionGaps,9);assert.equal(ledger.unresolved,2);
 state.counts={published:ledger.published,collectionGaps:ledger.collectionGaps,unresolved:ledger.unresolved};
 await node('verify-reports','scripts/verify-pilot.mjs');
 await node('recalculate','scripts/audit-published-evidence.mjs');
 await run('tests','npm',['run','test:measurement']);
 await run('build','npm',['run','build']);
 // Timing collection is now over. UI checks may safely launch Chrome.
 preview=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4174','--strictPort'],{stdio:'ignore'});
 preview.on('error',()=>{});
 const base='http://127.0.0.1:4174';let ready=false;
 for(let i=0;i<30;i++){try{ready=(await fetch(base)).ok}catch{}if(ready)break;await new Promise(resolve=>setTimeout(resolve,500))}
 assert.ok(ready,'Validation preview did not start');
 await node('ui-overview','scripts/verify-design-revision.mjs',base);
 await node('ui-profiles','scripts/verify-additional-pilots-ui.mjs',base);
 await node('ui-status','scripts/verify-campaign-ui.mjs',base);
 // User authorized the existing Cloudflare deployment. Any failed gate stops here.
 await run('deploy','npm',['run','deploy']);
 await node('verify-primary','scripts/verify-deployment.mjs',state.production);
 state.status='complete';state.completedAt=new Date().toISOString();state.revision=JSON.parse(await readFile('public/evaluations/results-revision.json'));await save();
 console.log('Campaign published and verified',JSON.stringify(state.counts),state.production);
}catch(error){state.status='failed';state.failedAt=new Date().toISOString();state.error=error.message;await save();console.error(error);process.exitCode=1}
finally{preview?.kill('SIGTERM');await unlink(lockPath).catch(()=>{})}
