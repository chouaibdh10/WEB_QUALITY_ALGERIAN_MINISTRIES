// Diagnostic methods only: no PDF scoring thresholds, deductions or conformance claims.
export const ASSESSMENT_METHOD = 'passive-criterion-diagnostics/1.0';
const ISSUE = 'Issue detected';
const CLEAR = 'No issue detected';
const REVIEW = 'Needs review';
const UNMEASURED = 'Not measured';
const PROFILES = ['mobile', 'desktop'];
const own = (object, key) => Object.hasOwn(object ?? {}, key);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const measurement = (page, metric, value, extra = {}) => ({pageId: page.id, url: page.url ?? page.http?.url ?? null, metric, value, ...extra});
const sample = (page, profile, metric, value, extra = {}) => measurement(page, metric, value, {profile, ...extra});
const scope = 'Only declared sampled pages/profiles and observed responses, under collector GET/HEAD, robots, network and untouched-consent constraints. No whole-site or compliance conclusion.';
const result = (status, measurements, reason, automated = true) => ({status, automated, measurements, reason, scope});

export function parseHsts(value) {
  if (typeof value !== 'string' || !value.trim()) return {present: false, maxAgeSeconds: null, includeSubDomains: false, preload: false, issues: ['No HSTS header observed']};
  const fields = value.split(';').map(part => part.trim()).filter(Boolean);
  const ages = fields.filter(part => /^max-age\s*=/i.test(part));
  const match = ages.length === 1 ? /^max-age\s*=\s*(?:"(\d+)"|(\d+))$/i.exec(ages[0]) : null;
  const ageText = match?.[1] ?? match?.[2];
  const age = ageText !== undefined && Number.isSafeInteger(Number(ageText)) ? Number(ageText) : null;
  const issues = [];
  if (age === null) issues.push('Missing, duplicated or invalid max-age');
  else if (age === 0) issues.push('max-age=0 disables HSTS');
  return {present: true, maxAgeSeconds: age, includeSubDomains: fields.some(part => /^includesubdomains$/i.test(part)), preload: fields.some(part => /^preload$/i.test(part)), issues,
    belowOneYearRecommendation: age !== null && age < 31536000,
    reference: 'RFC 6797 max-age semantics; one year is an OWASP hardening recommendation, not a PDF grading threshold'};
}

export function parseCsp(value, reportOnly = null) {
  if (typeof value !== 'string' || !value.trim()) return {present: false, reportOnly: Boolean(reportOnly), policies: [], issues: ['No enforced CSP header observed; report-only is not enforcement']};
  const policies = value.split(',').map(text => {
    const directives = {};
    const issues = [];
    for (const part of text.split(';').map(part => part.trim()).filter(Boolean)) {
      const [rawName, ...tokens] = part.split(/\s+/);
      const name = rawName.toLowerCase();
      if (!/^[a-z][a-z0-9-]*$/.test(name)) { issues.push('Invalid directive name'); continue; }
      if (own(directives, name)) { issues.push(`Duplicate ${name}; later directive ignored by browsers`); continue; }
      directives[name] = tokens;
    }
    const scripts = directives['script-src-elem'] ?? directives['script-src'] ?? directives['default-src'];
    if (!scripts) issues.push('Scripts unrestricted: no script-src/default-src');
    else {
      const hasNonceOrHash = scripts.some(token => /^'(?:nonce-|sha(?:256|384|512)-)/i.test(token));
      if (scripts.includes("'unsafe-inline'") && !hasNonceOrHash) issues.push('Inline scripts allowed without nonce/hash');
      const strictDynamic = hasNonceOrHash && scripts.includes("'strict-dynamic'");
      if (!strictDynamic && scripts.some(token => ['*', 'http:', 'https:', 'data:'].includes(token))) issues.push('Broad or insecure script source');
    }
    const execution = directives['script-src'] ?? directives['default-src'] ?? [];
    if (execution.includes("'unsafe-eval'")) issues.push('String evaluation allowed by unsafe-eval');
    const objects = directives['object-src'] ?? directives['default-src'];
    if (!objects || objects.some(token => ['*', 'http:', 'https:', 'data:'].includes(token))) issues.push('Object/embed sources not tightly restricted');
    if (!own(directives, 'base-uri')) issues.push('No base-uri restriction');
    if (!own(directives, 'frame-ancestors')) issues.push('No frame-ancestors restriction (X-Frame-Options assessed separately)');
    for (const name of ['base-uri', 'frame-ancestors']) {
      if (directives[name]?.some(token => ['*', 'http:', 'https:', 'data:'].includes(token))) issues.push(`Broad or insecure ${name} source`);
    }
    return {directives, issues};
  });
  // Multiple enforced policies intersect. A weak policy alone is not proof that the
  // intersection is weak; retain each finding and require review in that case.
  return {present: true, reportOnly: Boolean(reportOnly), policies, issues: policies.flatMap(policy => policy.issues), multiplePolicies: policies.length > 1,
    reference: 'CSP Level 3 source-list/fallback semantics; static hardening heuristics, not proof of XSS protection'};
}

function stats(values) {
  const numbers = values.filter(finite).sort((a, b) => a - b);
  const count = numbers.length;
  return {count, median: count ? (numbers[Math.floor((count - 1) / 2)] + numbers[Math.floor(count / 2)]) / 2 : null,
    min: count ? numbers[0] : null, max: count ? numbers.at(-1) : null,
    spread: count ? numbers.at(-1) - numbers[0] : null};
}

function httpAssessment(pages, metric, inspect, reason, {tolerateErrorStatus = false} = {}) {
  const measurements = [];
  let issue = false;
  let review = false;
  let missing = false;
  for (const page of pages) {
    const status = page.http?.status;
    if (!status || (!tolerateErrorStatus && (status < 200 || status >= 400))) { missing = true; continue; }
    const finding = inspect(page.http, page);
    if (!finding) { missing = true; continue; }
    measurements.push(measurement(page, metric, finding.value, finding.extra));
    issue ||= finding.issue === true;
    review ||= finding.review === true;
  }
  return result(issue ? ISSUE : !measurements.length ? UNMEASURED : missing || review ? REVIEW : CLEAR, measurements,
    `${reason}${missing ? ' Some declared pages have no usable HTTP measurement.' : ''}`);
}

function browserAssessment(pages, metric, inspect, {profiles = PROFILES, manual = false, reason} = {}) {
  const measurements = [];
  let issue = false;
  let missing = false;
  let review = manual;
  for (const page of pages) {
    review ||= page.browser?.constrained === true;
    for (const profile of profiles) {
      const observation = page.browser?.observations?.[profile];
      if (!observation || (observation.httpStatus && observation.httpStatus >= 400)) { missing = true; continue; }
      const finding = inspect(observation, page, profile);
      if (!finding) { missing = true; continue; }
      measurements.push(sample(page, profile, metric, finding.value, finding.extra));
      issue ||= finding.issue === true;
      review ||= finding.review === true;
    }
  }
  const skipNotes = pages.flatMap(page => page.browserSkipped?.reason ? [` ${page.id}: ${page.browserSkipped.reason}`] : []).join('');
  return result(issue ? ISSUE : !measurements.length ? UNMEASURED : missing || review ? REVIEW : CLEAR, measurements,
    `${reason}${missing ? ` Some declared page/profile observations are unavailable; absence of findings is not a pass.${skipNotes}` : ''}`);
}

const axeMatchers = {
  'accessibility.wcag': () => true,
  'accessibility.contrast': id => /contrast/.test(id),
  'accessibility.alt': id => /(?:image-alt|input-image-alt|area-alt|object-alt|svg-img-alt|image-redundant-alt)/.test(id),
  'accessibility.form-access': id => /(?:label|autocomplete|input-button-name|select-name|form-field|aria-input-field-name)/.test(id),
  'accessibility.semantics': id => /(?:heading|landmark|region|list|definition-list|dlitem)/.test(id),
  'accessibility.language-aria': id => /^(?:html-|valid-lang|aria-)/.test(id),
};

function axeAssessment(pages, id) {
  const measurements = [];
  let issue = false;
  let incomplete = false;
  let missing = false;
  let constrained = false;
  for (const page of pages) {
    constrained ||= page.browser?.constrained === true;
    for (const profile of PROFILES) {
      const axe = page.browser?.accessibility?.profiles?.[profile];
      if (!axe?.testEngine || !Array.isArray(axe.violations) || !Array.isArray(axe.incomplete)) { missing = true; continue; }
      const rules = entries => entries.filter(rule => axeMatchers[id](rule.id)).map(rule => ({id: rule.id, impact: rule.impact ?? null,
        affectedNodes: rule.nodes?.length ?? null, helpUrl: rule.helpUrl ?? null}));
      const violations = rules(axe.violations);
      const unresolved = rules(axe.incomplete);
      issue ||= violations.length > 0;
      incomplete ||= unresolved.length > 0;
      measurements.push(sample(page, profile, 'axeRules', {violations, incomplete: unresolved, testEngine: axe.testEngine}));
    }
  }
  return result(issue ? ISSUE : !measurements.length ? UNMEASURED : incomplete || missing || constrained ? REVIEW : CLEAR, measurements,
    'Mapped axe WCAG-tagged rules only; findings need human verification, incomplete rules need review, and zero automated findings never establish WCAG conformance. Missing profiles or policy-constrained pages cannot be a pass.');
}

function combine(first, second) {
  const statuses = [first.status, second.status];
  const status = statuses.includes(ISSUE) ? ISSUE : statuses.every(value => value === UNMEASURED) ? UNMEASURED
    : statuses.includes(REVIEW) || statuses.includes(UNMEASURED) ? REVIEW : CLEAR;
  return result(status, [...first.measurements, ...second.measurements], `${first.reason} ${second.reason}`);
}

const metricMethods = {
  LCP: {unit: 'ms', good: 2500, poor: 4000, reference: 'https://web.dev/articles/lcp — CWV good <=2500 ms, poor >4000 ms; applied to lab runs diagnostically, not field p75 or PDF points'},
  CLS: {unit: 'unitless', good: 0.1, poor: 0.25, reference: 'https://web.dev/articles/cls — CWV good <=0.1, poor >0.25; lab observations, not field p75 or PDF points'},
  TBT: {unit: 'ms', good: 200, poor: 600, reference: 'https://web.dev/articles/tbt — lab good <=200 ms, poor >600 ms; TBT proxy is NOT field INP'},
  FCP: {unit: 'ms', good: 1800, poor: 3000, reference: 'https://web.dev/articles/fcp — good <=1800 ms, poor >3000 ms; lab diagnostic, not PDF points'},
  TTFB: {unit: 'ms', reference: 'Lighthouse server-response-time: root-document response only; excludes connection/redirect time, not end-to-end TTFB'},
  transferBytes: {unit: 'bytes', reference: 'Lighthouse total-byte-weight; observed bytes, no approved page-weight budget'},
};

function performanceAssessment(pages, keys, {consistency = false, reason} = {}) {
  const measurements = [];
  let issue = false;
  let missing = false;
  let constrained = false;
  for (const page of pages) {
    constrained ||= page.browser?.constrained === true;
    for (const profile of PROFILES) {
      const runs = page.browser?.performance?.[profile]?.runs ?? [];
      const expected = page.browser?.settings?.runsPerProfile;
      if (!runs.length || (finite(expected) && runs.length !== expected)) missing = true;
      for (const key of keys) {
        const method = metricMethods[key];
        const runValues = runs.map(run => ({index: run.index, status: run.status,
          value: run.status === 'Collected' && finite(run.metrics?.[key]) ? run.metrics[key] : null,
          error: run.error ?? null}));
        const values = runValues.map(run => run.value).filter(finite);
        if (runValues.some(run => run.value === null) || !values.length) missing = true;
        if (!values.length) continue;
        const summary = stats(values);
        const classifications = values.map(value => method.good === undefined ? 'Unclassified' : value <= method.good ? 'Good diagnostic range' : value > method.poor ? 'Poor diagnostic range' : 'Needs improvement diagnostic range');
        issue ||= !consistency && method.good !== undefined && values.some(value => value > method.good);
        if (consistency && values.length < 2) missing = true;
        measurements.push(sample(page, profile, key, {...summary, runs: runValues, classifications}, {unit: method.unit, method: method.reference,
          interpretation: consistency ? 'Within-page/profile spread only; compare retained page/profile identities, not pooled device results' : 'Worst observed threshold exceedance propagates even when median is good'}));
      }
    }
  }
  const unclassified = consistency || keys.some(key => metricMethods[key].good === undefined);
  return result(issue ? ISSUE : !measurements.length ? UNMEASURED : missing || constrained || unclassified ? REVIEW : CLEAR, measurements,
    `${reason} Repeated values, median, minimum, maximum and absolute spread are retained per page/profile. No field data or INP inferred; no PDF grading thresholds or points. ${missing ? 'Missing/failed runs or insufficient repetitions prevent a clean diagnostic.' : ''}`);
}

const manualReasons = {
  'security.tls-configuration': 'One trust-verified TLS connection cannot enumerate supported protocols/ciphers. Requires an approved protocol/cipher assessment; no active enumeration performed.',
  'security.configuration-exposure': 'Requires reviewed public-page configuration disclosures. Sensitive-path guessing and configuration probing are deliberately excluded.',
  'accessibility.keyboard': 'Requires a human keyboard-only path through representative controls; passive collection does not activate controls.',
  'accessibility.focus': 'Requires human focus-indicator visibility and obscuring checks during interaction; static screenshots are insufficient.',
  'accessibility.complete-process': 'Requires a complete citizen process with manual assistive-technology and interaction checks; no forms submitted.',
  'mobile.navigation': 'Requires a defined citizen task and human navigation/information-architecture assessment.',
  'mobile.journey': 'Requires standardized citizen-task completion observations; passive visits do not establish task success.',
  'mobile.recovery': 'Requires controlled error/recovery/help interaction; no invalid forms or destructive actions exercised.',
  'content.identity': 'Requires independent official-source ownership and identity verification; HTTPS/domain appearance is insufficient.',
  'content.mission': 'Requires a reviewer to verify mission and organization content, not infer it from a link label.',
  'content.service-list': 'Requires review of actual public-service coverage and findability, not link-count heuristics.',
  'content.procedures': 'Requires human review of procedures, eligibility, completeness and currency.',
  'content.documents': 'Requires verification of required forms/documents/instructions and their applicability; downloads not tested.',
  'content.service-function': 'Requires authorized non-destructive service click-through and form checks; GET observations do not establish functionality.',
  'content.contact': 'Requires a reviewed usable contact/feedback channel; no messages or forms submitted.',
  'content.dates': 'Requires verification of publication/update dates on a representative content sample.',
  'content.clarity': 'Requires human clarity, language quality and cross-page consistency review.',
  'technical.links': 'Discovered URLs are not visited by link discovery. Requires an eligible representative crawl and manual broken-link validation, not a homepage inference.',
  'technical.obsolete-technology': 'Requires a verified public fingerprint and authoritative vendor support/EOL lookup; version disclosure alone is not proof of obsolescence.',
};

/** Return independently interpretable diagnostics keyed by the exact 57 rubric IDs. */
export function assessCriteria(pages, {robotsEvidence = [], monitoring = null, httpRedirect = null} = {}) {
  const assessments = Object.fromEntries(Object.entries(manualReasons).map(([id, reason]) => [id, result(REVIEW, [], reason, false)]));
  const http = (id, metric, inspect, reason, options) => { assessments[id] = httpAssessment(pages, metric, inspect, reason, options); };
  const browser = (id, metric, inspect, options) => { assessments[id] = browserAssessment(pages, metric, inspect, options); };

  http('security.https', 'httpsFinalNavigation', response => ({value: {finalUrl: response.finalUrl ?? null, redirects: response.redirects ?? []},
    issue: (typeof response.finalUrl === 'string' && !response.finalUrl.startsWith('https:'))
      || response.redirects?.some(hop => hop.url?.startsWith('https:') && hop.location?.startsWith('http:')),
    review: !response.finalUrl}),
  'Inspect final URLs and downgrade hops in redirect chains. HTTP entrypoint must actually redirect to HTTPS; an HTTPS-only sample does not prove HTTP enforcement.', {tolerateErrorStatus: true});
  const https = assessments['security.https'];
  if (httpRedirect?.status && httpRedirect.finalUrl) {
    const enforced = httpRedirect.url?.startsWith('http:') && httpRedirect.finalUrl.startsWith('https:') && httpRedirect.redirects?.length > 0
      && httpRedirect.status >= 200 && httpRedirect.status < 400;
    https.measurements.push({metric: 'httpEntrypointRedirect', url: httpRedirect.url ?? null, value: {enforced: Boolean(enforced), finalUrl: httpRedirect.finalUrl, status: httpRedirect.status, redirects: httpRedirect.redirects ?? []}});
    if (!httpRedirect.finalUrl.startsWith('https:')) https.status = ISSUE;
    else if (!enforced && https.status !== ISSUE) https.status = REVIEW;
    else if (https.status === UNMEASURED) https.status = REVIEW;
  } else if (https.status === CLEAR) https.status = REVIEW;
  for (const page of pages) {
    for (const [profile, observation] of Object.entries(page.browser?.observations ?? {})) {
      if (!observation?.finalUrl) continue;
      https.measurements.push(sample(page, profile, 'browserFinalUrl', observation.finalUrl));
      if (https.status === UNMEASURED) https.status = REVIEW;
      if (!observation.finalUrl.startsWith('https:')) https.status = ISSUE;
    }
  }

  http('security.certificate', 'verifiedTls', response => response.tls ? {value: response.tls, issue: response.tls.authorized === false,
    review: response.tls.authorized !== true || !response.tls.certificateExpiresAt || !response.tls.certificateNotBefore} : null,
  'Node HTTPS uses rejectUnauthorized=true and hostname verification before recording authorized TLS metadata. Validity is verified at connection time, not reinterpreted against report-generation time. Failed connections provide no positive certificate evidence.', {tolerateErrorStatus: true});
  assessments['security.tls-configuration'].measurements = pages.filter(page => page.http?.tls).map(page =>
    measurement(page, 'singleNegotiatedTlsConnection', {protocol: page.http.tls.protocol ?? null, cipher: page.http.tls.cipher ?? null,
      authorized: page.http.tls.authorized ?? null, limitation: 'Not an enumeration of server-supported protocols/ciphers'}));
  http('security.hsts', 'hsts', response => {
    const value = parseHsts(response.headers?.['strict-transport-security']);
    return {value, issue: value.issues.length > 0, review: value.belowOneYearRecommendation || !response.finalUrl?.startsWith('https:')};
  }, 'Parsed HSTS max-age and subdomain/preload directives; zero disables enforcement. Shorter-than-one-year policies need hardening review; includeSubDomains/preload require deployment review, not automatic compliance.');
  http('security.csp', 'csp', response => {
    const value = parseCsp(response.headers?.['content-security-policy'], response.headers?.['content-security-policy-report-only']);
    return {value, issue: !value.present || (!value.multiplePolicies && value.issues.length > 0), review: value.multiplePolicies};
  }, 'Parse enforced CSP directives and script/object/base/framing restrictions, not mere header presence. Multi-policy intersections and nonces/hashes require review; static heuristics do not establish security.');
  http('security.security-headers', 'hardeningHeaders', response => {
    const headers = response.headers ?? {};
    const value = Object.fromEntries(['x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy', 'cross-origin-resource-policy'].map(name => [name, headers[name] ?? null]));
    const csp = parseCsp(headers['content-security-policy']);
    const framed = csp.policies.some(policy => own(policy.directives, 'frame-ancestors')
      && policy.directives['frame-ancestors'].length > 0 && !policy.directives['frame-ancestors'].includes('*'));
    const issues = [];
    if (headers['x-content-type-options']?.trim().toLowerCase() !== 'nosniff') issues.push('Missing/invalid X-Content-Type-Options: nosniff');
    if (!framed && !/^(?:deny|sameorigin)$/i.test(headers['x-frame-options']?.trim() ?? '')) issues.push('No observed restrictive framing policy');
    const referrer = headers['referrer-policy']?.split(',').map(part => part.trim().toLowerCase()).filter(part => ['no-referrer', 'no-referrer-when-downgrade', 'origin', 'origin-when-cross-origin', 'same-origin', 'strict-origin', 'strict-origin-when-cross-origin', 'unsafe-url'].includes(part)).at(-1);
    if (!referrer || ['unsafe-url', 'no-referrer-when-downgrade'].includes(referrer)) issues.push('Missing or less privacy-restrictive explicit Referrer-Policy');
    return {value: {...value, issues}, issue: issues.length > 0};
  }, 'OWASP-style explicit nosniff, framing and referrer hardening diagnostics. Optional permissions/cross-origin headers are inventoried, not universally required; contextual deployment review remains necessary.');
  http('security.cookies', 'observedCookieFlags', response => {
    if (!response.cookies?.length) return null;
    const issues = response.cookies.flatMap((cookie, index) => [!cookie.secure && `Cookie ${index + 1}: Secure absent`, cookie.sameSite === 'none' && !cookie.secure && `Cookie ${index + 1}: SameSite=None without Secure`].filter(Boolean));
    const review = response.cookies.some(cookie => !cookie.httpOnly || !cookie.sameSite);
    return {value: {count: response.cookies.length, cookies: response.cookies, issues}, issue: issues.length > 0, review};
  }, 'Only observed Set-Cookie flags are assessed, without values or names. No observed cookies means not measured, never secure. Missing HttpOnly/SameSite needs purpose/session review; HttpOnly is not required for every non-session cookie.', {tolerateErrorStatus: true});
  http('security.version-exposure', 'softwareExposure', response => {
    const headers = response.headers ?? {};
    const disclosed = Object.fromEntries(['server', 'x-powered-by'].filter(key => headers[key]).map(key => [key, headers[key]]));
    const versions = Object.entries(disclosed).filter(([, value]) => /\b\d+\.\d+(?:\.\d+)?\b/.test(value));
    return {value: {headers: disclosed, explicitVersionHeaders: versions.map(([key]) => key)}, issue: versions.length > 0, review: Boolean(headers['x-powered-by'])};
  }, 'Passive Server/X-Powered-By headers only; explicit numeric versions are an exposure diagnostic, not proof of vulnerability. DOM fingerprints and support status require review.');

  browser('security.mixed-content', 'insecureResourceHints', observation => {
    try { if (new URL(observation.finalUrl).protocol !== 'https:') return null; }
    catch { return null; }
    const resources = observation.resources?.brokenLoadedResources;
    if (!Array.isArray(resources)) return null;
    const mixed = resources.filter(resource => /mixed.?content/i.test(`${resource.error ?? ''} ${resource.blockedReason ?? ''}`));
    return {value: {documentUrl: observation.finalUrl ?? null, mixedContentFailures: mixed, insecureFormActions: observation.insecureFormActions ?? null}, issue: mixed.length > 0 || observation.insecureFormActions > 0, review: true};
  }, {reason: 'Requires an HTTPS document: HTTP-only pages do not establish mixed-content behavior. Mixed-content failures and HTTPS-page insecure form actions are observed hints; zero hints is not proof of no mixed content.'});
  browser('security.tracking', 'thirdPartyReviewContext', observation => ({value: {finalUrl: observation.finalUrl ?? null, consent: observation.consent ?? 'Untouched'}, review: true}),
    {manual: true, reason: 'Tracker classification and privacy restraint require request-purpose and consent review. Passive page observations do not establish absence of tracking.'});

  assessments['performance.lcp'] = performanceAssessment(pages, ['LCP'], {reason: 'LCP lab diagnostic compared with published CWV reference ranges.'});
  assessments['performance.responsiveness'] = performanceAssessment(pages, ['TBT'], {reason: 'TBT is a lab-only main-thread blocking proxy, not measured INP or full responsiveness.'});
  assessments['performance.cls'] = performanceAssessment(pages, ['CLS'], {reason: 'CLS lab diagnostic compared with published CWV reference ranges; untouched pages omit interaction shifts.'});
  assessments['performance.server-content'] = performanceAssessment(pages, ['FCP', 'TTFB'], {reason: 'FCP diagnostic plus unclassified root-document response times; browser/HTTP timing contexts are not pooled.'});
  assessments['performance.resources'] = performanceAssessment(pages, ['transferBytes'], {reason: 'Observed transfer-byte totals; no arbitrary byte budget or efficiency grade.'});
  assessments['performance.consistency'] = performanceAssessment(pages, Object.keys(metricMethods), {consistency: true, reason: 'Within-profile repeated-run spread; representative pages and network conditions require review. No arbitrary consistency threshold.'});

  for (const id of Object.keys(axeMatchers)) assessments[id] = axeAssessment(pages, id);
  const supplement = (id, metric, inspect, options) => { assessments[id] = combine(assessments[id], browserAssessment(pages, metric, inspect, options)); };
  supplement('accessibility.alt', 'imageAltAttributes', observation => observation.images && own(observation.images, 'missingAlt') ? {value: observation.images, issue: observation.images.missingAlt > 0} : null,
    {reason: 'DOM missing-alt counts supplement axe. Empty alt can be correct for decorative images; usefulness and image purpose require review.'});
  supplement('accessibility.form-access', 'formLabels', observation => observation.forms && finite(observation.forms.controls) && finite(observation.forms.controlsWithLabels)
    ? {value: observation.forms, issue: observation.forms.controlsWithLabels < observation.forms.controls, review: observation.forms.controls > 0} : null,
    {reason: 'DOM association/ARIA/title label hints are not proof of accessible names, instructions or error handling; real form use requires review.'});
  supplement('accessibility.semantics', 'headingAndLandmarkOutline', observation => observation.headings ? {value: {headings: observation.headings, landmarks: observation.semanticLandmarks ?? null},
    issue: observation.headings.h1 === 0, review: !observation.semanticLandmarks || observation.headings.h1 > 1} : null,
    {reason: 'Heading counts and landmark presence are structural hints, not a verified logical outline. Missing h1 is a reviewable structural diagnostic, not automatic WCAG failure.'});
  supplement('accessibility.language-aria', 'declaredPageLanguage', observation => own(observation, 'lang') ? {value: {lang: observation.lang, detectedLanguages: observation.detectedLanguages ?? null}, issue: !observation.lang?.trim()} : null,
    {reason: 'Missing html lang is detected; declared language correctness and ARIA interaction behavior need manual review.'});
  const reflow = {reason: 'Measured horizontal overflow at collected viewport widths only, not WCAG 320 CSS px/400% zoom, orientation or exception validation.'};
  const reflowInspect = observation => observation.reflow && typeof observation.reflow.horizontalOverflow === 'boolean' ? {value: observation.reflow, issue: observation.reflow.horizontalOverflow} : null;
  browser('accessibility.zoom', 'viewportReflow', reflowInspect, {...reflow, manual: true});
  browser('mobile.reflow', 'viewportReflow', reflowInspect, {...reflow, profiles: ['mobile']});
  browser('mobile.touch', 'touchTargetRectangles', observation => observation.touchTargets && finite(observation.touchTargets.checked) && observation.touchTargets.checked > 0
    ? {value: {viewport: observation.viewport ?? null, ...observation.touchTargets}, review: true,
      extra: {method: 'Visible interactive bounding boxes: below24 and below44 CSS px; WCAG 2.2 2.5.8 has spacing/inline/equivalent/user-agent/essential exceptions, 44 px is enhanced guidance, not universal AA minimum'}} : null,
    {profiles: ['mobile'], manual: true, reason: 'Touch rectangle diagnostics only. Readability, exceptions, overlap and target spacing require manual mobile review; zero interactive targets is not measured.'});
  browser('mobile.mobile-forms', 'mobileFormObservations', observation => observation.forms?.count > 0 ? {value: {forms: observation.forms, reflow: observation.reflow ?? null, insecureFormActions: observation.insecureFormActions ?? null},
    issue: observation.forms.controlsWithLabels < observation.forms.controls || observation.insecureFormActions > 0, review: true} : null,
    {profiles: ['mobile'], manual: true, reason: 'Only observed mobile forms; usability, keyboard, errors and submission are not exercised. No observed forms means not measured, not usable.'});
  browser('mobile.interface', 'interfaceSample', observation => ({value: {title: observation.title ?? null, lang: observation.lang ?? null, viewport: observation.viewport ?? null, headings: observation.headings ?? null}, review: true}),
    {manual: true, reason: 'Page/profile identities retained for interface comparison; a reviewer must compare visual and interaction consistency across representative pages.'});
  browser('content.multilingual', 'languageHints', observation => own(observation, 'lang') || Array.isArray(observation.detectedLanguages)
    ? {value: {htmlLang: observation.lang ?? null, detectedLanguages: observation.detectedLanguages ?? null}, review: true} : null,
    {manual: true, reason: 'html lang/hreflang hints only; translated content completeness, quality, language parity and applicable language requirements are not inferred from declarations.'});

  for (const [suffix, detail] of Object.entries({uptime: 'Observed request availability is not continuous uptime.', failures: 'Observed failed requests and exclusions are retained, not assumed successful.',
    'response-stability': 'Median/p90/p95 observed response times retained per endpoint, with no invented stability cutoff.',
    'connection-continuity': 'Only observed connection failures; summary cannot distinguish all DNS/TLS/redirect failure classes.', endpoints: 'Declared endpoints remain separate; critical-service representativeness requires human approval.'})) {
    const endpoints = monitoring?.endpoints ?? [];
    const available = endpoints.filter(endpoint => suffix === 'response-stability' ? endpoint.responseTimeMs?.count > 0 : endpoint.observations > 0);
    assessments[`reliability.${suffix}`] = result(!available.length ? UNMEASURED : endpoints.some(endpoint => endpoint.failedObservations > 0) && !['response-stability', 'connection-continuity'].includes(suffix) ? ISSUE : REVIEW,
      endpoints.map(endpoint => ({url: endpoint.endpoint, metric: 'observedMonitoring', value: {...endpoint,
        observedFailurePercent: endpoint.observations > 0 ? endpoint.failedObservations / endpoint.observations * 100 : null}})),
      `${detail} A complete declared 28-day schedule with gaps/exclusions reviewed is required; ${endpoints.length && endpoints.every(endpoint => endpoint.completeDeclaredSchedule) ? 'declared schedule reached, but independent network/endpoint and human review remains required.' : '28-day completeness is not established.'}`);
  }

  browser('technical.broken-resources', 'observedResourceFailures', (observation, page) => {
    const resources = observation.resources?.brokenLoadedResources;
    if (!Array.isArray(resources)) return null;
    const policyUrls = new Set((page.browser?.blockedRequests ?? []).map(request => request.url));
    const excluded = resources.filter(resource => !(finite(resource.status) && resource.status >= 400)
      && (resource.blocked || policyUrls.has(resource.url) || /(?:ERR_BLOCKED_BY_CLIENT|BlockedByClient|robots|policy)/i.test(resource.error ?? '')));
    const cancellations = resources.filter(resource => !excluded.includes(resource) && !(finite(resource.status) && resource.status >= 400)
      && /(?:ERR_ABORTED|ERR_CANCELED)/i.test(resource.error ?? ''));
    const failures = resources.filter(resource => !excluded.includes(resource) && !cancellations.includes(resource)
      && ((finite(resource.status) && resource.status >= 400) || Boolean(resource.error)));
    return {value: {failures, excludedPolicyBlocked: excluded, excludedCancellations: cancellations, checkedScope: 'Observed loaded requests only; not every declared image/link'},
      issue: failures.length > 0, review: excluded.length > 0 || cancellations.length > 0};
  }, {reason: 'Observed HTTP/network resource failures exclude collector/robots/client-policy blocks and page-initiated request cancellations (ERR_ABORTED/ERR_CANCELED), which constrain the sample instead of proving intrinsic breakage; constrained samples need review, not a pass.'});
  browser('technical.metadata', 'pageMetadata', observation => own(observation, 'title') || own(observation, 'description') ? {value: {title: observation.title ?? null, description: observation.description ?? null},
    issue: !observation.title?.trim() || !observation.description?.trim(), review: true} : null,
    {manual: true, reason: 'Missing/empty title or description detected; meaningfulness, uniqueness and content relevance require human review, not arbitrary character cutoffs.'});
  browser('technical.canonical', 'canonicalDeclaration', (observation, page) => {
    if (!own(observation, 'canonical')) return null;
    let canonical = null;
    let invalid = false;
    try { if (observation.canonical) { canonical = new URL(observation.canonical); invalid = !['https:', 'http:'].includes(canonical.protocol); } } catch { invalid = true; }
    return {value: {canonical: observation.canonical, finalUrl: observation.finalUrl ?? null, declaredUrl: page.url ?? page.http?.url ?? null}, issue: invalid,
      review: !canonical || !observation.finalUrl || canonical.href !== observation.finalUrl};
  }, {reason: 'Canonical declaration and final URL compared; absence/different canonical needs contextual review, not automatic defect. Query-free redacted evidence cannot establish all URL normalization behavior.'});
  browser('technical.site-search', 'searchPresence', observation => observation.search ? {value: observation.search, review: true} : null,
    {manual: true, reason: 'Search control detection is not functional search. A reviewer must submit a non-sensitive query and assess results/findability; collector performs no submissions.'});
  browser('technical.cross-page', 'technicalPageComparison', observation => ({value: {finalUrl: observation.finalUrl ?? null, lang: observation.lang ?? null, title: observation.title ?? null,
    canonical: observation.canonical ?? null, viewport: observation.viewport ?? null, headings: observation.headings ?? null}, review: true}),
    {manual: true, reason: 'Retained separate page/profile metadata supports technical comparison; sample representativeness and intended differences require review, not equality-as-quality heuristics.'});
  const crawlMeasurements = [...robotsEvidence.map(value => ({url: value.origin, metric: 'robotsPolicy', value})),
    ...pages.filter(page => page.sitemap).map(page => measurement(page, 'sitemapResponse', {status: page.sitemap.status ?? null, finalUrl: page.sitemap.finalUrl ?? null, error: page.sitemap.error ?? null}))];
  assessments['technical.crawlability'] = result(crawlMeasurements.length ? REVIEW : UNMEASURED, crawlMeasurements,
    'robots policy and sitemap response are measured availability/configuration evidence, not verified indexability. Missing/denied robots can be intentional; sitemap XML validity, directives and URL eligibility require review.');
  return assessments;
}


export function summarizeAssessments(rows) {
  const counts = Object.fromEntries([ISSUE, CLEAR, REVIEW, UNMEASURED].map(status => [status, rows.filter(row => row.assessment.status === status).length]));
  return {method: ASSESSMENT_METHOD, counts, totalCriteria: rows.length,
    automatedCriteria: rows.filter(row => row.assessment.automated).length,
    criteriaWithMeasurements: rows.filter(row => row.assessment.measurements.length > 0).length,
    note: 'Diagnostic counts are not points, deductions, compliance, site-wide absence claims or rank. Shared findings can inform multiple criteria without duplicate scoring: no scores are awarded.'};
}
