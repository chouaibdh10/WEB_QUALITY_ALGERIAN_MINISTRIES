import test from 'node:test';
import assert from 'node:assert/strict';
import {cspPoints,hstsPoints} from './policy-scoring.mjs';
test('CSP presence alone cannot earn meaningful protection credit',()=>{
 assert.equal(cspPoints(undefined),0);
 assert.equal(cspPoints('upgrade-insecure-requests'),0);
 assert.equal(cspPoints("default-src *; base-uri *; frame-ancestors *"),0);
 assert.equal(cspPoints("script-src 'self'; object-src 'none'"),1);
 assert.equal(cspPoints("default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"),2);
 assert.equal(cspPoints("default-src 'self', script-src 'none'"),null);
});
test('HSTS scoring distinguishes disabled, malformed and narrower policies',()=>{
 for(const value of [undefined,'max-age=0','max-age=abc','max-age=1; max-age=2'])assert.equal(hstsPoints(value),0);
 assert.equal(hstsPoints('max-age=86400'),1);
 assert.equal(hstsPoints('max-age=31536000'),1);
 assert.equal(hstsPoints('max-age=31536000; includeSubDomains'),2);
});
