import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCriteria, parseCsp, parseHsts} from './assessment.mjs';
import {coverageReport} from './rubric.mjs';
import {summarizeMonitoring} from './monitoring.mjs';

const URL = 'https://example.test/';
const strongCsp = "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
const response = (overrides = {}) => ({url: URL, finalUrl: URL, status: 200, redirects: [], cookies: [],
  headers: {'strict-transport-security': 'max-age=31536000; includeSubDomains', 'content-security-policy': strongCsp,
    'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'strict-origin-when-cross-origin'},
  tls: {authorized: true, protocol: 'TLSv1.3', cipher: 'TLS_AES_256_GCM_SHA384', certificateNotBefore: '2026-01-01T00:00:00.000Z', certificateExpiresAt: '2027-01-01T00:00:00.000Z'},
  ...overrides});
const observation = (overrides = {}) => ({finalUrl: URL, httpStatus: 200, lang: 'ar', detectedLanguages: ['ar', 'fr'], title: 'Official services',
  description: 'Public ministry services and procedures', canonical: URL, viewport: 'width=device-width, initial-scale=1',
  headings: {h1: 1, h2: 2, h3: 0, h4: 0, h5: 0, h6: 0}, semanticLandmarks: {main: 1, nav: 1},
  images: {count: 2, withAlt: 2, emptyAlt: 1, missingAlt: 0}, forms: {count: 1, controls: 1, controlsWithLabels: 1},
  insecureFormActions: 0, search: {detected: true}, touchTargets: {checked: 4, below24: 0, below44: 1},
  reflow: {viewportWidth: 390, documentWidth: 390, horizontalOverflow: false}, resources: {brokenLoadedResources: []}, ...overrides});
const axe = (overrides = {}) => ({testEngine: {name: 'axe-core', version: 'fixture'}, violations: [], incomplete: [], passesCount: 5, ...overrides});
const run = (index, metrics = {}, overrides = {}) => ({index, status: 'Collected', metrics: {LCP: 2000, CLS: 0.05, TBT: 100, FCP: 1000, TTFB: 200, transferBytes: 500000, ...metrics}, ...overrides});
const page = (id = 'home', overrides = {}) => ({id, type: 'homepage', url: URL, http: response(), browser: {
  constrained: false, blockedRequests: [], settings: {runsPerProfile: 3},
  observations: {mobile: observation(), desktop: observation()},
  accessibility: {profiles: {mobile: axe(), desktop: axe()}},
  performance: {mobile: {runs: [run(1), run(2), run(3)]}, desktop: {runs: [run(1), run(2), run(3)]}},
}, ...overrides});
const get = (pages, id, options = {}) => assessCriteria(pages, options)[id];
const redirect = {url: 'http://example.test/', finalUrl: URL, status: 200, redirects: [{url: 'http://example.test/', status: 301, location: URL}]};

test('all 57 rubric criteria have honest typed diagnostics while all scores and ranks remain null', () => {
  const report = coverageReport([page()]);
  const rows = report.categories.flatMap(category => category.rows);
  assert.equal(rows.length, 57);
  assert.equal(report.rawScore, null);
  assert.equal(report.rank, null);
  assert.equal(Object.values(report.assessmentSummary.counts).reduce((a, b) => a + b, 0), 57);
  for (const category of report.categories) assert.equal(category.awardedPoints, null);
  for (const row of rows) {
    assert.equal(row.awardedPoints, null);
    assert.ok(['Issue detected', 'No issue detected', 'Needs review', 'Not measured'].includes(row.assessment.status), row.id);
    assert.equal(typeof row.assessment.automated, 'boolean', row.id);
    assert.ok(Array.isArray(row.assessment.measurements), row.id);
  }
});

test('empty and failed collection cannot become clean diagnostics', () => {
  const report = coverageReport([{id: 'failed', url: URL, http: {error: {code: 'ERR_NETWORK'}}, browser: {status: 'N/M'}}]);
  const rows = report.categories.flatMap(category => category.rows);
  assert.ok(rows.every(row => row.assessment.status !== 'No issue detected'));
  assert.equal(rows.find(row => row.id === 'performance.lcp').assessment.status, 'Not measured');
  assert.equal(rows.find(row => row.id === 'security.certificate').assessment.status, 'Not measured');
  const manual = rows.find(row => row.id === 'content.procedures').assessment;
  assert.equal(manual.automated, false);
  assert.equal(manual.status, 'Needs review');
});

test('HTTPS-only evidence is not enforcement and final HTTP/downgrade/browser navigation issues propagate', () => {
  assert.equal(get([page()], 'security.https').status, 'Needs review');
  assert.equal(get([page()], 'security.https', {httpRedirect: redirect}).status, 'No issue detected');
  assert.equal(get([page()], 'security.https', {httpRedirect: {...redirect, finalUrl: 'http://example.test/'}}).status, 'Issue detected');
  const downgrade = page('redirect', {http: response({redirects: [{url: URL, location: 'http://example.test/bridge', status: 302}]})});
  assert.equal(get([downgrade], 'security.https', {httpRedirect: redirect}).status, 'Issue detected');
  const browserDowngrade = page();
  browserDowngrade.browser.observations.mobile.finalUrl = 'http://example.test/';
  assert.equal(get([browserDowngrade], 'security.https', {httpRedirect: redirect}).status, 'Issue detected');
});

test('HTTP form actions are not misclassified as mixed content without an HTTPS document', () => {
  const httpOnly = page();
  for (const profile of ['mobile', 'desktop']) {
    httpOnly.browser.observations[profile].finalUrl = 'http://example.test/';
    httpOnly.browser.observations[profile].insecureFormActions = 1;
  }
  assert.equal(get([httpOnly], 'security.mixed-content').status, 'Not measured');
  const secureDocument = page();
  secureDocument.browser.observations.mobile.insecureFormActions = 1;
  assert.equal(get([secureDocument], 'security.mixed-content').status, 'Issue detected');
});

test('certificate evidence must be trust verified and does not certify all supported TLS configurations', () => {
  const trusted = get([page()], 'security.certificate');
  assert.equal(trusted.status, 'No issue detected');
  assert.equal(trusted.measurements[0].value.authorized, true);
  assert.equal(get([page('bad', {http: response({tls: {authorized: false}})})], 'security.certificate').status, 'Issue detected');
  assert.equal(get([page('missing', {http: response({tls: null})})], 'security.certificate').status, 'Not measured');
  const config = get([page()], 'security.tls-configuration');
  assert.equal(config.status, 'Needs review');
  assert.equal(config.automated, false);
  assert.equal(config.measurements[0].value.protocol, 'TLSv1.3');
});

test('HSTS parser distinguishes absence, disabling, invalid syntax, and shorter recommended lifetime', () => {
  assert.equal(parseHsts(null).present, false);
  assert.equal(parseHsts('max-age=0').maxAgeSeconds, 0);
  assert.ok(parseHsts('max-age=0').issues.length > 0);
  for (const value of ['max-age=oops', 'max-age=1;max-age=2', 'max-age="123', 'includeSubDomains']) {
    assert.equal(parseHsts(value).maxAgeSeconds, null, value);
  }
  assert.equal(parseHsts('max-age="31536000"; includeSubDomains; preload').includeSubDomains, true);
  const short = page('short', {http: response({headers: {'strict-transport-security': 'max-age=600'}})});
  assert.equal(get([short], 'security.hsts').status, 'Needs review');
  assert.equal(get([page('off', {http: response({headers: {'strict-transport-security': 'max-age=0'}})})], 'security.hsts').status, 'Issue detected');
});

test('CSP is parsed: a weak or report-only header is not protection by mere presence', () => {
  const absent = parseCsp(null, "default-src 'none'");
  assert.equal(absent.present, false);
  assert.equal(absent.reportOnly, true);
  const weak = parseCsp("default-src *; script-src 'unsafe-inline' 'unsafe-eval' https:");
  assert.equal(weak.present, true);
  assert.ok(weak.issues.some(issue => /Inline scripts/.test(issue)));
  assert.ok(weak.issues.some(issue => /unsafe-eval/.test(issue)));
  assert.ok(weak.issues.some(issue => /Broad/.test(issue)));
  assert.equal(parseCsp(strongCsp).issues.length, 0);
  assert.equal(parseCsp("script-src 'nonce-dGVzdA==' 'strict-dynamic' https: 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'").issues.length, 0);
  assert.ok(parseCsp("default-src 'none'; base-uri *; frame-ancestors *").issues.some(issue => /Broad/.test(issue)));
  assert.equal(get([page()], 'security.csp').status, 'No issue detected');
  assert.equal(get([page('weak', {http: response({headers: {'content-security-policy': 'default-src *'}})})], 'security.csp').status, 'Issue detected');
  assert.equal(get([page('report-only', {http: response({headers: {'content-security-policy-report-only': strongCsp}})})], 'security.csp').status, 'Issue detected');
  assert.equal(get([page('multiple', {http: response({headers: {'content-security-policy': `${strongCsp}, default-src *`}})})], 'security.csp').status, 'Needs review');
});

test('hardening checks inspect values, version exposure is not an EOL determination', () => {
  const bad = page('headers', {http: response({headers: {'x-content-type-options': 'invalid', 'x-frame-options': 'ALLOWALL', 'referrer-policy': 'unsafe-url', server: 'ExampleServer/1.2.3'}})});
  assert.equal(get([bad], 'security.security-headers').status, 'Issue detected');
  assert.equal(get([bad], 'security.version-exposure').status, 'Issue detected');
  assert.equal(get([bad], 'technical.obsolete-technology').status, 'Needs review');
  assert.equal(get([bad], 'technical.obsolete-technology').automated, false);
});

test('no observed cookies is not a secure-cookie pass and actual flags are retained', () => {
  const none = get([page()], 'security.cookies');
  assert.equal(none.status, 'Not measured');
  assert.equal(none.measurements.length, 0);
  const missing = page('cookie', {http: response({cookies: [{secure: false, httpOnly: false, sameSite: 'none'}]})});
  assert.equal(get([missing], 'security.cookies').status, 'Issue detected');
  const flags = {secure: true, httpOnly: true, sameSite: 'lax'};
  const secure = get([page('cookie', {http: response({cookies: [flags]})})], 'security.cookies');
  assert.equal(secure.status, 'No issue detected');
  assert.deepEqual(secure.measurements[0].value.cookies[0], flags);
});

test('poor performance runs, medians and spread survive across page/profile identities', () => {
  const first = page('home');
  const second = page('procedure', {url: 'https://example.test/procedure'});
  second.browser.performance.mobile.runs = [run(1, {LCP: 1000, CLS: 0.01, TBT: 50}), run(2, {LCP: 2000, CLS: 0.05, TBT: 100}), run(3, {LCP: 9000, CLS: 0.8, TBT: 2000, FCP: 5000, TTFB: 4000, transferBytes: 10000000})];
  const measured = assessCriteria([first, second]);
  for (const id of ['lcp', 'responsiveness', 'cls', 'server-content']) assert.equal(measured[`performance.${id}`].status, 'Issue detected', id);
  const lcp = measured['performance.lcp'].measurements.find(item => item.pageId === 'procedure' && item.profile === 'mobile');
  assert.equal(lcp.value.median, 2000);
  assert.equal(lcp.value.max, 9000);
  assert.equal(lcp.value.spread, 8000);
  assert.equal(lcp.value.runs[2].value, 9000);
  const resources = measured['performance.resources'].measurements.find(item => item.pageId === 'procedure' && item.profile === 'mobile');
  assert.equal(resources.value.max, 10000000);
  assert.equal(measured['performance.resources'].status, 'Needs review');
  assert.equal(measured['performance.consistency'].status, 'Needs review');
});

test('a failed or missing repeated performance run is not silently dropped into a pass', () => {
  const partial = page();
  partial.browser.performance.mobile.runs[2] = run(3, {}, {status: 'N/M', error: 'navigation timeout'});
  const measured = get([partial], 'performance.lcp');
  assert.equal(measured.status, 'Needs review');
  const mobile = measured.measurements.find(item => item.profile === 'mobile');
  assert.equal(mobile.value.count, 2);
  assert.equal(mobile.value.runs[2].value, null);
  assert.equal(mobile.value.runs[2].error, 'navigation timeout');
  partial.browser.performance.desktop.runs = [];
  assert.notEqual(get([partial], 'performance.lcp').status, 'No issue detected');
  partial.browser.performance.mobile.runs = [];
  assert.equal(get([partial], 'performance.lcp').status, 'Not measured');
});

test('axe rules map to relevant rows, incomplete and missing profiles cannot be passes', () => {
  const partial = page();
  partial.browser.accessibility.profiles.mobile.incomplete = [{id: 'color-contrast', nodes: [{target: ['main']}]}];
  assert.equal(get([partial], 'accessibility.contrast').status, 'Needs review');
  assert.equal(get([partial], 'accessibility.wcag').status, 'Needs review');
  partial.browser.accessibility.profiles.mobile.violations = [{id: 'image-alt', impact: 'critical', nodes: [{target: ['img']}]}];
  assert.equal(get([partial], 'accessibility.alt').status, 'Issue detected');
  assert.equal(get([partial], 'accessibility.form-access').status, 'Needs review');
  delete partial.browser.accessibility.profiles.desktop;
  assert.equal(get([partial], 'accessibility.language-aria').status, 'Needs review');
  partial.browser.observations = {mobile: null, desktop: null};
  partial.browser.accessibility.profiles = {};
  assert.equal(get([partial], 'accessibility.alt').status, 'Not measured');
});

test('DOM image, label, language, heading and mobile rectangle/reflow diagnostics attach actual values', () => {
  const observed = page();
  observed.browser.observations.mobile = observation({lang: null, images: {count: 3, withAlt: 1, missingAlt: 2, emptyAlt: 0},
    forms: {count: 1, controls: 3, controlsWithLabels: 1}, headings: {h1: 0, h2: 3},
    reflow: {viewportWidth: 390, documentWidth: 700, horizontalOverflow: true}, touchTargets: {checked: 8, below24: 2, below44: 4}});
  const measured = assessCriteria([observed]);
  for (const id of ['accessibility.alt', 'accessibility.form-access', 'accessibility.semantics', 'accessibility.language-aria', 'mobile.reflow']) {
    assert.equal(measured[id].status, 'Issue detected', id);
  }
  assert.equal(measured['mobile.touch'].status, 'Needs review');
  assert.equal(measured['mobile.touch'].measurements[0].value.below24, 2);
  assert.match(measured['mobile.touch'].measurements[0].method, /exceptions/);
  assert.equal(measured['content.multilingual'].status, 'Needs review');
  assert.equal(measured['technical.site-search'].status, 'Needs review');
});

test('robots/client/policy blocks are excluded from intrinsic broken resources but real errors remain', () => {
  const blocked = page();
  blocked.browser.blockedRequests = [{url: 'https://example.test/robots-blocked.js', reason: 'robots denied'}];
  blocked.browser.observations.mobile.resources.brokenLoadedResources = [
    {url: 'https://example.test/robots-blocked.js', error: 'net::ERR_FAILED'},
    {url: 'https://example.test/policy.css', error: 'net::ERR_BLOCKED_BY_CLIENT', blocked: false},
  ];
  let measured = get([blocked], 'technical.broken-resources');
  assert.equal(measured.status, 'Needs review');
  const mobile = measured.measurements.find(item => item.profile === 'mobile');
  assert.equal(mobile.value.failures.length, 0);
  assert.equal(mobile.value.excludedPolicyBlocked.length, 2);
  // A real HTTP failure must survive even if another request to that URL was blocked.
  blocked.browser.observations.mobile.resources.brokenLoadedResources.push({url: 'https://example.test/robots-blocked.js', status: 404});
  measured = get([blocked], 'technical.broken-resources');
  assert.equal(measured.status, 'Issue detected');
  assert.equal(measured.measurements[0].value.failures[0].status, 404);
});

test('constrained pages preserve findings but do not establish no-issue outcomes', () => {
  const constrained = page();
  constrained.browser.constrained = true;
  for (const id of ['performance.lcp', 'accessibility.contrast', 'mobile.reflow', 'technical.broken-resources']) {
    assert.equal(get([constrained], id).status, 'Needs review', id);
  }
  constrained.browser.observations.mobile.reflow.horizontalOverflow = true;
  assert.equal(get([constrained], 'mobile.reflow').status, 'Issue detected');
});

test('metadata/canonical diagnostics retain values and never equate present search with functional search', () => {
  const metadata = page();
  metadata.browser.observations.mobile.title = '';
  metadata.browser.observations.mobile.canonical = 'not a URL';
  assert.equal(get([metadata], 'technical.metadata').status, 'Issue detected');
  assert.equal(get([metadata], 'technical.canonical').status, 'Issue detected');
  assert.equal(get([metadata], 'technical.site-search').status, 'Needs review');
  const absent = page();
  absent.browser.observations.mobile.canonical = null;
  assert.equal(get([absent], 'technical.canonical').status, 'Needs review');
});

test('short successful monitoring remains incomplete, observed statistics and actual failures stay separate', () => {
  const sample = (minute, overrides = {}) => ({timestamp: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString(), endpoint: URL,
    intervalSeconds: 600, network: 'fixture', httpStatus: 200, elapsedMs: 200, ...overrides});
  const short = summarizeMonitoring([sample(0), sample(10)]);
  const uptime = get([page()], 'reliability.uptime', {monitoring: short});
  assert.equal(uptime.status, 'Needs review');
  assert.equal(uptime.measurements[0].value.sampleAvailabilityPercent, 100);
  assert.equal(uptime.measurements[0].value.completeDeclaredSchedule, false);
  const failed = summarizeMonitoring([sample(0), sample(10, {httpStatus: null, error: {code: 'ERR_TIMEOUT'}}), sample(20, {httpStatus: null, error: {code: 'ERR_ROBOTS_DENIED'}})]);
  const failures = get([page()], 'reliability.failures', {monitoring: failed});
  assert.equal(failures.status, 'Issue detected');
  assert.equal(failures.measurements[0].value.observedFailurePercent, 50);
  assert.equal(failures.measurements[0].value.excludedPolicyOrUnknownSamples, 1);
  const stability = get([page()], 'reliability.response-stability', {monitoring: failed});
  assert.equal(stability.measurements[0].value.responseTimeMs.p95, 200);
  assert.equal(stability.status, 'Needs review');
  assert.equal(get([page()], 'reliability.connection-continuity', {monitoring: failed}).status, 'Needs review');
});

test('error responses are unmeasured header evidence, not header defects', () => {
  const errorPage = status => page(`error-${status}`, {http: response({status, headers: {}})});
  for (const status of [404, 500, 502]) {
    assert.equal(get([errorPage(status)], 'security.hsts').status, 'Not measured', `hsts ${status}`);
    assert.equal(get([errorPage(status)], 'security.csp').status, 'Not measured', `csp ${status}`);
    assert.equal(get([errorPage(status)], 'security.security-headers').status, 'Not measured', `security-headers ${status}`);
    assert.equal(get([errorPage(status)], 'security.version-exposure').status, 'Not measured', `version-exposure ${status}`);
  }
  // navigation and TLS evidence remains valid on error responses
  assert.ok(get([errorPage(404)], 'security.https').measurements.some(item => item.metric === 'httpsFinalNavigation'));
  assert.equal(get([errorPage(404)], 'security.certificate').measurements.length, 1);
  // the same bare headers on a 2xx page are still assessed
  assert.equal(get([page('ok', {http: response({headers: {}})})], 'security.security-headers').status, 'Issue detected');
});

test('page-initiated request cancellations are not intrinsic breakage and not a pass', () => {
  const cancelled = page();
  cancelled.browser.observations.mobile.resources.brokenLoadedResources = [
    {url: 'https://example.test/preload.js', error: 'net::ERR_ABORTED'},
    {url: 'https://example.test/video.mp4', error: 'net::ERR_CANCELED'},
    {url: 'https://example.test/gone.css', error: 'net::ERR_CONNECTION_REFUSED'},
  ];
  let measured = get([cancelled], 'technical.broken-resources');
  assert.equal(measured.status, 'Issue detected');
  const mobile = measured.measurements.find(item => item.profile === 'mobile');
  assert.equal(mobile.value.failures.length, 1);
  assert.equal(mobile.value.failures[0].url, 'https://example.test/gone.css');
  assert.equal(mobile.value.excludedCancellations.length, 2);
  cancelled.browser.observations.mobile.resources.brokenLoadedResources = [{url: 'https://example.test/preload.js', error: 'net::ERR_ABORTED'}];
  measured = get([cancelled], 'technical.broken-resources');
  assert.equal(measured.status, 'Needs review');
  assert.equal(measured.measurements.find(item => item.profile === 'mobile').value.failures.length, 0);
});

test('recorded browser skip reasons are reported instead of generic unavailability', () => {
  const emptyBrowser = {status: 'N/M', observations: {}, errors: []};
  const skipped = page('skipped', {browser: emptyBrowser,
    browserSkipped: {reason: 'Document returned HTTP 503; browser evidence not collected.'}});
  const metadata = get([skipped], 'technical.metadata');
  assert.equal(metadata.status, 'Not measured');
  assert.match(metadata.reason, /Document returned HTTP 503/);
  const operator = page('operator', {browser: emptyBrowser,
    browserSkipped: {reason: 'HTTP-only mode selected by the operator; no browser observations collected.'}});
  assert.match(get([operator], 'technical.metadata').reason, /HTTP-only mode selected by the operator/);
});
