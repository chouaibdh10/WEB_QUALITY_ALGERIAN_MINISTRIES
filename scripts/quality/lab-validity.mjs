const documentUrl=value=>{const url=new URL(value);url.hash='';return url.href};
export function validLabDocument(report,origins){
 if(report.runtimeError)return false;
 try{
  const main=documentUrl(report.mainDocumentUrl??report.finalDisplayedUrl??report.finalUrl);
  if(!origins.includes(new URL(main).origin))return false;
  return (report.audits?.['network-requests']?.details?.items??[]).some(r=>r.resourceType==='Document'&&r.statusCode===200&&r.resourceSize>1000&&documentUrl(r.url)===main);
 }catch{return false}
}
