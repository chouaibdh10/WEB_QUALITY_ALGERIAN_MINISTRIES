import assert from 'node:assert/strict';
import { ministries } from '../src/data/ministries.js';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const base = process.argv[2] ?? 'https://refined-algerian-ministries-web-quality.algerian-ministries-web-quality-index.workers.dev';
const built = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const scripts = [...built.matchAll(/(?:src|href)="(\/assets\/index-[^"]+)"/g)].map(match => match[1]);
assert.equal(scripts.length, 2, 'Expected a built JS and CSS entry');
for (const pathname of ['/', '/?revision=72073f61-final', '/ministries/higher-education']) {
  let response; let html = ''; let matched = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    const freshUrl = new URL(pathname, base);
    freshUrl.searchParams.set('__wqi_build', scripts[0].split('/').pop());
    freshUrl.searchParams.set('__wqi_attempt', String(attempt));
    response = await fetch(freshUrl, {headers: {'Cache-Control': 'no-cache'}});
    html = await response.text();
    matched = response.status === 200 && response.headers.get('cache-control') === 'no-store' && scripts.every(path => html.includes(path));
    if (matched) break;
    if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 3000));
  }
  assert.equal(response.status, 200, pathname);
  assert.equal(response.headers.get('cache-control'), 'no-store', `${pathname} must not reuse a stale shell`);
  assert.ok(matched, `${pathname} must serve the current build after propagation (cache-busted verification)`);
  console.log(`Verified active build at ${pathname}`);
}
const revisionBytes = await readFile(new URL('../public/evaluations/results-revision.json', import.meta.url));
const revisionResponse = await fetch(new URL(`/evaluations/results-revision.json?verification=${Date.now()}`, base));
assert.equal(revisionResponse.status, 200);
assert.match(revisionResponse.headers.get('content-type') ?? '', /json/);
const liveRevision = Buffer.from(await revisionResponse.arrayBuffer());
assert.equal(createHash('sha256').update(liveRevision).digest('hex'), createHash('sha256').update(revisionBytes).digest('hex'), 'Live revision record must match the reviewed local revision');
const revision = JSON.parse(liveRevision);
assert.equal(revision.errors.length, 0);
console.log(`Verified public revision record for ${revision.reports.length} reports and ${revision.reports.reduce((sum, report) => sum + report.successfulRuns, 0)} successful lab runs.`);
for (const path of [...scripts, '/brand/wqi-mark-v4.svg', '/brand/wqi-mark-dark-v4.svg']) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200, path);
  if (path.endsWith('.js')) assert.match(response.headers.get('content-type') ?? '', /javascript/, 'JS asset returned an HTML fallback');
  if (path.endsWith('.css')) assert.match(response.headers.get('content-type') ?? '', /text\/css/, 'CSS asset returned an HTML fallback');
  if (path.endsWith('.svg')) {
    const svg = await response.text();
    assert.ok(svg.includes('M0 0h64v64H0z'), 'Restored square W artwork is missing');
    assert.ok(svg.includes('M9 17h10'), 'W artwork is missing');
  }
}
console.log('Production shell, assets and square W logos match the local build.');

const identities = JSON.parse(await readFile(new URL('../public/ministries/sources.json', import.meta.url), 'utf8'));
await Promise.all(identities.identities.map(async identity => {
  const response = await fetch(new URL(identity.asset, base));
  assert.equal(response.status, 200, identity.asset);
  assert.match(response.headers.get('content-type') ?? '', /^image\//, identity.asset);
  const actual = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
  assert.equal(actual, identity.sha256, `${identity.id} must match the researched asset`);
}));
console.log(`Verified ${identities.identities.length} official identity assets against their SHA-256 hashes.`);

const { readdir } = await import('node:fs/promises');
for (const file of (await readdir(new URL('../public/evaluations/', import.meta.url))).filter(name => name.endsWith('-pilot.json'))) {
const pilotBytes = await readFile(new URL(`../public/evaluations/${file}`, import.meta.url));
const pilotResponse = await fetch(new URL(`/evaluations/${file}?verification=${Date.now()}`, base));
assert.equal(pilotResponse.status, 200, 'Published pilot JSON must exist');
assert.match(pilotResponse.headers.get('content-type') ?? '', /json/, 'Evidence download must not be the SPA fallback');
const livePilot = Buffer.from(await pilotResponse.arrayBuffer());
assert.equal(createHash('sha256').update(livePilot).digest('hex'), createHash('sha256').update(pilotBytes).digest('hex'), 'Live pilot must match the reviewed local evidence');
const pilot = JSON.parse(livePilot);
assert.equal(pilot.categories.flatMap(c => c.rows).length, 57);
assert.equal(pilot.overallScore, null);
assert.equal(pilot.rank, null);
console.log(`Verified live pilot: ${pilot.points}/${pilot.assessedPoints} confirmed points; all 57 reviewed criteria; final score/rank withheld.`);

}

const localLedger = await readFile(new URL('../public/evaluations/campaign-status.json', import.meta.url));
const ledgerResponse = await fetch(new URL(`/evaluations/campaign-status.json?verification=${Date.now()}`, base));
assert.equal(ledgerResponse.status,200);
const liveLedger=Buffer.from(await ledgerResponse.arrayBuffer());
assert.equal(createHash('sha256').update(liveLedger).digest('hex'),createHash('sha256').update(localLedger).digest('hex'));
const ledger=JSON.parse(liveLedger);
assert.equal(ledger.entries.length,ministries.length);
assert.equal(ledger.totalCriteria,ledger.published*57);assert.equal(ledger.pendingCriteria,ledger.entries.reduce((n,e)=>n+(e.pendingCriteria??0),0));assert.equal(ledger.assessedCriteria,ledger.totalCriteria-ledger.pendingCriteria);
assert.equal(new Set(ledger.entries.map(e=>e.id)).size,ministries.length);
assert.equal(ledger.published+ledger.collectionGaps+ledger.unresolved+ledger.inProgress,ministries.length);
for(const entry of ledger.entries)if(entry.status!=='report-published')assert.equal(entry.score,null);
console.log(`Verified collection ledger: ${ledger.published} reports, ${ledger.inProgress} in progress, ${ledger.collectionGaps} collection gaps and ${ledger.unresolved} unresolved domains.`);

// Recovery disclosures are part of the published evidence, not SPA routes.
for (const file of ['recovery-protocol-2026-10-21.md', 'domain-review-2026-10-21.json', 'completion-review-2026-10-21.md', 'completion-review-2026-10-21.json', 'coverage-review-2026-10-26.md', 'coverage-review-2026-10-26.json']) {
  let bytes;
  try { bytes = await readFile(new URL(`../public/evaluations/${file}`, import.meta.url)); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  const response = await fetch(new URL(`/evaluations/${file}?verification=${Date.now()}`, base));
  assert.equal(response.status, 200, file);
  const actual = Buffer.from(await response.arrayBuffer());
  assert.equal(createHash('sha256').update(actual).digest('hex'), createHash('sha256').update(bytes).digest('hex'), `${file} must match the reviewed disclosure`);
  console.log(`Verified recovery disclosure: ${file}`);
}
