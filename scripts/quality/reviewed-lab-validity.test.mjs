import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {acceptedRetainedLabDocument} from './reviewed-lab-validity.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
test('small rendered documents need an exact source and screenshot review; errors and iframe substitutes stay excluded',()=>{
 const url='https://ministry.example/contact';const report={mainDocumentUrl:url,audits:{'network-requests':{details:{items:[{url,statusCode:200,resourceType:'Document',resourceSize:703}]}},'final-screenshot':{details:{data:'data:image/jpeg;base64,reviewed'}}}};
 const bytes=Buffer.from(JSON.stringify(report));const receipt={type:'rendered-main-document-review',accepted:true,screenshotReviewed:true,reviewedAt:'2026-10-26T00:00:00Z',reason:'Actual contact task content reviewed in retained screenshot.',sourceSha256:hash(bytes),screenshotDataSha256:hash(report.audits['final-screenshot'].details.data),mainDocumentUrl:url};
 const ok=(r=report,b=bytes,review=receipt)=>acceptedRetainedLabDocument(r,['https://ministry.example'],b,review);
 assert.equal(ok(report,bytes,null),false);assert.equal(ok(),true);assert.equal(ok(report,Buffer.from('modified')),false);assert.equal(ok(report,bytes,{...receipt,screenshotReviewed:false}),false);
 assert.equal(ok({...report,unrecordedChange:true}),false);
 assert.equal(ok({...report,runtimeError:{code:'FAILED_DOCUMENT_REQUEST'}}),false);assert.equal(acceptedRetainedLabDocument(report,['https://other.example'],bytes,receipt),false);
 const failed=structuredClone(report);failed.audits['network-requests'].details.items[0].statusCode=404;failed.audits['network-requests'].details.items.push({url:'https://ministry.example/frame',statusCode:200,resourceType:'Document',resourceSize:2000});const failedBytes=Buffer.from(JSON.stringify(failed));assert.equal(ok(failed,failedBytes,{...receipt,sourceSha256:hash(failedBytes)}),false);
});
