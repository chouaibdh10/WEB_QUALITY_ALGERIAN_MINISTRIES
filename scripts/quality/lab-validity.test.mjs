import test from 'node:test';import assert from 'node:assert/strict';import {validLabDocument} from './lab-validity.mjs';
const main='https://ministry.example/service';
const report=items=>({mainDocumentUrl:main,audits:{'network-requests':{details:{items}}}});
const doc=(url,statusCode=200,resourceSize=1500)=>({url,statusCode,resourceSize,resourceType:'Document'});
test('A successful iframe cannot stand in for the declared main document',()=>{
 assert.equal(validLabDocument(report([doc(main,404),doc('https://ministry.example/frame')]),['https://ministry.example']),false);
 assert.equal(validLabDocument(report([doc(main)]),['https://ministry.example']),true);
 assert.equal(validLabDocument(report([doc(main)]),['https://other.example']),false);
 assert.equal(validLabDocument({...report([doc(main)]),runtimeError:{code:'FAILED_DOCUMENT_REQUEST'}},['https://ministry.example']),false);
 assert.equal(validLabDocument(report([doc(main,200,900)]),['https://ministry.example']),false);
});
