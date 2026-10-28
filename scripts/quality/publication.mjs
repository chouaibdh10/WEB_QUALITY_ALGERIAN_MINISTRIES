import { writeFile } from 'node:fs/promises';
export async function writePilotIndexes(reports) {
 await writeFile('src/data/pilotEvaluations.js', `// Reviewed publication-safe aggregates; raw evidence remains private.\nexport const pilotEvaluations = ${JSON.stringify(reports,null,2)}\n`);
 const summaries=Object.fromEntries(Object.entries(reports).map(([id,r])=>[id,{ministryId:id,website:r.pages.find(p=>p.type==='homepage')?.url,points:r.points,assessedPoints:r.assessedPoints,labCompletedAt:r.labCompletedAt,completedAt:r.completedAt,ownership:r.ownership?{status:r.ownership.status}:undefined}]));
 await writeFile('src/data/pilotSummaries.js', `// Small landing-page index; full evidence loads with ministry profiles.\nexport const pilotSummaries = ${JSON.stringify(summaries,null,2)}\n`);
}
