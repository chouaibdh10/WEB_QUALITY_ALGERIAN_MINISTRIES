import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ministries} from '../../src/data/ministries.js';
import {cleanUrl, createMeasurementPlans, offlinePlan, discoverSamples, REQUIRED_PAGE_TYPES} from './planning.mjs';

const cli = fileURLToPath(new URL('../measure.mjs', import.meta.url));
const target = {id: 'custom-site', name: 'Fixture', domain: 'fixture.invalid', url: 'https://fixture.invalid/'};

function runCli(args, {forbidNetworking = false} = {}) {
  const preflight = `import http from 'node:http'; import https from 'node:https'; import dns from 'node:dns'; import {syncBuiltinESMExports} from 'node:module'; const deny = () => { throw new Error('OFFLINE_PLAN_NETWORK_CONTACT'); }; http.request = deny; http.get = deny; https.request = deny; https.get = deny; dns.lookup = deny; dns.promises.lookup = deny; globalThis.fetch = deny; syncBuiltinESMExports();`;
  const preload = forbidNetworking ? ['--import', `data:text/javascript,${encodeURIComponent(preflight)}`] : [];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...preload, cli, ...args], {stdio: ['ignore', 'pipe', 'pipe']});
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => stdout += chunk);
    child.stderr.on('data', chunk => stderr += chunk);
    const timer = setTimeout(() => child.kill('SIGTERM'), 30000);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); resolve({code, stdout, stderr}); });
  });
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ministry-planning-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  return directory;
}

function homepage(links, {desktopLinks = links, finalUrl = target.url} = {}) {
  return {id: 'page-1', type: 'homepage', url: target.url, http: {finalUrl}, browser: {observations: {
    mobile: {finalUrl, links}, desktop: {finalUrl, links: desktopLinks},
  }}};
}

const observed = [
  {url: 'https://fixture.invalid/services', label: 'Services aux citoyens'},
  {url: 'https://fixture.invalid/news', label: 'Actualités'},
  {url: 'https://fixture.invalid/contact', label: 'اتصل بنا'},
  {url: 'https://fixture.invalid/about/organization', label: 'Organization'},
  {url: 'https://fixture.invalid/about', label: 'About'},
  {url: 'https://fixture.invalid/extra', label: 'More'},
];

test('offline nationwide plan enumerates every portfolio, unresolved skips and missing types without scores', () => {
  const plans = createMeasurementPlans([...ministries, {id: 'unresolved-fixture', name: 'Unresolved fixture', domain: null}]);
  const result = offlinePlan(plans, {discover: true});
  assert.equal(result.totalPortfolios, 33);
  assert.equal(result.runnablePortfolios, 32);
  assert.equal(result.networkContacted, false);
  assert.deepEqual(result.unresolvedSkips.map(entry => entry.id), ['unresolved-fixture']);
  assert.equal(result.rawScore, null);
  assert.equal(result.rank, null);
  for (const portfolio of result.portfolios) {
    assert.deepEqual(portfolio.approvedOrigins, portfolio.origins);
    if (portfolio.skipped) {
      assert.deepEqual(portfolio.pages, []);
      assert.deepEqual(portfolio.origins, []);
      assert.deepEqual(portfolio.requiredMissingPageTypes, REQUIRED_PAGE_TYPES);
      assert.match(portfolio.skipReason, /Unresolved/);
    } else {
      assert.equal(portfolio.pages.length, 1);
      assert.equal(portfolio.pages[0].type, 'homepage');
      assert.equal(portfolio.pages[0].url, `https://${portfolio.ministry.domain}/`);
      assert.deepEqual(portfolio.requiredMissingPageTypes, REQUIRED_PAGE_TYPES.filter(type => type !== 'homepage'));
    }
  }
});

test('explicit samples retain their rationale and take precedence over discovery', () => {
  const samples = {'custom-site': [{type: 'service', url: 'https://fixture.invalid/index.php?page=service', note: 'Reviewed service template'}]};
  const plans = createMeasurementPlans([target], {samples, approvedExtraOrigins: ['https://approved.invalid/']});
  assert.equal(plans[0].explicitSamples, true);
  assert.equal(plans[0].pages[0].url, samples['custom-site'][0].url);
  assert.equal(plans[0].pages[0].note, 'Reviewed service template');
  assert.ok(plans[0].origins.includes('https://approved.invalid'));
  assert.match(offlinePlan(plans, {discover: true}).portfolios[0].discovery, /explicit --samples takes precedence/);
  assert.ok(plans[0].requiredMissingPageTypes.includes('homepage'));
});

test('plan configuration rejects invalid types, duplicate samples and unapproved origins before collection', () => {
  const plan = pages => createMeasurementPlans([target], {samples: {'custom-site': pages}});
  assert.throws(() => plan([]), /1–12/);
  assert.throws(() => plan([{type: 'unsafe', url: target.url}]), /supported type/);
  assert.throws(() => plan([{type: 'homepage', url: 'https://outside.invalid/'}]), /origin outside target/);
  assert.throws(() => plan([{type: 'homepage', url: target.url}, {type: 'random', url: target.url}]), /duplicate/);
  assert.throws(() => cleanUrl('https://user:password@fixture.invalid/'), /credentials/);
  assert.throws(() => cleanUrl('file:///tmp/page.html'), /HTTP/);
  assert.equal(cleanUrl('https://fixture.invalid/?page=service#section'), 'https://fixture.invalid/?page=service');
});

test('discovery deterministically selects five distinct actually observed page candidates with rationale', () => {
  const page = homepage(observed);
  const result = discoverSamples(page, [page]);
  assert.deepEqual(result.selected.map(entry => entry.type), ['service', 'news', 'contact', 'deep', 'random']);
  assert.equal(new Set(result.selected.map(entry => entry.url)).size, 5);
  assert.equal(result.sourcePool.length, observed.length);
  assert.deepEqual(result.sourcePool[0].profiles, ['mobile', 'desktop']);
  assert.deepEqual(result.selected.map(entry => entry.id), ['page-2', 'page-3', 'page-4', 'page-5', 'page-6']);
  assert.deepEqual(result.requiredMissingPageTypes, ['language', 'journey']);
  for (const selection of result.selected) {
    assert.ok(observed.some(link => link.url === selection.url));
    assert.equal(selection.discovery.homepageUrl, page.url);
  }
  const reordered = homepage([...observed].reverse());
  assert.deepEqual(discoverSamples(reordered, [reordered]).selected.map(entry => entry.url), result.selected.map(entry => entry.url));
  assert.ok(result.sourcePool.some(entry => entry.omission?.includes('Not selected')));
});

test('discovery excludes unsafe, off-origin, query and fragment links and never reuses declared URLs', () => {
  const rejected = [
    {url: 'https://fixture.invalid/', label: 'Home'},
    {url: 'https://other.invalid/services', label: 'Service'},
    {url: 'https://fixture.invalid/services?delete=true', label: 'Service'},
    {url: 'https://fixture.invalid/services#anchor', label: 'Service'},
    {url: 'https://user:secret@fixture.invalid/services', label: 'Service'},
    {url: 'https://fixture.invalid/login', label: 'Service'},
    {url: 'https://fixture.invalid/delete/account', label: 'Service'},
    {url: 'https://fixture.invalid/%64ownload/form', label: 'Service'},
    {url: 'https://fixture.invalid/fr/connexion', label: 'Connexion'},
    {url: 'https://fixture.invalid/fr/deconnexion', label: 'Déconnexion'},
    {url: 'https://fixture.invalid/fr/d%C3%A9connexion', label: 'Déconnexion'},
    {url: 'https://fixture.invalid/fr/%73upprimer/page', label: 'Supprimer'},
    {url: 'https://fixture.invalid/fr/effacer/page', label: 'Effacer'},
    {url: 'https://fixture.invalid/fr/desinscription', label: 'Désinscription'},
    {url: 'https://fixture.invalid/account/sign-in', label: 'Sign in'},
    {url: 'https://fixture.invalid/signout', label: 'Sign out'},
    {url: 'https://fixture.invalid/logout', label: 'Logout'},
    {url: 'https://fixture.invalid/remove/page', label: 'Remove'},
    {url: 'https://fixture.invalid/admin/page', label: 'Admin'},
    {url: 'https://fixture.invalid/unsubscribe', label: 'Unsubscribe'},
    {url: 'https://fixture.invalid/forms.pdf', label: 'Service'},
    {url: 'https://fixture.invalid/%zz', label: 'Service'},
    {url: 'javascript:void(0)', label: 'Service'},
  ];
  const page = homepage([...rejected, ...observed]);
  const result = discoverSamples(page, [page, {id: 'page-2', type: 'service', url: observed[0].url}]);
  assert.ok(result.sourcePool.filter(entry => rejected.some(link => link.url === entry.url)).every(entry => !entry.eligible && entry.omission));
  assert.ok(!result.selected.some(entry => entry.url === observed[0].url));
  assert.equal(result.selected[0].id, 'page-3');
  assert.ok(result.omissions.some(entry => entry.type === 'service'));
});

test('discovery uses the observed final homepage origin and reports absent inventory without fake pages', () => {
  const page = homepage([{url: 'https://redirected.invalid/services', label: 'Services'}], {finalUrl: 'https://redirected.invalid/'});
  assert.equal(discoverSamples(page, [page]).selected[0].url, 'https://redirected.invalid/services');
  const unavailable = {id: 'page-1', type: 'homepage', url: target.url};
  const result = discoverSamples(unavailable, [unavailable]);
  assert.deepEqual(result.selected, []);
  assert.equal(result.sourceInventoryAvailable, false);
  assert.equal(result.omissions.length, 5);
  assert.equal(discoverSamples(homepage([]), [homepage([])]).sourceInventoryAvailable, true);
});

test('CLI --all --plan prints and privately writes all 32 directory entries while network APIs are disabled', async t => {
  const directory = await temporaryDirectory(t);
  const result = await runCli(['--all', '--plan', '--discover', '--out', directory], {forbidNetworking: true});
  assert.equal(result.code, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.totalPortfolios, 32);
  assert.equal(plan.unresolvedSkips.length, 0);
  assert.equal(plan.networkContacted, false);
  const written = JSON.parse(await readFile(plan.artifact, 'utf8'));
  assert.deepEqual(written.portfolios, plan.portfolios);
  assert.deepEqual(await readdir(path.dirname(plan.artifact)), ['plan.json']);
});

test('CLI rejects incompatible discovery modes and invalid samples without contacting the target', async t => {
  const directory = await temporaryDirectory(t);
  for (const mode of ['--http-only', '--monitor']) {
    const result = await runCli(['--url', target.url, '--discover', mode, '--out', directory], {forbidNetworking: true});
    assert.equal(result.code, 1);
    assert.match(result.stderr, /requires full-browser mode/);
    assert.doesNotMatch(result.stderr, /OFFLINE_PLAN_NETWORK_CONTACT/);
  }
  const samplesFile = path.join(directory, 'samples.json');
  await writeFile(samplesFile, JSON.stringify({'custom-site': [{type: 'service', url: 'https://unapproved.invalid/'}]}));
  const result = await runCli(['--url', target.url, '--samples', samplesFile, '--out', directory], {forbidNetworking: true});
  assert.equal(result.code, 1);
  assert.match(result.stderr, /origin outside target/);
  assert.doesNotMatch(result.stderr, /OFFLINE_PLAN_NETWORK_CONTACT/);
  const unavailableChrome = await runCli(['--url', target.url, '--chrome-path', path.join(directory, 'missing-chrome'), '--out', directory], {forbidNetworking: true});
  assert.equal(unavailableChrome.code, 1);
  assert.match(unavailableChrome.stderr, /Chrome executable is not accessible/);
  assert.doesNotMatch(unavailableChrome.stderr, /OFFLINE_PLAN_NETWORK_CONTACT/);
});

test('excluded directory targets are rejected without network access or fabricated reports', async t => {
  const directory = await temporaryDirectory(t);
  for (const id of ['state-services-inspectorate', 'mines-mining-industries']) {
    const result = await runCli(['--ministry', id, '--discover', '--out', directory], {forbidNetworking: true});
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Unknown ministry ID/);
    assert.doesNotMatch(result.stderr, /OFFLINE_PLAN_NETWORK_CONTACT/);
  }
  assert.deepEqual(await readdir(directory), []);
});

test('runtime collection failure preserves an error report and continues the next declared page', async t => {
  const contacts = [];
  const server = http.createServer((request, response) => {
    contacts.push(request.url);
    if (request.url === '/robots.txt') {
      response.writeHead(200, {'content-type': 'text/plain'});
      response.end('User-agent: *\nAllow: /\n');
    } else if (request.url === '/broken') {
      response.destroy();
    } else {
      response.writeHead(200, {'content-type': 'text/html'});
      response.end('<!doctype html><title>Observed endpoint</title>');
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    const closed = new Promise(resolve => server.close(resolve));
    server.closeAllConnections();
    await closed;
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const directory = await temporaryDirectory(t);
  const samplesFile = path.join(directory, 'samples.json');
  await writeFile(samplesFile, JSON.stringify({'custom-site': [{type: 'service', url: `${origin}/broken`}, {type: 'contact', url: `${origin}/contact`}]}));
  const result = await runCli(['--url', origin, '--samples', samplesFile, '--http-only', '--allow-local', '--delay-ms', '0', '--out', directory]);
  assert.equal(result.code, 0, result.stderr);
  const run = (await readdir(directory)).find(entry => entry !== 'samples.json');
  const report = JSON.parse(await readFile(path.join(directory, run, 'custom-site', 'report.json'), 'utf8'));
  assert.equal(report.pages[0].http.status, null);
  assert.ok(report.pages[0].http.error);
  assert.equal(report.pages[1].http.status, 200);
  assert.ok(report.collectionErrors.length > 0);
  assert.equal(report.rawScore, null);
  assert.deepEqual(contacts, ['/robots.txt', '/broken', '/contact']);
  const summary = JSON.parse(await readFile(path.join(directory, run, 'summary.json'), 'utf8'));
  assert.deepEqual(summary[0].assessmentSummary, report.assessmentSummary);
  assert.equal(summary[0].httpResponses, 1);
});
