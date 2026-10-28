#!/usr/bin/env node
import {mkdir, chmod, writeFile, readFile, appendFile, readdir, access} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {ministries} from '../src/data/ministries.js';
import {createCollector} from './quality/network.mjs';
import {coverageReport} from './quality/rubric.mjs';
import {summarizeMonitoring} from './quality/monitoring.mjs';
import {cleanUrl, createMeasurementPlans, offlinePlan, discoverSamples, REQUIRED_PAGE_TYPES} from './quality/planning.mjs';

const HELP = `Ministry web-quality evidence collector (Node 22+ and Chrome)

npm run measure -- --list
npm run measure -- --all --plan --out evidence
npm run measure -- --ministry higher-education --discover --runs 3
npm run measure -- --ministry higher-education --location "Bejaia, Algeria"
npm run measure -- --all --http-only --location "Bejaia, Algeria"
npm run measure -- --ministry higher-education --samples samples.json --runs 3
npm run measure -- --ministry higher-education --monitor --interval-seconds 600

Targets: --ministry ID | --all | --url PUBLIC_URL (exactly one)
--plan               Offline JSON preview: approved origins, declared pages, unresolved skips,
                     missing page types and discovery policy; print and write plan.json, no requests.
--discover           Browser mode only: select up to five distinct public same-origin links
                     observed on the homepage (service/news/contact/deep/random heuristics).
                     Explicit --samples takes precedence; review discovered-samples.json.
                     Random means deterministic selection from observed links, not all site pages.
--samples FILE       JSON object: { "ministry-id": [{ "type": "service", "url": "...", "note": "..." }] }
                     Add all required page types; default is homepage only, never a complete corpus.
--allow-origin URL   Explicitly approve an additional redirect origin (repeatable).
--runs N             Lighthouse repetitions per mobile/desktop profile (default 3, 1–10).
--http-only          HTTP/robots/TLS evidence only; no invented browser results.
--monitor            Append one timestamped observation per declared endpoint; schedule externally.
--interval-seconds N Declared monitoring interval (default 600; this is not prescribed by the PDF).
--out DIR            Private evidence root (default evidence/).
--location TEXT      Record measurement network/location; omission is explicit in metadata.
--evaluator TEXT     Record collector identity (default unspecified).
--chrome-path FILE   Chrome binary (default CHROME_PATH or /usr/bin/google-chrome).
--delay-ms N         Delay between requests/document runs (default 1500, public minimum 500).
--timeout-ms N       HTTP/browser timeout (default 30000, 1000–120000).
--allow-local        Loopback fixtures only; never allows private LAN destinations.
--help               Show this help.

No authentication, form submission, brute-force, exploit scans or guessed sensitive paths.
Scores stay null pending domain verification, scoring-workbook decisions and human approval.
Evidence is private, not dashboard publication data. See docs/measurement.md.
`;

function numberOption(value, label, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${label} must be an integer from ${min} to ${max}`);
  return number;
}
function safeError(error) {
  return {code: error.code ?? 'COLLECTION_ERROR', message: error.message};
}
async function saveJson(filename, value) {
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
}
async function artifactManifest(directory) {
  const result = [];
  async function walk(folder, prefix = '') {
    for (const entry of await readdir(folder, {withFileTypes: true})) {
      const relative = path.posix.join(prefix, entry.name);
      if (entry.isDirectory()) await walk(path.join(folder, entry.name), relative);
      else if (entry.isFile() && entry.name !== 'manifest.json') {
        const bytes = await readFile(path.join(folder, entry.name));
        result.push({path: relative, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')});
      }
    }
  }
  await walk(directory);
  return result.sort((a, b) => a.path.localeCompare(b.path));
}
function markdownReport(report) {
  const lines = [
    `# ${report.ministry.name} — website-quality evidence`, '',
    `Collected: ${report.completedAt}. Location: ${report.context.location}.`, '',
    `**${report.status}**. Overall score: **N/M**. Rank: **not assigned**.`, '',
    report.reason, '',
    '## Declared pages and collection outcomes', '',
    '| Page type | URL | HTTP | Browser evidence |', '|---|---|---|---|',
  ];
  const cell = value => String(value).replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ');
  for (const page of report.pages) lines.push(`| ${cell(page.type)} | ${cell(page.url)} | ${page.http?.status ?? 'N/M'} | ${page.browser?.status ?? 'Not requested'} |`);
  lines.push('', '## Security and accessibility observations', '',
    'Header presence is not policy quality. Axe findings require human verification.', '',
    '| Page | HSTS header | CSP header | Negotiated TLS | Axe rule violations, mobile / desktop |', '|---|---|---|---|---|');
  for (const page of report.pages) {
    const header = key => page.http?.status ? (page.http.headers?.[key] ? 'Present; review policy' : 'Not observed') : 'N/M';
    const violations = profile => page.browser?.accessibility?.profiles?.[profile]?.violations?.length ?? 'N/M';
    lines.push(`| ${cell(page.type)} | ${header('strict-transport-security')} | ${header('content-security-policy')} | ${page.http?.tls?.protocol ?? 'N/M'} | ${violations('mobile')} / ${violations('desktop')} |`);
  }
  lines.push('', '## Repeated lab measurements', '', 'These are diagnostic measurements, not rubric points. TBT is not INP; no field data is collected.', '', '| Page / profile | LCP median (ms) | CLS median | TBT median (ms) | Successful LCP runs |', '|---|---|---|---|---|');
  for (const page of report.pages) {
    for (const [profile, result] of Object.entries(page.browser?.performance ?? {})) {
      const metrics = result.metrics;
      lines.push(`| ${cell(page.type)} / ${profile} | ${metrics.LCP?.median ?? 'N/M'} | ${metrics.CLS?.median ?? 'N/M'} | ${metrics.TBT?.median ?? 'N/M'} | ${metrics.LCP?.count ?? 0} |`);
    }
  }
  lines.push('', '## Criterion-level diagnostics', '',
    'Automated diagnostics describe the observed sample, not whole-site compliance or awarded points. Missing measurements are not zeros.', '',
    `Assessment counts: ${cell(JSON.stringify(report.assessmentSummary?.counts ?? {}))}.`, '',
    '| Criterion | Possible points | Diagnostic state | Reason | Measurements | Evidence requirement |', '|---|---|---|---|---|---|');
  for (const category of report.categories) for (const row of category.rows) {
    const assessment = row.assessment;
    lines.push(`| ${cell(row.label)} | ${row.maxPoints} | ${cell(assessment?.status ?? 'Not measured')} | ${cell(assessment?.reason ?? 'No assessment available')} | ${cell(JSON.stringify(assessment?.measurements ?? []))} | ${cell(row.requirement)} |`);
  }
  lines.push('', '## Limits', '', ...report.limitations.map(note => `- ${note}`), '', 'Detailed observations, errors and evidence references are in report.json. Do not publish screenshots or reports without human redaction and approval.', '');
  if (report.collectionErrors.length) lines.push('', '## Collection errors', '', ...report.collectionErrors.map(error => `- ${cell(error.stage)}: ${cell(error.message)}`), '');
  return lines.join('\n');
}

const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
function criteriaCsv(report) {
  const columns = ['ministryId', 'category', 'criterionId', 'label', 'maxPoints', 'awardedPoints', 'rawScore', 'rank', 'status', 'automated', 'reason', 'scope', 'measurements', 'evidence'];
  const rows = report.categories.flatMap(category => category.rows.map(row => ({
    ministryId: report.ministry.id, category: category.key, criterionId: row.id, label: row.label,
    maxPoints: row.maxPoints, awardedPoints: null, rawScore: null, rank: null,
    status: row.assessment?.status ?? 'Not measured', automated: row.assessment?.automated ?? false,
    reason: row.assessment?.reason ?? 'No assessment available', scope: row.assessment?.scope ?? 'No measured scope',
    measurements: JSON.stringify(row.assessment?.measurements ?? []), evidence: JSON.stringify(row.evidence),
  })));
  return `${[columns.join(','), ...rows.map(row => columns.map(key => csvCell(row[key])).join(','))].join('\n')}\n`;
}
let currentStage = 'startup';

/** Bound a step that can hang forever after an internal crash; a hang becomes a recorded error. */
function bounded(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} exceeded the ${ms}ms bound; step abandoned.`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function main() {
  const {values} = parseArgs({options: {
    help: {type: 'boolean'}, list: {type: 'boolean'}, all: {type: 'boolean'}, plan: {type: 'boolean'}, discover: {type: 'boolean'},
    ministry: {type: 'string'}, url: {type: 'string'}, samples: {type: 'string'},
    'allow-origin': {type: 'string', multiple: true, default: []},
    'http-only': {type: 'boolean'}, monitor: {type: 'boolean'}, 'allow-local': {type: 'boolean'},
    runs: {type: 'string', default: '3'}, 'delay-ms': {type: 'string', default: '1500'},
    'timeout-ms': {type: 'string', default: '30000'}, 'interval-seconds': {type: 'string', default: '600'},
    out: {type: 'string', default: 'evidence'}, location: {type: 'string', default: 'Not supplied'},
    evaluator: {type: 'string', default: 'Not supplied'}, 'chrome-path': {type: 'string'},
  }});
  if (values.help) { console.log(HELP); return; }
  if (values.list) {
    console.table(ministries.map(({id, name, domain, status}) => ({id, name, domain: domain ?? 'Unresolved', status})));
    return;
  }
  if ([values.all, values.ministry, values.url].filter(Boolean).length !== 1) throw new Error('Choose exactly one of --ministry, --all or --url. Use --help for usage.');
  if (values.discover && (values['http-only'] || values.monitor)) throw new Error('--discover requires full-browser mode; it cannot be combined with --http-only or --monitor');
  const runs = numberOption(values.runs, '--runs', 1, 10);
  const delayMs = numberOption(values['delay-ms'], '--delay-ms', values['allow-local'] ? 0 : 500, 60000);
  const timeoutMs = numberOption(values['timeout-ms'], '--timeout-ms', 1000, 120000);
  const intervalSeconds = numberOption(values['interval-seconds'], '--interval-seconds', 60, 86400);
  let targets;
  if (values.all) targets = ministries;
  else if (values.ministry) {
    const ministry = ministries.find(entry => entry.id === values.ministry);
    if (!ministry) throw new Error(`Unknown ministry ID: ${values.ministry}. Use --list.`);
    targets = [ministry];
  } else {
    const url = new URL(cleanUrl(values.url));
    targets = [{id: 'custom-site', name: url.hostname, domain: url.host, status: 'Unverified custom target', url: url.href}];
  }
  const samples = values.samples ? JSON.parse(await readFile(values.samples, 'utf8')) : {};
  if (!samples || Array.isArray(samples) || typeof samples !== 'object') throw new Error('--samples must contain an object keyed by ministry IDs');
  const knownIds = new Set([...ministries.map(ministry => ministry.id), 'custom-site']);
  for (const id of Object.keys(samples)) if (!knownIds.has(id)) throw new Error(`Unknown sample ministry ID: ${id}. Use --list.`);
  const plans = createMeasurementPlans(targets, {samples, approvedExtraOrigins: values['allow-origin']});
  const chromePath = values['chrome-path'] ?? process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
  if (!values.plan && !values.monitor && !values['http-only'] && plans.some(plan => !plan.skipped && plan.pages.length)) {
    try { await access(chromePath, constants.X_OK); }
    catch { throw new Error(`Chrome executable is not accessible: ${chromePath}. Set --chrome-path or use --http-only.`); }
  }
  const root = path.resolve(values.out);
  await mkdir(root, {recursive: true, mode: 0o700});
  await chmod(root, 0o700);
  const runDirectory = path.join(root, `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
  await mkdir(runDirectory, {mode: 0o700});
  // Stray async rejections (e.g. from Lighthouse's internal driver after a timeout) must not
  // kill a multi-ministry run: record them honestly and keep collecting.
  const recordStray = (kind, error) => {
    const entry = {stage: `${kind} at ${currentStage}`, ...safeError(error)};
    console.error(`Recorded ${kind} (collection continues): ${entry.message}`);
    appendFile(path.join(runDirectory, 'crashes.jsonl'), `${JSON.stringify(entry)}\n`, {mode: 0o600}).catch(() => {});
  };
  process.on('unhandledRejection', error => recordStray('unhandled-rejection', error));
  process.on('uncaughtException', error => {
    recordStray('uncaught-exception', error);
    process.exit(1);
  });
  const mode = values.monitor ? 'monitor-observation' : values['http-only'] ? 'http-only' : 'http-and-browser';
  const plan = offlinePlan(plans, {discover: Boolean(values.discover), mode, runsPerProfile: runs, delayMs, timeoutMs,
    intervalSeconds, location: values.location, evaluator: values.evaluator});
  await saveJson(path.join(runDirectory, 'plan.json'), plan);
  if (values.plan) {
    console.log(JSON.stringify({...plan, artifact: path.join(runDirectory, 'plan.json')}, null, 2));
    return;
  }
  const reports = [];
  // Keep the process alive while work remains: an unresolved await must surface as a
  // visible hang (or the bounded error above), never as a silent half-finished exit.
  const keepAlive = setInterval(() => {}, 30000);
  for (const {ministry, origins, pages, explicitSamples, skipped, skipReason} of plans) {
    currentStage = ministry.id;
    const directory = path.join(runDirectory, ministry.id);
    await mkdir(directory, {mode: 0o700});
    const startedAt = new Date().toISOString();
    const collectionErrors = [];
    let discovery = values.discover ? {schemaVersion: 1, sourcePool: [], selected: [], omissions: [],
      reason: skipped ? skipReason : explicitSamples ? 'Explicit --samples takes precedence; no automatic discovery' : 'Homepage DOM link inventory was not collected'} : null;
    const collector = skipped ? null : createCollector({origins, allowLocal: Boolean(values['allow-local']), delayMs, timeoutMs});
    const context = {location: values.location, evaluator: values.evaluator, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      nodeVersion: process.version, platform: process.platform, runsPerProfile: runs, delayMs, timeoutMs,
      mode,
      consent: 'Untouched; no authentication or form submission', origins};
    const attempt = async (url, options = {}) => {
      try { return await collector.request(url, options); }
      catch (error) { return {url, status: null, error: safeError(error)}; }
    };
    let httpRedirect = null;
    try {
      if (!values.monitor && ministry.domain && pages.some(page => page.type === 'homepage')) {
        const homepage = pages.find(page => page.type === 'homepage');
        const probe = new URL(homepage.url);
        probe.protocol = 'http:';
        httpRedirect = await attempt(probe.href);
        await saveJson(path.join(directory, 'http-redirect.json'), httpRedirect);
      }
      for (const page of pages) {
        currentStage = `${ministry.id}:${page.id}`;
        const pageDirectory = path.join(directory, page.id);
        await mkdir(pageDirectory, {mode: 0o700});
        try {
          console.log(`${ministry.id}: ${page.type} ${new URL(page.url).hostname}`);
          if (page.discovery) {
            try {
              await collector.guard(page.url);
              page.discovery.guard = {status: 'Allowed'};
            } catch (error) {
              page.discovery.guard = {status: 'Blocked', error: safeError(error)};
              discovery.omissions.push({type: page.type, url: page.url, reason: `Collector guard blocked collection: ${error.message}`});
              throw error;
            }
          }
          page.http = await attempt(page.url);
          if (page.http.error) collectionErrors.push({stage: `${page.id}:http`, ...page.http.error});
          await saveJson(path.join(pageDirectory, 'http.json'), page.http);
          if (values.monitor) {
            const monitoringDir = path.join(root, 'monitoring');
            await mkdir(monitoringDir, {recursive: true, mode: 0o700});
            const log = path.join(monitoringDir, `${ministry.id}.jsonl`);
            const sample = {timestamp: new Date().toISOString(), endpoint: page.url, type: page.type,
              network: values.location, evaluator: values.evaluator, intervalSeconds,
              httpStatus: page.http.status, elapsedMs: page.http.elapsedMs ?? null,
              error: page.http.error ?? null, stopReason: collector.halted ?? null};
            await appendFile(log, `${JSON.stringify(sample)}\n`, {mode: 0o600});
          } else {
            if (page.type === 'homepage' && page.http.status && !collector.halted) {
              page.sitemap = await attempt(new URL('/sitemap.xml', page.http.finalUrl ?? page.url).href);
              await saveJson(path.join(pageDirectory, 'sitemap.json'), page.sitemap);
            }
            if (values['http-only']) {
              page.browserSkipped = {reason: 'HTTP-only mode selected by the operator; no browser observations collected.'};
            } else if (page.http.status >= 200 && page.http.status < 400 && !collector.halted) {
              try {
                if (page.discovery) await collector.guard(page.url);
                const {collectBrowserPage} = await import('./quality/browser.mjs');
                page.browser = await bounded(collectBrowserPage(page.url, {collector, outputDir: pageDirectory,
                  runs, delayMs, timeoutMs, chromePath}), timeoutMs * 40, 'Browser evidence collection');
              } catch (error) {
                page.browser = {status: 'N/M', observations: {}, errors: [{stage: 'browser', ...safeError(error)}]};
                collectionErrors.push({stage: `${page.id}:browser`, ...safeError(error)});
              }
              await saveJson(path.join(pageDirectory, 'browser.json'), page.browser);
            } else if (!collector.halted) {
              page.browserSkipped = {reason: `Document returned HTTP ${page.http.status ?? 'no status'}; browser evidence not collected.`};
            }
          }
          if (values.discover && !explicitSamples && page.type === 'homepage' && !discovery.homepageUrl) {
            discovery = discoverSamples(page, pages);
            pages.push(...discovery.selected);
          }
        } catch (error) {
          page.http ??= {url: page.url, status: null, error: safeError(error)};
          page.collectionError = safeError(error);
          collectionErrors.push({stage: `${page.id}:collection`, ...safeError(error)});
          await saveJson(path.join(pageDirectory, 'http.json'), page.http);
        }
      }
    } catch (error) {
      collectionErrors.push({stage: 'target-collection', ...safeError(error)});
    }
    let monitoring = null;
    try {
      const log = await readFile(path.join(root, 'monitoring', `${ministry.id}.jsonl`), 'utf8');
      monitoring = summarizeMonitoring(log.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)));
      await saveJson(path.join(directory, 'monitoring-summary.json'), monitoring);
    } catch (error) {
      if (error.code !== 'ENOENT') collectionErrors.push({stage: 'monitoring-summary', ...safeError(error)});
    }
    if (discovery) {
      discovery.requiredMissingPageTypes = REQUIRED_PAGE_TYPES.filter(type => !pages.some(page => page.type === type));
      await saveJson(path.join(directory, 'discovered-samples.json'), {...discovery,
        selected: discovery.selected.map(page => ({id: page.id, type: page.type, url: page.url, note: page.note,
          discovery: page.discovery, httpStatus: page.http?.status ?? null, browserStatus: page.browser?.status ?? 'Not measured',
          error: page.collectionError ?? page.http?.error ?? null})),
        samples: {[ministry.id]: pages.map(({type, url, note}) => ({type, url, note}))}});
    }
    const robotsEvidence = collector?.robotsEvidence ?? [];
    await saveJson(path.join(directory, 'robots.json'), robotsEvidence);
    const scoring = coverageReport(pages, {robotsEvidence, monitoring, httpRedirect});
    const report = {schemaVersion: 1, corpusVersion: 'discovery-2026-09-03', ministry, startedAt,
      completedAt: new Date().toISOString(), context, pages, httpRedirect, monitoring, collectionErrors,
      skipped, skipReason, discovery: discovery ? 'discovered-samples.json' : null,
      requiredMissingPageTypes: REQUIRED_PAGE_TYPES.filter(type => !pages.some(page => page.type === type)),
      robotsEvidence, halted: collector?.halted ?? null, ...scoring,
      reason: skipped ? skipReason : collectionErrors.length ? `${scoring.reason} Collection errors are recorded below; unavailable measurements remain N/M.` : scoring.reason,
      limitations: [
        'Domains in the PDF appendix are candidates, not verified official ownership.',
        'Declared and discovered page types are sampling heuristics, not verified representative coverage. Language and citizen-journey templates require explicit selection and human review.',
        'No full/partial/zero scoring thresholds or minimum coverage thresholds are supplied by the PDFs; the scoring workbook must predeclare them.',
        'A valid TLS handshake does not enumerate supported protocols/ciphers; missing CSP is a hardening observation, not proof of a severe vulnerability.',
        'No exhaustive link crawl, vulnerability probing, sensitive configuration guessing, tracker classification, paid-service scan or CrUX query is performed.',
        'Lighthouse aggregate scores are diagnostic only. Browser loads are constrained by a four-request concurrency limit and any recorded policy blocks.',
        'A monitoring observation is not 28-day uptime; observation gaps, maintenance and independent networks require review.',
        'Cookie values are omitted. Screenshots and tool reports remain private and require manual redaction before publication.',
      ]};
    await saveJson(path.join(directory, 'report.json'), report);
    await writeFile(path.join(directory, 'report.md'), markdownReport(report), {mode: 0o600});
    await writeFile(path.join(directory, 'criteria.csv'), criteriaCsv(report), {mode: 0o600});
    await saveJson(path.join(directory, 'manifest.json'), await artifactManifest(directory));
    reports.push({id: ministry.id, name: ministry.name, domain: ministry.domain,
      score: null, rank: null, status: report.status, sampledPages: pages.length,
      httpResponses: pages.filter(page => page.http?.status != null).length,
      criteriaWithSupportingEvidence: report.coverage.criteriaWithSupportingEvidence,
      assessmentSummary: report.assessmentSummary, assessmentCounts: report.assessmentSummary?.counts ?? {},
      automatedCriteria: report.assessmentSummary?.automatedCriteria ?? 0,
      criteriaWithMeasurements: report.assessmentSummary?.criteriaWithMeasurements ?? 0,
      collectionErrors: collectionErrors.length, skipped, skipReason,
      report: `${ministry.id}/report.json`});
    console.log(`  ${skipped ? `Skipped: ${skipReason}` : report.status}; automated diagnostics ${JSON.stringify(report.assessmentSummary?.counts ?? {})}; ${report.assessmentSummary?.criteriaWithMeasurements ?? 0}/${report.coverage.totalCriteria} criteria have measurements; ${report.coverage.criteriaWithSupportingEvidence}/${report.coverage.totalCriteria} have supporting evidence; 0 scored.`);
  }
  clearInterval(keepAlive);
  await saveJson(path.join(runDirectory, 'summary.json'), reports);
  const columns = ['id', 'name', 'domain', 'score', 'rank', 'status', 'sampledPages', 'httpResponses', 'criteriaWithSupportingEvidence', 'automatedCriteria', 'criteriaWithMeasurements', 'assessmentCounts', 'collectionErrors', 'skipped', 'skipReason', 'report'];
  await writeFile(path.join(runDirectory, 'summary.csv'), `${[columns.join(','), ...reports.map(report => columns.map(key => csvCell(key === 'assessmentCounts' ? JSON.stringify(report[key]) : report[key])).join(','))].join('\n')}\n`, {mode: 0o600});
  console.log(`Private evidence saved: ${runDirectory}`);
}

main().catch(error => {
  console.error(`Measurement failed: ${error.message}`);
  process.exitCode = 1;
});
