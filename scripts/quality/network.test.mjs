import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import {
  createCollector,
  createPinnedLookup,
  cookieFlags,
  isLoopbackAddress,
  isPublicAddress,
  parseRobotsPolicy,
  redactHeaders,
  safeUrl,
  USER_AGENT,
} from './network.mjs';

async function fixture(t, handler) {
  const contacts = [];
  const server = http.createServer((request, response) => {
    contacts.push({ method: request.method, url: request.url, headers: request.headers });
    handler(request, response);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    const closed = new Promise((resolve) => server.close(resolve));
    server.closeAllConnections();
    await closed;
  });
  return { origin: `http://127.0.0.1:${server.address().port}`, contacts, server };
}

function collector(origin, options = {}) {
  return createCollector({ origins: [origin], allowLocal: true, delayMs: 0, timeoutMs: 1000, ...options });
}

function plain(response, status, body = '') {
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  response.end(body);
}

const hasCode = (code) => (error) => error.code === code;

test('public address policy rejects private, reserved and IPv6 tunnelling ranges', () => {
  for (const address of [
    '0.1.2.3', '10.0.0.1', '100.64.0.1', '100.127.255.255', '127.0.0.1',
    '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.0.0.1', '192.0.2.1',
    '192.88.99.1', '192.168.1.1', '198.18.0.1', '198.19.255.255', '198.51.100.1',
    '203.0.113.1', '224.0.0.1', '240.0.0.1', '255.255.255.255',
    '::', '::1', '::8.8.8.8', 'fc00::1', 'fd12::1', 'fe80::1', 'fec0::1',
    'ff02::1', '64:ff9b::a00:1', '2001::1', '2001:2::1', '2001:10::1',
    '2001:1ff::1', '2001:db8::1', '2002:a00:1::1', '3fff::1', '3fff:fff::1',
    '::ffff:10.0.0.1', '::ffff:127.0.0.1', '::ffff:c0a8:101', 'fe80::1%eth0',
    'not-an-address',
  ]) assert.equal(isPublicAddress(address), false, address);
  for (const address of ['8.8.8.8', '1.1.1.1', '100.128.0.1', '172.32.0.1', '192.169.0.1',
    '2001:200::1', '2001:4860:4860::8888', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
    assert.equal(isPublicAddress(address), true, address);
  }
});

test('local override permits loopback only, including mapped loopback', async () => {
  for (const address of ['127.0.0.1', '127.255.255.255', '::1', '::ffff:127.0.0.1']) {
    assert.equal(isLoopbackAddress(address), true, address);
    const lookup = createPinnedLookup([{ address, family: address.includes(':') ? 6 : 4 }], { allowLocal: true });
    lookup('fixture.invalid', {}, (error, resolved) => {
      assert.equal(error, null);
      assert.equal(resolved, address);
    });
  }
  for (const address of ['10.0.0.1', '169.254.169.254', 'fc00::1', '::ffff:192.168.1.1']) {
    assert.equal(isLoopbackAddress(address), false, address);
    assert.throws(() => createPinnedLookup([{ address, family: address.includes(':') ? 6 : 4 }], { allowLocal: true }), hasCode('ERR_DNS_UNSAFE'));
  }
  await assert.rejects(createCollector({ origins: ['http://127.0.0.1'], delayMs: 0 }).guard('http://127.0.0.1'), hasCode('ERR_DNS_UNSAFE'));
});

test('pinned lookup uses only the validated snapshot and rejects mixed unsafe answers', () => {
  const addresses = [{ address: '8.8.8.8', family: 4 }, { address: '2606:4700:4700::1111', family: 6 }];
  const lookup = createPinnedLookup(addresses);
  addresses[0].address = '127.0.0.1';
  lookup('an-untrusted-rebinding-name.invalid', { family: 4 }, (error, address, family) => {
    assert.equal(error, null);
    assert.equal(address, '8.8.8.8');
    assert.equal(family, 4);
  });
  lookup('another-name.invalid', { all: true }, (error, values) => {
    assert.equal(error, null);
    assert.deepEqual(values, [{ address: '8.8.8.8', family: 4 }, { address: '2606:4700:4700::1111', family: 6 }]);
  });
  assert.throws(() => createPinnedLookup([{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }]), hasCode('ERR_DNS_UNSAFE'));
  assert.throws(() => createPinnedLookup([{ address: '8.8.8.8', family: 6 }]), hasCode('ERR_DNS_UNSAFE'));
});

test('redaction preserves quality headers but no cookie values or authorization', () => {
  const headers = redactHeaders({
    'Content-Type': 'text/html',
    'Strict-Transport-Security': 'max-age=31536000',
    'Content-Security-Policy': "default-src 'self'",
    'X-Frame-Options': 'DENY',
    'Set-Cookie': ['session=secret; HttpOnly; Secure; SameSite=Strict'],
    Authorization: 'Bearer secret',
    'Proxy-Authorization': 'Basic secret',
    Cookie: 'session=secret',
    'X-Secret-Header': 'secret',
  });
  assert.deepEqual(Object.keys(headers).sort(), ['content-security-policy', 'content-type', 'strict-transport-security', 'x-frame-options']);
  const cookies = cookieFlags(['session=secret; HttpOnly; Secure; SameSite=Strict; Path=/private; Domain=internal.example; Max-Age=60', 'other=another-secret']);
  assert.equal(cookies[0].secure, true);
  assert.equal(cookies[0].httpOnly, true);
  assert.equal(cookies[0].sameSite, 'strict');
  assert.equal(cookies[0].persistent, true);
  assert.equal(cookies[1].secure, false);
  const serialized = JSON.stringify({ headers, cookies });
  for (const value of ['secret', 'session', '/private', 'internal.example']) assert.equal(serialized.includes(value), false, value);
  assert.equal(safeUrl('https://example.org/path?token=secret#secret'), 'https://example.org/path');
  assert.equal(safeUrl('https://name:secret@example.org/'), '[redacted invalid URL]');
});

test('robots parsing uses the declared user agent and conservatively takes repeated delays', () => {
  const policy = parseRobotsPolicy('https://example.org/robots.txt', `User-agent: *\nDisallow: /blocked\nCrawl-delay: 0.01\nCrawl-delay: 0.005\nUser-agent: ${USER_AGENT.split('/')[0]}\nDisallow: /private\nCrawl-delay: .02`);
  assert.equal(policy.crawlDelayMs, 20);
  assert.equal(policy.parser.isAllowed('https://example.org/private', USER_AGENT), false);
  for (const [body, type] of [['<html>not robots</html>', 'text/html'], ['Disallow: /', 'text/plain'], ['User-agent: *\nCrawl-delay: -1', 'text/plain'], ['garbage', ''], ['\0', '']]) {
    assert.throws(() => parseRobotsPolicy('https://example.org/robots.txt', body, type), hasCode('ERR_ROBOTS_MALFORMED'));
  }
});

test('robots 404 allows requests, is cached, and response evidence omits page HTML', async (t) => {
  const site = await fixture(t, (request, response) => {
    if (request.url === '/robots.txt') return plain(response, 404);
    response.writeHead(200, { 'content-type': 'text/html', 'set-cookie': 'session=private-value; Secure; HttpOnly', authorization: 'private-value' });
    response.end('<html>private page body</html>');
  });
  const client = collector(site.origin);
  const result = await client.request(`${site.origin}/?token=private-value`);
  await client.request(`${site.origin}/second`, { method: 'HEAD' });
  assert.equal(result.status, 200);
  assert.equal(result.finalUrl, `${site.origin}/`);
  assert.equal(result.bodyBytes, Buffer.byteLength('<html>private page body</html>'));
  assert.equal(result.tls, null);
  assert.equal('body' in result, false);
  assert.equal(JSON.stringify(result).includes('private-value'), false);
  assert.equal(site.contacts.filter(({ url }) => url === '/robots.txt').length, 1);
  assert.equal(client.robotsEvidence[0].policy, 'missing-allow');
  assert.equal(site.contacts[1].headers.cookie, undefined);
  assert.equal(site.contacts[1].headers.authorization, undefined);
});

test('robots disallow prevents contact and exposes the crawl-delay helper', async (t) => {
  const site = await fixture(t, (request, response) => {
    if (request.url === '/robots.txt') return plain(response, 200, 'User-agent: *\nDisallow: /blocked\nAllow: /allowed\nCrawl-delay: .01');
    plain(response, 200, 'ok');
  });
  const client = collector(site.origin);
  await assert.rejects(client.request(`${site.origin}/blocked`), hasCode('ERR_ROBOTS_DENIED'));
  assert.equal(site.contacts.length, 1);
  assert.equal(await client.crawlDelay(`${site.origin}/allowed`), 10);
  await client.request(`${site.origin}/allowed`);
  assert.equal(client.robotsEvidence[0].delayMs, 10);
});

for (const status of [401, 403]) {
  test(`robots ${status} fails closed and is not repeatedly fetched`, async (t) => {
    const site = await fixture(t, (_request, response) => plain(response, status));
    const client = collector(site.origin);
    await assert.rejects(client.request(`${site.origin}/`), hasCode('ERR_ROBOTS_DENIED'));
    await assert.rejects(client.request(`${site.origin}/another`), hasCode('ERR_ROBOTS_DENIED'));
    assert.deepEqual(site.contacts.map(({ url }) => url), ['/robots.txt']);
    assert.equal(client.robotsEvidence[0].status, status);
    assert.equal(client.robotsEvidence[0].policy, 'denied');
  });
}

test('malformed robots content fails closed with evidence', async (t) => {
  const site = await fixture(t, (_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<html>login</html>');
  });
  const client = collector(site.origin);
  await assert.rejects(client.request(`${site.origin}/`), hasCode('ERR_ROBOTS_DENIED'));
  assert.equal(site.contacts.length, 1);
  assert.equal(client.robotsEvidence[0].status, 200);
  assert.equal(client.robotsEvidence[0].policy, 'malformed');
});

test('unreachable robots fails closed and caches the failure', async (t) => {
  const site = await fixture(t, (_request, response) => response.destroy());
  const client = collector(site.origin);
  await assert.rejects(client.request(`${site.origin}/`), hasCode('ERR_ROBOTS_DENIED'));
  await assert.rejects(client.request(`${site.origin}/another`), hasCode('ERR_ROBOTS_DENIED'));
  assert.equal(site.contacts.length, 1);
  assert.equal(client.robotsEvidence[0].policy, 'unreachable');
});

test('redirect outside approved origins is rejected before any destination contact', async (t) => {
  const destination = await fixture(t, (_request, response) => plain(response, 200, 'must not be contacted'));
  const site = await fixture(t, (request, response) => {
    if (request.url === '/robots.txt') return plain(response, 404);
    response.writeHead(302, { location: `${destination.origin}/?secret=private-value` });
    response.end();
  });
  await assert.rejects(collector(site.origin).request(`${site.origin}/`), hasCode('ERR_ORIGIN'));
  assert.equal(destination.contacts.length, 0);
});

test('approved redirects collect a bounded redacted chain and respect destination robots', async (t) => {
  const destination = await fixture(t, (request, response) => {
    if (request.url === '/robots.txt') return plain(response, 404);
    plain(response, 200, 'final');
  });
  const site = await fixture(t, (request, response) => {
    if (request.url === '/robots.txt') return plain(response, 404);
    response.writeHead(301, { location: `${destination.origin}/landing?token=secret` });
    response.end();
  });
  const client = collector(site.origin, { origins: [site.origin, destination.origin] });
  const result = await client.request(`${site.origin}/start`);
  assert.equal(result.finalUrl, `${destination.origin}/landing`);
  assert.deepEqual(result.redirects.map(({ status, location }) => ({ status, location })), [{ status: 301, location: `${destination.origin}/landing` }]);
  assert.deepEqual(destination.contacts.map(({ url }) => url), ['/robots.txt', '/landing?token=secret']);
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.equal(client.robotsEvidence.length, 2);
});

test('redirect loops are bounded, including robots redirects', async (t) => {
  const site = await fixture(t, (request, response) => {
    if (request.url === '/robots.txt') return plain(response, 404);
    response.writeHead(302, { location: '/loop' });
    response.end();
  });
  await assert.rejects(collector(site.origin).request(`${site.origin}/loop`), hasCode('ERR_REDIRECT_LIMIT'));
  assert.equal(site.contacts.filter(({ url }) => url === '/loop').length, 6);
  const robotsLoop = await fixture(t, (_request, response) => {
    response.writeHead(302, { location: '/robots.txt' });
    response.end();
  });
  const client = collector(robotsLoop.origin);
  await assert.rejects(client.request(`${robotsLoop.origin}/`), hasCode('ERR_ROBOTS_DENIED'));
  assert.equal(robotsLoop.contacts.length, 6);
  assert.equal(client.robotsEvidence[0].policy, 'unreachable');
});

for (const status of [429, 503]) {
  test(`HTTP ${status} halts queued and later requests without further contact`, async (t) => {
    const site = await fixture(t, (request, response) => {
      if (request.url === '/robots.txt') return plain(response, 404);
      plain(response, status, 'stop');
    });
    const client = collector(site.origin);
    const results = await Promise.allSettled([client.request(`${site.origin}/first`), client.request(`${site.origin}/second`)]);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[0].value.status, status);
    assert.equal(results[1].status, 'rejected');
    assert.equal(results[1].reason.code, 'ERR_COLLECTOR_HALTED');
    await assert.rejects(client.request(`${site.origin}/third`), hasCode('ERR_COLLECTOR_HALTED'));
    assert.deepEqual(site.contacts.map(({ url }) => url), ['/robots.txt', '/first']);
    assert.match(client.halted, new RegExp(`HTTP ${status}`));
  });

  test(`robots HTTP ${status} halts all target requests`, async (t) => {
    const site = await fixture(t, (_request, response) => plain(response, status));
    const client = collector(site.origin);
    await assert.rejects(client.request(`${site.origin}/`), hasCode('ERR_COLLECTOR_HALTED'));
    await assert.rejects(client.request(`${site.origin}/another`), hasCode('ERR_COLLECTOR_HALTED'));
    assert.equal(site.contacts.length, 1);
    assert.equal(client.robotsEvidence[0].status, status);
  });
}

test('browser observed rate limits use the same stop policy and redact the URL', async () => {
  const client = collector('http://127.0.0.1');
  client.observeStatus(429, 'https://example.org/resource?token=secret');
  assert.match(client.halted, /HTTP 429/);
  assert.equal(client.halted.includes('secret'), false);
  await assert.rejects(client.validatePublicUrl('https://example.org/'), hasCode('ERR_COLLECTOR_HALTED'));
});

test('write methods and credentialed URLs are rejected before contact', async (t) => {
  const site = await fixture(t, (_request, response) => plain(response, 200, 'User-agent: *'));
  const client = collector(site.origin);
  await assert.rejects(client.request(`${site.origin}/`, { method: 'POST' }), hasCode('ERR_METHOD'));
  await assert.rejects(client.request(site.origin.replace('http://', 'http://name:secret@')), hasCode('ERR_URL'));
  assert.equal(site.contacts.length, 0);
});

test('response byte limits and timeouts bound passive requests', async (t) => {
  const site = await fixture(t, (request, response) => {
    if (request.url === '/robots.txt') return plain(response, 404);
    if (request.url === '/large') return plain(response, 200, 'x'.repeat(128));
    // Intentionally leave the response open; the request timeout must destroy it.
  });
  const client = collector(site.origin, { maxBytes: 32, timeoutMs: 100 });
  await assert.rejects(client.request(`${site.origin}/large`, { body: true }), hasCode('ERR_BODY_LIMIT'));
  await assert.rejects(client.request(`${site.origin}/never-finishes`), hasCode('ERR_TIMEOUT'));
});

test('recovery parsing ignores HTML fallthrough but retains crawl restrictions and pacing', () => {
 const p=parseRobotsPolicy('https://example.com/robots.txt','<html>not robots</html>\nUser-agent: *\nDisallow: /private/\nCrawl-delay: 2\n</body>','text/html','rfc9309-recovery');
 assert.equal(p.parser.isAllowed('https://example.com/private/file',USER_AGENT),false);
 assert.equal(p.parser.isAllowed('https://example.com/public',USER_AGENT),true);
 assert.equal(p.crawlDelayMs,2000);assert.equal(p.parsing.ignoredLines,2);assert.equal(p.parsing.formatWarning,true);
 const empty=parseRobotsPolicy('https://example.com/robots.txt','<html>SPA shell</html>','text/html','rfc9309-recovery');
 assert.notEqual(empty.parser.isAllowed('https://example.com/',USER_AGENT),false);
 assert.throws(()=>parseRobotsPolicy('https://example.com/robots.txt','User-agent: *\nDisallow: private','text/html','rfc9309-recovery'),hasCode('ERR_ROBOTS_MALFORMED'));
});

test('recovery collector still refuses explicit disallow before target contact',async t=>{
 const f=await fixture(t,(q,r)=>q.url==='/robots.txt'?(r.writeHead(200,{'content-type':'text/html'}),r.end('<html>\nUser-agent: *\nDisallow: /secret\n</html>')):plain(r,200,'ok'));
 const c=collector(f.origin,{robotsMode:'rfc9309-recovery'});
 await assert.rejects(c.request(f.origin+'/secret'),hasCode('ERR_ROBOTS_DENIED'));
 assert.equal(f.contacts.length,1);
});
