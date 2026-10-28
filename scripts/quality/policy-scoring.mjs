import {parseCsp,parseHsts} from './assessment.mjs';
export function hstsPoints(value){const policy=parseHsts(value);return !policy.present||policy.issues.length||!policy.maxAgeSeconds?0:policy.maxAgeSeconds>=31536000&&policy.includeSubDomains?2:1;}
export function cspPoints(value){
 const parsed=parseCsp(value);
 if(!parsed.present)return 0;
 // A header that merely upgrades insecure requests does not restrict script execution.
 // Multiple policies intersect; require a human decision instead of guessing that result.
 if(parsed.multiplePolicies)return null;
 if(!parsed.issues.length)return 2;
 const p=parsed.policies[0];
 const scripts=p.directives['script-src-elem']??p.directives['script-src']??p.directives['default-src'];
 const objects=p.directives['object-src']??p.directives['default-src'];
 const restrictive=tokens=>Array.isArray(tokens)&&!tokens.some(t=>['*','http:','https:','data:',"'unsafe-inline'","'unsafe-eval'"].includes(t));
 return restrictive(scripts)&&restrictive(objects)?1:0;
}
