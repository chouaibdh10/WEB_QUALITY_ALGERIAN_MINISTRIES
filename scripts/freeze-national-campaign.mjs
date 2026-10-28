import{readFile,writeFile}from'node:fs/promises';
const path='docs/pilots/national-campaign-manifest.json';const manifest=JSON.parse(await readFile(path));
const choices={
 'national-education':[['contact',/^اتصل بنا$/],['service-information',/^المسابقات$/]],
 'moudjahidine-rights-holders':[['service-information',/^خدماتي$/],['institution',/الهيكل التنظيمي الإدارة المركزية/]],
 'pharmaceutical-industry':[['contact',/للإتصال بنا/],['service-information',/^الحصول على اعتماد$/]],
 'agriculture-rural-development-fisheries':[['contact',/^دليل الهاتف$/],['institution',/^صلاحيات الوزير$/]],
 'foreign-trade-export-promotion':[['service-information',/^المنصة الإلكترونية لمعالجة انشغالات/],['institution',/^صلاحيات الوزير$/]],
 'internal-trade-market-regulation':[['contact',/^تواصل معنا$/],['institution',/^مصالح الوزارة$/]],
 'housing-spatial-planning':[['contact',/^الاتصال$/],['service-information',/^السكن العمومي الايجاري$/]],
 'religious-affairs-wakfs':[['service-information',/^الفتوى الإلكترونية$/],['institution',/^مهام الوزارة$/]],
 'knowledge-economy-startups':[['language',/^عربي$/]],
 'vocational-training':[],
 'public-works-basic-infrastructure':[['contact',/^اتصل بنا$/],['service-information',/^نتائج لجان الاعتماد و التأهيل$/]],
 hydraulics:[['contact',/^اتصل بنا$/, '/ministery_new/contact'],['institution',/^إستراتيجية الوزارة$/]],
 'labour-employment-social-security':[['contact',/^خلية الاستقبال و الاتصال و الإصغاء الاجتماعي$/],['service-information',/^تشريع العمل$/]],
 'tourism-handicrafts':[['contact',/^اتصل بنا$/],['service-information',/^الخدمات الإلكترونية$/]],
 'national-solidarity-family':[['service-information',/^إعلان عن مناقصة$/],['news',/^عرض الكل$/, '/activities.php']],
 sports:[['service-information',/^الرياضة$/],['institution',/^المؤسسات التابعة للقطاع$/]],
 'relations-parliament':[['institution',/^صلاحيات الوزيرة$/],['service-information',/^متابعة العمل التشريعي$/]],
};
for(const s of manifest.targets){const d=JSON.parse(await readFile(`evidence/national-campaign-2026-10-20/${s.id}-discovery.json`));s.pages=[{type:'homepage',url:d.http.finalUrl,note:'Trusted final document from observed entry; client-side fragment/video history does not create another page.'}];for(const[type,re,suffix]of choices[s.id]){const l=d.links.find(l=>!l.url.includes('#')&&re.test(l.text)&&(!suffix||l.url.endsWith(suffix)));if(!l)throw Error(s.id+' missing actually observed '+re);const u=new URL(l.url);if(u.hash||u.href.endsWith('#')||!s.origins.includes(u.origin))throw Error('Invalid page '+l.url);s.pages.push({type,url:l.url,note:'Manually selected actual homepage link: '+l.text});}if(new Set(s.pages.map(p=>p.type)).size!==s.pages.length)throw Error('Duplicate role');if(new Set(s.pages.map(p=>p.url)).size!==s.pages.length)throw Error('Duplicate page');console.log(s.id,s.pages.map(p=>p.type+': '+decodeURI(p.url)).join(' | '))}
manifest.reviewedAt=new Date().toISOString();manifest.selectionReview='All page roles and distinct observed URLs manually checked before collection. No fragment placeholders treated as new pages. Knowledge Economy has only two offered language holding pages; Vocational Training is a one-page service portal with external destinations excluded.';
await writeFile(path,JSON.stringify(manifest,null,2)+'\n');
