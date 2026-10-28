import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { performance } from 'node:perf_hooks';
import robotsParser from 'robots-parser';
import { createHash } from 'node:crypto';

export const USER_AGENT = 'AlgerianMinistryQualityEvidence/1.0';
const ROBOT_TOKEN = USER_AGENT.split('/')[0].toLowerCase();
const MAX_REDIRECTS = 5;
const SAFE_HEADERS = new Set([
  'content-type', 'content-length', 'content-encoding', 'content-language',
  'strict-transport-security', 'content-security-policy',
  'content-security-policy-report-only', 'x-frame-options', 'x-content-type-options',
  'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy',
  'cross-origin-embedder-policy', 'cross-origin-resource-policy', 'cache-control',
  'expires', 'age', 'vary', 'server', 'x-powered-by', 'accept-ranges',
  'access-control-allow-origin', 'access-control-allow-methods',
  'access-control-allow-credentials', 'retry-after',
]);

export class PolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PolicyError';
    this.code = code;
  }
}

function ipv4Number(address) {
  return address.split('.').reduce((number, octet) => number * 256 + Number(octet), 0);
}

const IPV4_DENIED = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
  ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
].map(([address, prefix]) => [ipv4Number(address), 2 ** (32 - prefix)]);

function ipv6Number(address) {
  let text = address.toLowerCase();
  if (text.includes('.')) {
    const index = text.lastIndexOf(':');
    const tail = ipv4Number(text.slice(index + 1));
    text = `${text.slice(0, index)}:${Math.floor(tail / 65536).toString(16)}:${(tail % 65536).toString(16)}`;
  }
  const [left, right] = text.split('::');
  const first = left ? left.split(':') : [];
  const last = right ? right.split(':') : [];
  const words = right === undefined ? first : [...first, ...Array(8 - first.length - last.length).fill('0'), ...last];
  return words.reduce((number, word) => (number << 16n) | BigInt(`0x${word}`), 0n);
}

function mappedIpv4(address) {
  const value = ipv6Number(address);
  if (value >> 32n !== 0xffffn) return null;
  const low = Number(value & 0xffffffffn);
  return [24, 16, 8, 0].map((shift) => (low >>> shift) & 255).join('.');
}

export function isLoopbackAddress(address) {
  if (typeof address !== 'string' || address.includes('%')) return false;
  const family = isIP(address);
  if (family === 4) return address.split('.')[0] === '127';
  if (family !== 6) return false;
  const mapped = mappedIpv4(address);
  return mapped ? isLoopbackAddress(mapped) : ipv6Number(address) === 1n;
}

export function isPublicAddress(address) {
  if (typeof address !== 'string' || address.includes('%')) return false;
  const family = isIP(address);
  if (family === 4) {
    const number = ipv4Number(address);
    return !IPV4_DENIED.some(([start, size]) => number >= start && number < start + size);
  }
  if (family !== 6) return false;
  const mapped = mappedIpv4(address);
  if (mapped) return isPublicAddress(mapped);
  const number = ipv6Number(address);
  // Only global unicast; exclude special-purpose, tunnelling and documentation ranges.
  return number >> 125n === 1n
    && number >> 105n !== 0x100080n // 2001::/23 (IETF special-purpose allocations)
    && number >> 96n !== 0x20010db8n
    && number >> 112n !== 0x2002n
    && number >> 108n !== 0x3fff0n; // 3fff::/20 (documentation)
}

function parseUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new PolicyError('ERR_URL', 'Invalid absolute HTTP(S) URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new PolicyError('ERR_URL', 'Only credential-free HTTP(S) URLs are permitted.');
  }
  url.hash = '';
  return url;
}

export function safeUrl(input) {
  try {
    const url = parseUrl(input);
    url.search = '';
    return url.href;
  } catch {
    return '[redacted invalid URL]';
  }
}

export function redactHeaders(headers = {}) {
  const safe = {};
  for (const [name, value] of Object.entries(headers)) {
    const key = name.toLowerCase();
    if (SAFE_HEADERS.has(key) && value !== undefined) {
      safe[key] = Array.isArray(value) ? value.join(', ') : String(value);
    }
  }
  return safe;
}

export function cookieFlags(setCookie = []) {
  return (Array.isArray(setCookie) ? setCookie : [setCookie]).filter(Boolean).map((cookie) => {
    const attributes = String(cookie).split(';').slice(1).map((part) => part.trim());
    const fields = new Map(attributes.map((part) => {
      const index = part.indexOf('=');
      return index === -1 ? [part.toLowerCase(), ''] : [part.slice(0, index).toLowerCase(), part.slice(index + 1).toLowerCase()];
    }));
    const sameSite = fields.get('samesite');
    return {
      secure: fields.has('secure'),
      httpOnly: fields.has('httponly'),
      sameSite: ['lax', 'strict', 'none'].includes(sameSite) ? sameSite : null,
      partitioned: fields.has('partitioned'),
      domainScoped: fields.has('domain'),
      pathPresent: fields.has('path'),
      persistent: fields.has('expires') || fields.has('max-age'),
    };
  });
}

export function createPinnedLookup(addresses, { allowLocal = false } = {}) {
  if (typeof allowLocal !== 'boolean') throw new TypeError('allowLocal must be an explicit boolean.');
  if (!Array.isArray(addresses) || !addresses.length || addresses.some(({ address, family }) =>
    family !== isIP(address) || !(isPublicAddress(address) || (allowLocal && isLoopbackAddress(address))))) {
    throw new PolicyError('ERR_DNS_UNSAFE', 'DNS resolved to an unsafe or invalid address.');
  }
  const pinned = addresses.map(({ address, family }) => ({ address, family }));
  return (_hostname, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    const requestedFamily = typeof options === 'number' ? options : options?.family;
    const matching = requestedFamily ? pinned.filter(({ family }) => family === requestedFamily) : pinned;
    if (!matching.length) {
      callback(new PolicyError('ERR_DNS_FAMILY', 'No validated address for the requested address family.'));
    } else if (options?.all) {
      callback(null, matching.map((entry) => ({ ...entry })));
    } else {
      callback(null, matching[0].address, matching[0].family);
    }
  };
}

export function parseRobotsPolicy(url, body, contentType = '', mode = 'strict') {
  if (!['strict', 'rfc9309-recovery'].includes(mode)) throw new TypeError('Unknown robots parsing mode');
  if (mode === 'rfc9309-recovery') {
    const lines = body.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
    // Retain all recognizable directives. Strict validation below prevents a
    // malformed user-agent/rule from silently broadening the allowed scope.
    const kept = lines.filter(line => /^\s*(?:user-agent|allow|disallow|crawl-delay|sitemap|host)\s*:/i.test(line));
    const parsed = parseRobotsPolicy(url, kept.join('\n'), 'text/plain', 'strict');
    return {...parsed, parsing: {mode, contentType, ignoredLines: lines.filter(l => l.trim() && !/^\s*#/.test(l)).length - kept.length,
      retainedDirectiveLines: kept.length, bodySha256: createHash('sha256').update(body).digest('hex'),
      formatWarning: !/^text\/plain(?:\s*;|\s*$)/i.test(contentType)}};
  }
  if (contentType && !/^text\/plain(?:\s*;|\s*$)/i.test(contentType)) {
    throw new PolicyError('ERR_ROBOTS_MALFORMED', 'robots.txt did not have a plain-text content type.');
  }
  const text = body.replace(/^\uFEFF/, '');
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
    throw new PolicyError('ERR_ROBOTS_MALFORMED', 'robots.txt contained non-text control characters.');
  }
  let agents = [];
  let previousWasAgent = false;
  let recognized = false;
  let nonempty = false;
  let crawlDelayMs = 0;
  for (const source of text.split(/\r\n|\r|\n/)) {
    const line = source.split('#', 1)[0].trim();
    if (!line) continue;
    nonempty = true;
    const colon = line.indexOf(':');
    if (colon < 1) throw new PolicyError('ERR_ROBOTS_MALFORMED', 'robots.txt contained a malformed directive.');
    const key = line.slice(0, colon).trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]*$/.test(key)) throw new PolicyError('ERR_ROBOTS_MALFORMED', 'robots.txt contained an invalid directive name.');
    const value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      if (!value || /\s/.test(value)) throw new PolicyError('ERR_ROBOTS_MALFORMED', 'robots.txt contained an invalid user-agent.');
      if (!previousWasAgent) agents = [];
      agents.push(value.toLowerCase().split('/')[0]);
      recognized = true;
    } else if (['allow', 'disallow', 'crawl-delay'].includes(key)) {
      if (!agents.length) throw new PolicyError('ERR_ROBOTS_MALFORMED', 'robots.txt contained an unscoped rule.');
      if (key === 'crawl-delay') {
        if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isSafeInteger(Math.ceil(Number(value) * 1000))) {
          throw new PolicyError('ERR_ROBOTS_MALFORMED', 'robots.txt contained an invalid crawl-delay.');
        }
        if (agents.includes('*') || agents.includes(ROBOT_TOKEN)) crawlDelayMs = Math.max(crawlDelayMs, Math.ceil(Number(value) * 1000));
      } else if (value && !value.startsWith('/')) {
        throw new PolicyError('ERR_ROBOTS_MALFORMED', 'robots.txt contained an invalid rule path.');
      }
      recognized = true;
    } else if (key === 'sitemap' || key === 'host') {
      if (!value) throw new PolicyError('ERR_ROBOTS_MALFORMED', 'robots.txt contained an empty global directive.');
      recognized = true;
    }
    previousWasAgent = key === 'user-agent';
  }
  if (nonempty && !recognized) throw new PolicyError('ERR_ROBOTS_MALFORMED', 'robots.txt contained no recognized directives.');
  const parser = robotsParser(url, text);
  return { parser, crawlDelayMs };
}

function timed(promise, timeoutMs, code, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new PolicyError(code, message)), timeoutMs); }),
  ]).finally(() => clearTimeout(timer));
}

function tlsEvidence(socket) {
  if (!socket?.encrypted) return null;
  const certificate = socket.getPeerCertificate();
  const cipher = socket.getCipher();
  const expiry = Date.parse(certificate.valid_to);
  const start = Date.parse(certificate.valid_from);
  return {
    protocol: socket.getProtocol(),
    cipher: cipher?.standardName || cipher?.name || null,
    authorized: socket.authorized === true,
    certificateExpiresAt: Number.isFinite(expiry) ? new Date(expiry).toISOString() : null,
    certificateNotBefore: Number.isFinite(start) ? new Date(start).toISOString() : null,
  };
}

export function createCollector({ origins, allowLocal = false, delayMs = 1500, timeoutMs = 20000, maxBytes = 2000000, robotsMode = 'strict' } = {}) {
  if (!['strict', 'rfc9309-recovery'].includes(robotsMode)) throw new TypeError('Unknown robots parsing mode');
  if (typeof allowLocal !== 'boolean') throw new TypeError('allowLocal must be an explicit boolean.');
  if (!Array.isArray(origins) || !origins.length) throw new TypeError('At least one approved origin is required.');
  if (!Number.isFinite(delayMs) || delayMs < 0 || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError('Collector limits must be finite positive values (delayMs may be zero).');
  }
  const approved = new Set(origins.map((origin) => {
    const url = parseUrl(origin);
    if (url.pathname !== '/' || url.search) throw new TypeError('Approved origins cannot contain paths or queries.');
    return url.origin;
  }));
  const dnsCache = new Map();
  const robotsCache = new Map();
  const nextRequestAt = new Map();
  const declaredDelay = new Map();
  const robotsEvidence = [];
  let halted = null;
  let transportQueue = Promise.resolve();

  function assertRunning() {
    if (halted) throw new PolicyError('ERR_COLLECTOR_HALTED', halted);
  }

  function observeStatus(status, url) {
    if (!halted && (status === 429 || status === 503)) {
      halted = `HTTP ${status} received from ${safeUrl(url)}; collection halted.`;
    }
    return halted;
  }

  function assertApproved(url) {
    if (!approved.has(url.origin)) throw new PolicyError('ERR_ORIGIN', `Origin is not approved: ${url.origin}`);
  }

  async function resolveAddresses(url) {
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (!dnsCache.has(hostname)) {
      const promise = (async () => {
        const family = isIP(hostname);
        let addresses;
        try {
          addresses = family ? [{ address: hostname, family }] : await timed(
            dnsLookup(hostname, { all: true, verbatim: true }), timeoutMs,
            'ERR_DNS_TIMEOUT', 'DNS validation timed out.',
          );
        } catch (error) {
          if (error instanceof PolicyError) throw error;
          throw new PolicyError('ERR_DNS', 'DNS validation failed.');
        }
        createPinnedLookup(addresses, { allowLocal });
        return addresses;
      })();
      dnsCache.set(hostname, promise);
      promise.catch(() => dnsCache.delete(hostname));
    }
    return dnsCache.get(hostname);
  }

  async function validatePublicUrl(input) {
    assertRunning();
    const url = parseUrl(input);
    await resolveAddresses(url);
    assertRunning();
  }

  async function pace(origin) {
    const waitMs = Math.max(0, (nextRequestAt.get(origin) || 0) - performance.now());
    if (waitMs > timeoutMs) throw new PolicyError('ERR_CRAWL_DELAY', 'Required request pacing exceeds the collector timeout; no request was sent.');
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, Math.ceil(waitMs)));
    assertRunning();
    nextRequestAt.set(origin, performance.now() + Math.max(delayMs, declaredDelay.get(origin) || 0));
  }

  async function transport(url, method, includeBody) {
    assertRunning();
    assertApproved(url);
    const addresses = await resolveAddresses(url);
    await pace(url.origin);
    assertRunning();
    return new Promise((resolve, reject) => {
      const started = performance.now();
      let settled = false;
      let timer;
      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error instanceof PolicyError ? error : new PolicyError('ERR_NETWORK', 'HTTP request or verified TLS connection failed.'));
        else resolve(result);
      };
      const request = (url.protocol === 'https:' ? https : http).request(url, {
        method,
        agent: false,
        family: addresses[0].family,
        lookup: createPinnedLookup(addresses, { allowLocal }),
        rejectUnauthorized: true,
        headers: { 'user-agent': USER_AGENT, accept: '*/*', 'accept-encoding': 'identity' },
      }, (response) => {
        const status = response.statusCode;
        observeStatus(status, url.href);
        const headers = redactHeaders(response.headers);
        const cookies = cookieFlags(response.headers['set-cookie']);
        const tls = tlsEvidence(response.socket);
        if (status === 429 || status === 503) {
          finish(null, { status, headers, cookies, tls, bodyBytes: 0, ...(includeBody ? { body: '' } : {}),
            elapsedMs: performance.now() - started, location: response.headers.location });
          response.destroy();
          return;
        }
        let bodyBytes = 0;
        const chunks = includeBody ? [] : null;
        response.on('data', (chunk) => {
          bodyBytes += chunk.length;
          if (bodyBytes > maxBytes) {
            const error = new PolicyError('ERR_BODY_LIMIT', 'Response exceeded the configured byte limit.');
            finish(error);
            request.destroy(error);
            response.destroy(error);
          } else if (chunks) chunks.push(chunk);
        });
        response.on('error', (error) => finish(error));
        response.on('aborted', () => finish(new PolicyError('ERR_RESPONSE_ABORTED', 'HTTP response was interrupted.')));
        response.on('end', () => {
          let body;
          if (chunks) {
            try {
              body = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, bodyBytes));
            } catch {
              finish(new PolicyError('ERR_BODY_ENCODING', 'Response was not valid UTF-8 text.'));
              return;
            }
          }
          finish(null, { status, headers, cookies, tls, bodyBytes, ...(includeBody ? { body } : {}), elapsedMs: performance.now() - started,
            location: response.headers.location });
        });
      });
      request.on('error', (error) => finish(error));
      timer = setTimeout(() => {
        const error = new PolicyError('ERR_TIMEOUT', 'HTTP request exceeded the configured timeout.');
        finish(error);
        request.destroy(error);
      }, timeoutMs);
      request.end();
    });
  }

  function dispatch(url, method, includeBody) {
    const operation = transportQueue.then(() => transport(url, method, includeBody));
    transportQueue = operation.catch(() => {});
    return operation;
  }

  async function performRequest(input, { method = 'GET', body = false, robots = true } = {}) {
    if (method !== 'GET' && method !== 'HEAD') throw new PolicyError('ERR_METHOD', 'Only GET and HEAD requests are permitted.');
    const original = parseUrl(input);
    let url = original;
    const redirects = [];
    let totalElapsedMs = 0;
    for (;;) {
      await guard(url.href, { robots });
      const result = await dispatch(url, method, body);
      totalElapsedMs += result.elapsedMs;
      if (![301, 302, 303, 307, 308].includes(result.status) || !result.location || halted) {
        const { location: _location, ...evidence } = result;
        return { url: safeUrl(original), finalUrl: safeUrl(url), ...evidence, totalElapsedMs, redirects };
      }
      if (redirects.length >= MAX_REDIRECTS) throw new PolicyError('ERR_REDIRECT_LIMIT', 'Redirect limit exceeded; collection did not follow another redirect.');
      let next;
      try { next = parseUrl(new URL(result.location, url)); } catch {
        throw new PolicyError('ERR_REDIRECT_URL', 'Redirect did not provide a safe HTTP(S) URL.');
      }
      // This check precedes robots fetching, DNS resolution and any redirect contact.
      assertApproved(next);
      redirects.push({ url: safeUrl(url), status: result.status, location: safeUrl(next), tls: result.tls });
      url = next;
    }
  }

  async function loadRobots(origin) {
    const robotsUrl = new URL('/robots.txt', origin).href;
    const evidence = { origin, status: null, policy: 'denied', delay: 0, delayMs: 0 };
    robotsEvidence.push(evidence);
    try {
      const result = await performRequest(robotsUrl, { body: true, robots: false });
      evidence.status = result.status;
      if (result.status === 404) {
        evidence.policy = 'missing-allow';
        return { allowed: true, parser: null, crawlDelayMs: 0 };
      }
      if (result.status === 401 || result.status === 403) {
        evidence.error = 'robots.txt access was denied; target requests are denied.';
        return { allowed: false, parser: null, crawlDelayMs: 0 };
      }
      if (result.status < 200 || result.status >= 300 || halted) {
        evidence.error = halted || 'robots.txt could not be retrieved successfully; target requests are denied.';
        return { allowed: false, parser: null, crawlDelayMs: 0 };
      }
      const policy = parseRobotsPolicy(robotsUrl, result.body, result.headers['content-type'], robotsMode);
      if (policy.parsing) evidence.parsing = policy.parsing;
      evidence.policy = 'parsed';
      evidence.delay = policy.crawlDelayMs / 1000;
      evidence.delayMs = policy.crawlDelayMs;
      declaredDelay.set(origin, policy.crawlDelayMs);
      // The robots retrieval itself is a request and also precedes the first target request.
      nextRequestAt.set(origin, Math.max(nextRequestAt.get(origin) || 0, performance.now() + Math.max(delayMs, policy.crawlDelayMs)));
      return { allowed: true, ...policy };
    } catch (error) {
      evidence.policy = error.code === 'ERR_ROBOTS_MALFORMED' || error.code === 'ERR_BODY_ENCODING' ? 'malformed' : 'unreachable';
      evidence.error = error instanceof PolicyError ? error.message : 'robots.txt validation failed; target requests are denied.';
      return { allowed: false, parser: null, crawlDelayMs: 0 };
    }
  }

  function robotsPolicy(origin) {
    if (!robotsCache.has(origin)) robotsCache.set(origin, loadRobots(origin));
    return robotsCache.get(origin);
  }

  async function guard(input, { robots = true } = {}) {
    assertRunning();
    const url = parseUrl(input);
    assertApproved(url);
    await resolveAddresses(url);
    if (robots) {
      const policy = await robotsPolicy(url.origin);
      assertRunning();
      if (!policy.allowed || (policy.parser && policy.parser.isAllowed(url.href, USER_AGENT) !== true)) {
        throw new PolicyError('ERR_ROBOTS_DENIED', `Robots policy denies this URL: ${safeUrl(url)}`);
      }
    }
    assertRunning();
  }

  async function crawlDelay(input) {
    const url = parseUrl(input);
    await guard(url.href);
    return (await robotsPolicy(url.origin)).crawlDelayMs;
  }

  return {
    request: performRequest,
    guard,
    validatePublicUrl,
    crawlDelay,
    observeStatus,
    robotsEvidence,
    get halted() { return halted; },
  };
}
