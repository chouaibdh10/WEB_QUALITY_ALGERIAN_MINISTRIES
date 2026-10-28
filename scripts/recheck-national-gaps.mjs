// One read-only retry per previously observed entry, after timing collection ends.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createCollector} from './quality/network.mjs';
const coordinator=Number(process.argv[2]);
if(!Number.isInteger(coordinator)||coordinator<1)throw Error('Collection coordinator PID required');
const campaign='evidence/national-campaign-2026-10-20';
const root=campaign+'/gap-rechecks';await mkdir(root,{recursive:true,mode:0o700});
const plan=JSON.parse(await readFile('docs/pilots/national-recovery-plan.json'));
const alive=()=>{try{process.kill(coordinator,0);return true}catch{return false}};
const deadline=Date.now()+8*60*60*1000;
while(true){
 let complete=false;try{const marker=JSON.parse(await readFile(campaign+'/collection-completed.json'));complete=Boolean(marker.at)}catch(e){if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))throw e}
 if(complete)break;
 if(!alive()||Date.now()>deadline)throw Error('Timing batch incomplete; gap rechecks withheld');
 await new Promise(resolve=>setTimeout(resolve,15000));
}
const entries=[];
for(const spec of plan.entries){
 let old;try{old=JSON.parse(await readFile(root+'/'+spec.id+'.json'));if(old.completedAt){entries.push(old);continue}}catch(e){if(e.code!=='ENOENT')throw e}
 const record={id:spec.id,url:spec.url,source:spec.source,note:spec.note,startedAt:new Date().toISOString()};
 const collector=createCollector({origins:spec.origins,delayMs:1500,timeoutMs:20000,maxBytes:2*1024*1024});
 try{
  record.response=await collector.request(spec.url,{body:true});
  record.status=record.response.status===200?'HTTP document recovered; substantive browser review required':'Collection gap';
  record.reason=record.response.status===200?'A trusted-policy HTTP response is supporting discovery evidence only. No page/device metrics, accessibility pass or ministry score follows from this retry.':'Non-successful document response retained; no outage or zero score inferred.';
 }catch(error){record.status='Collection gap';record.reason=error.message}
 record.robots=collector.robotsEvidence;record.completedAt=new Date().toISOString();
 await writeFile(root+'/'+spec.id+'.json',JSON.stringify(record,null,2)+'\n',{mode:0o600});entries.push(record);
 console.log(spec.id,record.status);
}
await writeFile(root+'/summary.json',JSON.stringify({completedAt:new Date().toISOString(),entries:entries.map(({id,url,status,reason,completedAt})=>({id,url,status,reason,completedAt})),unresolved:plan.unresolved,note:'Original discovery evidence is retained. Recovered HTTP responses require predeclared page selection, browser collection and evaluator review before any score.'},null,2)+'\n',{mode:0o600});
