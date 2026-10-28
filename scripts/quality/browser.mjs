import {mkdir, chmod, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import puppeteer from 'puppeteer-core';
import {launch} from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import axe from 'axe-core';

const require = createRequire(import.meta.url);
const lighthouseVersion = require('lighthouse/package.json').version;
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const PROFILES = {
  mobile: {width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true},
  desktop: {width: 1365, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false},
};
const METRICS = {
  LCP: ['largest-contentful-paint', 'ms', 'Largest Contentful Paint'],
  CLS: ['cumulative-layout-shift', 'unitless', 'Cumulative Layout Shift'],
  FCP: ['first-contentful-paint', 'ms', 'First Contentful Paint'],
  TBT: ['total-blocking-time', 'ms', 'Total Blocking Time (lab responsiveness proxy, not INP)'],
  TTFB: ['server-response-time', 'ms', 'Root-document server response time (Lighthouse TTFB audit, excludes connection/redirect time)'],
  transferBytes: ['total-byte-weight', 'bytes', 'Total network transfer bytes'],
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function safeUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return `${url.protocol}[redacted]`;
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.href;
  } catch { return '[invalid URL]'; }
}

// Reports are private, but still discard cookies, DOM snippets and request bodies.
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  if (typeof value.name === 'string' && /^(?:set-cookie|cookie|authorization|proxy-authorization)$/i.test(value.name)) {
    return {name: value.name, value: '[redacted]'};
  }
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (/cookie|authorization|postdata|requestbody|^html$|^snippet$|^nodeLabel$/i.test(key)) continue;
    if (/url$/i.test(key) && typeof item === 'string' && /^https?:/i.test(item)) result[key] = safeUrl(item);
    else result[key] = redact(item);
  }
  return result;
}

export function axeEvidence(result) {
  const rules = entries => entries.map(rule => ({
    id: rule.id, impact: rule.impact, tags: rule.tags,
    description: rule.description, help: rule.help, helpUrl: rule.helpUrl,
    nodes: rule.nodes.map(node => ({
      impact: node.impact,
      // No element HTML, visible text, form values, or check data are retained.
      target: node.target.map(selector => typeof selector === 'string'
        ? selector.replace(/\[[^\]]*\]/g, '[attribute-redacted]') : '[nested selector]'),
      checks: [...node.any, ...node.all, ...node.none].map(check => ({id: check.id, impact: check.impact, message: check.message})),
    })),
  }));
  return {
    testEngine: result.testEngine, testRunner: result.testRunner,
    timestamp: result.timestamp, url: safeUrl(result.url), tags: WCAG_TAGS,
    violations: rules(result.violations), incomplete: rules(result.incomplete),
    passesCount: result.passes.length, inapplicableCount: result.inapplicable.length,
    limitations: 'Automated WCAG checks are not a conformance determination; manual review remains necessary.',
  };
}

/** Every metric key present with null so failed runs never look like measured zeros or drop keys. */
function nullMetrics() {
  return Object.fromEntries(Object.keys(METRICS).map(key => [key, null]));
}

function measurements(lhr) {
  const values = {};
  for (const [key, [auditId]] of Object.entries(METRICS)) {
    const audit = lhr.audits?.[auditId];
    const number = audit?.numericValue;
    values[key] = audit && !['error', 'notApplicable'].includes(audit.scoreDisplayMode) && Number.isFinite(number)
      ? number : null;
  }
  return values;
}

export function aggregate(runs) {
  const result = {};
  for (const [key, [, unit, label]] of Object.entries(METRICS)) {
    const numbers = runs.filter(run => run.status === 'Collected')
      .map(run => run.metrics[key]).filter(Number.isFinite).sort((a, b) => a - b);
    const count = numbers.length;
    result[key] = {
      median: count ? (numbers[Math.floor((count - 1) / 2)] + numbers[Math.ceil((count - 1) / 2)]) / 2 : null,
      min: count ? numbers[0] : null, max: count ? numbers[count - 1] : null,
      p90: count ? numbers[Math.ceil(count * 0.9) - 1] : null,
      count, unit, label,
    };
  }
  return result;
}

/** Attach Fetch interception recursively before any measured navigation.
 * The explicit page passed to Lighthouse prevents its creation of an unguarded page.
 * Child targets are auto-attached paused, guarded, then resumed, including OOPIFs/workers.
 */
async function installSafety(browser, collector, url, blockedRequests, errors) {
  const root = await browser.target().createCDPSession();
  const origin = new URL(url).origin;
  const targetHost = new URL(url).hostname.replace(/^www\./i, '');
  const ready = new Map();
  const resources = [];
  const queue = [];
  const inFlight = new Map();
  let active = 0;
  let disposed = false;
  let fatal = null;
  const keyFor = (session, id) => `${session.id()}:${id}`;
  const recordBlock = (requestUrl, reason) => {
    blockedRequests.push({url: safeUrl(requestUrl), reason});
  };
  const drain = () => {
    while (!disposed && active < 4 && queue.length) {
      const job = queue.shift();
      active++;
      inFlight.set(job.key, job);
      void job.run();
    }
  };
  const release = key => {
    if (!inFlight.delete(key)) return;
    active--;
    drain();
  };
  const fail = async (session, event, reason) => {
    recordBlock(event.request.url, reason);
    await session.send('Fetch.failRequest', {requestId: event.requestId, errorReason: 'BlockedByClient'}).catch(() => {});
  };
  const attach = session => {
    const promise = configure(session);
    // The listener is synchronous: Fetch setup starts before the target is resumed.
    promise.catch(error => {
      fatal = `Target safety setup failed: ${error.message}`;
      errors.push({stage: 'network-safety', message: fatal});
    });
    return promise;
  };
  async function configure(session) {
    session.on('sessionattached', attach);
    const {targetInfo} = await session.send('Target.getTargetInfo');
    const configured = (async () => {
      if (targetInfo.type === 'tab') {
        await session.send('Target.setAutoAttach', {autoAttach: true, waitForDebuggerOnStart: true, flatten: true});
        await session.send('Runtime.runIfWaitingForDebugger');
        return;
      }
      if (!['page', 'iframe', 'worker', 'shared_worker', 'service_worker'].includes(targetInfo.type)) {
        await root.send('Target.closeTarget', {targetId: targetInfo.targetId});
        return;
      }
      session.on('Fetch.requestPaused', event => {
        if (event.responseStatusCode !== undefined || event.responseErrorReason !== undefined) {
          if (event.responseStatusCode) collector.observeStatus?.(event.responseStatusCode, event.request.url);
          // A redirect reuses Network's request id; release before its next request is queued.
          if (event.responseStatusCode >= 300 && event.responseStatusCode < 400 && event.networkId) {
            release(keyFor(session, event.networkId));
          }
          if (collector.halted) {
            void fail(session, event, collector.halted);
            if (event.networkId) release(keyFor(session, event.networkId));
          } else {
            void session.send('Fetch.continueRequest', {requestId: event.requestId}).catch(() => {});
          }
          return;
        }
        const key = keyFor(session, event.networkId || event.requestId);
        const job = {key, session, run: async () => {
          try {
            if (disposed || fatal || collector.halted) throw new Error(fatal || collector.halted || 'Collector closed');
            if (!['GET', 'HEAD'].includes(event.request.method)) throw new Error('Only GET/HEAD are permitted');
            if (Object.keys(event.request.headers).some(name => /^(?:authorization|proxy-authorization)$/i.test(name))) {
              throw new Error('Authenticated requests are not permitted');
            }
            const requestUrl = new URL(event.request.url);
            if (!['http:', 'https:'].includes(requestUrl.protocol)) throw new Error('Only public HTTP(S) requests are permitted');
            if (event.resourceType === 'Document' && requestUrl.origin !== origin) {
              await collector.guard(requestUrl.href);
            }
            const sameSite = requestUrl.hostname.replace(/^www\./i, '') === targetHost;
            if (sameSite) await collector.guard(requestUrl.href);
            else await collector.validatePublicUrl(requestUrl.href);
            if (disposed || fatal || collector.halted) throw new Error(fatal || collector.halted || 'Collector closed');
            await session.send('Fetch.continueRequest', {requestId: event.requestId});
          } catch (error) {
            await fail(session, event, error.message);
            release(key);
          }
        }};
        queue.push(job);
        drain();
      });
      session.on('Network.responseReceived', event => {
        collector.observeStatus?.(event.response.status, event.response.url);
        if (event.response.status >= 400) resources.push({url: safeUrl(event.response.url), status: event.response.status});
      });
      const requests = new Map();
      session.on('Network.requestWillBeSent', event => requests.set(event.requestId, event.request.url));
      session.on('Network.loadingFinished', event => {
        requests.delete(event.requestId);
        release(keyFor(session, event.requestId));
      });
      session.on('Network.loadingFailed', event => {
        resources.push({url: safeUrl(requests.get(event.requestId)), error: event.errorText, blocked: Boolean(event.blockedReason)});
        requests.delete(event.requestId);
        release(keyFor(session, event.requestId));
      });
      session.on('Disconnected', () => {
        for (const [key, job] of inFlight) if (job.session === session) release(key);
      });
      const setup = [
        session.send('Network.enable'),
        session.send('Network.setCacheDisabled', {cacheDisabled: true}),
        session.send('Network.setBlockedURLs', {urls: ['ws://*', 'wss://*']}),
        session.send('Fetch.enable', {patterns: [
          {urlPattern: '*', requestStage: 'Request'},
          {urlPattern: '*', requestStage: 'Response'},
        ]}),
        session.send('Target.setAutoAttach', {autoAttach: true, waitForDebuggerOnStart: true, flatten: true}),
      ];
      if (targetInfo.type === 'page' || targetInfo.type === 'iframe') {
        setup.push(session.send('Network.setBypassServiceWorker', {bypass: true}));
        await Promise.all(setup);
        await session.send('Runtime.runIfWaitingForDebugger');
      } else {
        // Worker commands may be acknowledged only once running. All Fetch and
        // Network setup commands are sent on the wire before the resume command.
        await Promise.all([...setup, session.send('Runtime.runIfWaitingForDebugger')]);
      }
    })();
    ready.set(targetInfo.targetId, configured);
    try { await configured; }
    catch (error) {
      // Close the target if interception setup failed rather than allowing it to continue.
      await root.send('Target.closeTarget', {targetId: targetInfo.targetId}).catch(() => {});
      error.message = `[target type ${targetInfo.type}, id ${String(targetInfo.targetId).slice(0, 8)}] ${error.message}`;
      throw error;
    }
  }
  root.on('sessionattached', attach);
  await root.send('Browser.setDownloadBehavior', {behavior: 'deny'});
  await root.send('Target.setAutoAttach', {autoAttach: true, waitForDebuggerOnStart: true, flatten: true,
    filter: [{type: 'browser', exclude: true}, {type: 'page', exclude: true}, {}]});
  return {
    resources,
    async waitForPage(page) {
      const probe = await page.createCDPSession();
      try {
        const {targetInfo} = await probe.send('Target.getTargetInfo');
        // Auto-attach is delivered before page creation completes; allow its setup promise to register.
        for (let n = 0; !ready.has(targetInfo.targetId) && n < 100; n++) await sleep(10);
        if (!ready.has(targetInfo.targetId)) throw new Error('Page was not attached to the safety interceptor');
        await ready.get(targetInfo.targetId);
        if (fatal) throw new Error(fatal);
      } finally { await probe.detach().catch(() => {}); }
    },
    async dispose() {
      disposed = true;
      queue.length = 0;
      await root.detach().catch(() => {});
    },
  };
}

export async function observePage(page) {
  return page.evaluate(() => {
    const elements = selector => [...document.querySelectorAll(selector)];
    const meta = name => document.querySelector(`meta[name="${name}"]`)?.content || null;
    const inputs = elements('input:not([type="hidden"]),select,textarea');
    const images = elements('img');
    const headings = Object.fromEntries([1, 2, 3, 4, 5, 6].map(level => [`h${level}`, elements(`h${level}`).length]));
    const labelled = input => Boolean(input.labels?.length || input.getAttribute('aria-label') || input.getAttribute('aria-labelledby') || input.getAttribute('title'));
    const isVisible = element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
    };
    const targets = elements('a[href],button,input:not([type="hidden"]),select,textarea,[role="button"]').filter(isVisible);
    const sizes = targets.map(element => element.getBoundingClientRect());
    const eligibleLinks = new Map();
    for (const anchor of elements('a[href]')) {
      try {
        const url = new URL(anchor.href, location.href);
        if (!['http:', 'https:'].includes(url.protocol) || url.origin !== location.origin
          || url.username || url.password || url.search || url.hash || anchor.hasAttribute('download')
          || /(?:^|[/_.-])(?:logout|login|signin|signout|admin|delete|remove|unsubscribe|wp-admin|wp-login)(?:$|[/_.-])/i.test(url.pathname)
          || /\.(?:pdf|zip|rar|docx?|xlsx?|pptx?|exe|dmg|png|jpe?g|gif|svg|mp4|mp3)$/i.test(url.pathname)) continue;
        if (!eligibleLinks.has(url.href)) eligibleLinks.set(url.href, {url: url.href, label: (anchor.textContent || anchor.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 100)});
        if (eligibleLinks.size === 150) break;
      } catch { /* Invalid and non-web links are not crawl candidates. */ }
    }
    return {
      lang: document.documentElement.lang || null,
      title: document.title || null,
      description: meta('description'),
      canonical: document.querySelector('link[rel~="canonical"]')?.href || null,
      viewport: meta('viewport'),
      headings,
      forms: {count: document.forms.length, controls: inputs.length, controlsWithLabels: inputs.filter(labelled).length},
      images: {count: images.length, withAlt: images.filter(image => image.hasAttribute('alt')).length,
        emptyAlt: images.filter(image => image.hasAttribute('alt') && image.alt.trim() === '').length,
        missingAlt: images.filter(image => !image.hasAttribute('alt')).length},
      search: {detected: Boolean(document.querySelector('input[type="search"],[role="search"],form[role="search"],input[name="s"],input[name="q"],input[name="search"]')),
        method: 'Semantic roles, search input types and conventional field names; no submission'},
      reflow: {viewportWidth: window.innerWidth, documentWidth: document.documentElement.scrollWidth,
        visualViewportWidth: window.visualViewport?.width ?? null,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        note: 'Width observation only; does not establish WCAG reflow conformance'},
      linksCount: document.links.length,
      links: [...eligibleLinks.values()],
      touchTargets: {checked: sizes.length, below24: sizes.filter(rect => rect.width < 24 || rect.height < 24).length,
        below44: sizes.filter(rect => rect.width < 44 || rect.height < 44).length},
      insecureFormActions: elements('form').filter(form => {
        try { return new URL(form.action || location.href, location.href).protocol !== 'https:'; } catch { return true; }
      }).length,
      semanticLandmarks: {main: elements('main,[role="main"]').length, nav: elements('nav,[role="navigation"]').length},
      detectedLanguages: [...new Set([document.documentElement.lang, ...elements('[hreflang]').map(element => element.getAttribute('hreflang'))].filter(Boolean))],
      consent: 'Untouched: no consent banners, forms, controls, links or dialogs were activated',
    };
  });
}

/** Real, passive browser evidence. No ministry or compliance score is computed. */
export async function collectBrowserPage(url, {
  collector, outputDir, runs = 3, delayMs = 1500,
  chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome', timeoutMs = 30000,
} = {}) {
  const result = {
    status: 'N/M', browserVersion: null, axeVersion: axe.version, lighthouseVersion,
    observations: {mobile: null, desktop: null},
    accessibility: {violations: [], incomplete: [], passesCount: 0, profiles: {}},
    performance: {mobile: {runs: [], metrics: {}}, desktop: {runs: [], metrics: {}}},
    artifacts: [], blockedRequests: [], errors: [],
    limitations: [
      'Private evidence: screenshots and reports can contain public-page information. Do not publish this directory.',
      'Cookie values, DOM snippets and form values are omitted from JSON evidence; consent is untouched.',
      'Chromium checks DNS safety before requests but uses its native resolver/proxy: unlike the HTTP collector, browser DNS is not pinned. DNS rebinding and system proxy routing remain limitations.',
      'A maximum of four concurrent network requests intentionally constrains the measured context; blocked requests can change page behavior and timing.',
      'Lab measurements are not CrUX/field data. TBT is a responsiveness proxy, not INP. No automatic quality or compliance score is assigned.',
    ],
    settings: {runsPerProfile: runs, delayBetweenDocumentsMs: delayMs, maxConcurrentRequests: 4,
      consent: 'untouched', wcagTags: WCAG_TAGS, sandbox: process.env.CHROME_NO_SANDBOX !== '1'},
  };
  let chrome;
  let browser;
  let safety;
  let lastDocumentAt = 0;
  const pace = async () => {
    if (collector.halted) throw new Error(collector.halted);
    await sleep(Math.max(0, delayMs - (Date.now() - lastDocumentAt)));
    lastDocumentAt = Date.now();
  };
  const saveJson = async (name, data) => {
    await writeFile(path.join(outputDir, name), `${JSON.stringify(redact(data), null, 2)}\n`, {mode: 0o600});
    result.artifacts.push(name);
  };
  try {
    if (!collector || !outputDir) throw new Error('collector and private outputDir are required');
    if (!Number.isInteger(runs) || runs < 1) throw new Error('runs must be a positive integer');
    await collector.guard(url);
    const crawlDelay = await collector.crawlDelay?.(url);
    if (crawlDelay > 0) throw new Error(`Browser measurement omitted: robots.txt declares crawl-delay ${crawlDelay} ms; parallel page resources cannot honor this pacing`);
    await mkdir(outputDir, {recursive: true, mode: 0o700});
    await chmod(outputDir, 0o700);
    await saveJson('privacy-warning.json', {warning: result.limitations[0], redaction: result.limitations[1]});
    const chromeFlags = ['--headless=new', '--disable-background-networking', '--disable-component-update',
      '--disable-sync', '--no-first-run', '--no-default-browser-check', '--disable-quic', '--disable-features=Prerender2,SpeculationRulesPrefetch,Preloading',
      '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'];
    if (process.env.CHROME_NO_SANDBOX === '1') chromeFlags.push('--no-sandbox', '--disable-setuid-sandbox');
    chrome = await launch({chromePath, chromeFlags, startingUrl: 'about:blank', handleSIGINT: false, logLevel: 'silent'});
    browser = await puppeteer.connect({browserURL: `http://127.0.0.1:${chrome.port}`, defaultViewport: null,
      protocolTimeout: Math.max(timeoutMs * 3, 90000)});
    result.browserVersion = await browser.version();
    safety = await installSafety(browser, collector, url, result.blockedRequests, result.errors);
    for (const profile of Object.keys(PROFILES)) {
      if (collector.halted) break;
      let context;
      const resourceStart = safety.resources.length;
      try {
        await pace();
        context = await browser.createBrowserContext();
        const page = await context.newPage();
        await safety.waitForPage(page);
        page.setDefaultTimeout(timeoutMs);
        await page.setViewport(PROFILES[profile]);
        await page.setCacheEnabled(false);
        const response = await page.goto(url, {waitUntil: 'networkidle2', timeout: timeoutMs});
        if (!response || response.status() >= 400) throw new Error(`Document returned ${response?.status() ?? 'no response'}`);
        const observation = await observePage(page);
        observation.finalUrl = safeUrl(page.url());
        observation.httpStatus = response.status();
        observation.profile = PROFILES[profile];
        observation.reflow.requestedViewportWidth = PROFILES[profile].width;
        observation.canonical = observation.canonical ? safeUrl(observation.canonical) : null;
        observation.resources = {brokenLoadedResources: safety.resources.slice(resourceStart)};
        result.observations[profile] = observation;
        const screenshot = `${profile}.png`;
        await page.screenshot({path: path.join(outputDir, screenshot), fullPage: false, type: 'png'});
        await chmod(path.join(outputDir, screenshot), 0o600);
        result.artifacts.push(screenshot);
        await page.addScriptTag({content: axe.source});
        const rawAxe = await page.evaluate(tags => window.axe.run(document, {
          runOnly: {type: 'tag', values: tags}, resultTypes: ['violations', 'incomplete', 'passes', 'inapplicable'],
        }), WCAG_TAGS);
        const accessibility = axeEvidence(rawAxe);
        result.accessibility.profiles[profile] = accessibility;
        result.accessibility.violations.push(...accessibility.violations.map(rule => ({...rule, profile})));
        result.accessibility.incomplete.push(...accessibility.incomplete.map(rule => ({...rule, profile})));
        result.accessibility.passesCount += accessibility.passesCount;
        await saveJson(`${profile}-axe.json`, accessibility);
      } catch (error) {
        result.errors.push({stage: 'observation', profile, message: error.message});
      } finally { await context?.close().catch(() => {}); }

      for (let index = 1; index <= runs && !collector.halted; index++) {
        let runContext;
        try {
          await pace();
          runContext = await browser.createBrowserContext();
          const page = await runContext.newPage();
          await safety.waitForPage(page);
          const flags = {port: chrome.port, hostname: '127.0.0.1', logLevel: 'error', output: 'json',
            onlyCategories: ['performance'], maxWaitForLoad: timeoutMs, maxWaitForFcp: timeoutMs,
            disableStorageReset: false, throttlingMethod: 'simulate'};
          const config = profile === 'desktop' ? desktopConfig : undefined;
          const report = await lighthouse(url, flags, config, page);
          if (!report?.lhr) throw new Error('Lighthouse returned no report');
          const lhr = report.lhr;
          const artifact = `${profile}-lighthouse-${index}.json`;
          await saveJson(artifact, lhr);
          const runtimeError = lhr.runtimeError?.message || lhr.runtimeError?.code;
          result.performance[profile].runs.push({index, status: runtimeError ? 'N/M' : 'Collected',
            metrics: runtimeError ? nullMetrics() : measurements(lhr),
            artifact, settings: lhr.configSettings, lighthouseVersion: lhr.lighthouseVersion,
            fetchTime: lhr.fetchTime, warnings: lhr.runWarnings || [], error: runtimeError || null});
          if (runtimeError) result.errors.push({stage: 'lighthouse', profile, run: index, message: runtimeError});
        } catch (error) {
          result.performance[profile].runs.push({index, status: 'N/M', metrics: nullMetrics(), error: error.message});
          result.errors.push({stage: 'lighthouse', profile, run: index, message: error.message});
        } finally { await runContext?.close().catch(() => {}); }
      }
    }
  } catch (error) {
    result.errors.push({stage: 'browser', message: error.message});
  } finally {
    // Keep interception active until Chrome has stopped; detaching it first
    // could release paused requests without the policy guard.
    if (browser) {
      try { await browser.close(); }
      catch (error) { result.errors.push({stage: 'cleanup', message: error.message}); }
    }
    try { await chrome?.kill(); }
    catch (error) { result.errors.push({stage: 'cleanup', message: error.message}); }
    await safety?.dispose().catch(() => {});
    if (browser) {
      try { await browser.disconnect(); }
      catch (error) { result.errors.push({stage: 'cleanup', message: error.message}); }
    }
  }
  for (const profile of Object.keys(PROFILES)) {
    result.performance[profile].metrics = aggregate(result.performance[profile].runs);
  }
  if (collector?.halted) result.errors.push({stage: 'policy', message: collector.halted});
  result.constrained = result.blockedRequests.length > 0 || result.errors.some(error => error.stage === 'network-safety');
  const complete = Object.keys(PROFILES).every(profile => result.observations[profile]
    && result.accessibility.profiles[profile]
    && result.performance[profile].runs.length === runs
    && result.performance[profile].runs.every(run => run.status === 'Collected'));
  result.status = complete ? 'Collected' : 'N/M';
  return result;
}
