import {createHash} from 'node:crypto';
import {validLabDocument} from './lab-validity.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
// A small SPA bootstrap needs explicit, immutable rendered-page review, not a lower byte threshold.
export function acceptedRetainedLabDocument(report,origins,sourceBytes,review){
 if(validLabDocument(report,origins))return true;
 try{
  if(report.runtimeError||review?.type!=='rendered-main-document-review'||review.accepted!==true||review.screenshotReviewed!==true||!review.reason||!review.reviewedAt)return false;
  if(hash(sourceBytes)!==review.sourceSha256)return false;
  if(JSON.stringify(JSON.parse(sourceBytes))!==JSON.stringify(report))return false;
  const image=report.audits?.['final-screenshot']?.details?.data;
  if(typeof image!=='string'||hash(image)!==review.screenshotDataSha256)return false;
  const main=new URL(report.mainDocumentUrl??report.finalDisplayedUrl??report.finalUrl);main.hash='';
  if(!origins.includes(main.origin)||main.href!==review.mainDocumentUrl)return false;
  return (report.audits?.['network-requests']?.details?.items??[]).some(r=>{
   const u=new URL(r.url);u.hash='';return r.resourceType==='Document'&&r.statusCode===200&&r.resourceSize>0&&u.href===main.href;
  });
 }catch{return false}
}
