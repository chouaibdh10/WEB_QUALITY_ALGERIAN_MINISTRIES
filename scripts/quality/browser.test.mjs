import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp, readdir, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const cli = fileURLToPath(new URL('../measure.mjs', import.meta.url));

async function serve(t, handler) {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    const closed = new Promise(resolve => server.close(resolve));
    server.closeAllConnections();
    await closed;
  });
  return `http://127.0.0.1:${server.address().port}`;
}

function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {stdio: ['ignore', 'pipe', 'pipe']});
    let output = '';
    child.stdout.on('data', chunk => output += chunk);
    child.stderr.on('data', chunk => output += chunk);
    const timer = setTimeout(() => child.kill('SIGTERM'), 90000);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); resolve({code, output}); });
  });
}

test('CLI measures the declared query through an approved redirect, blocks robots paths and never submits forms', {
  skip: !existsSync(chromePath) ? 'Requires installed Chrome (CHROME_PATH)' : false,
  timeout: 120000,
}, async t => {
  const contacts = [];
  const target = await serve(t, (request, response) => {
    contacts.push({url: request.url, method: request.method});
    const url = new URL(request.url, 'http://fixture.invalid');
    if (url.pathname === '/robots.txt') {
      response.writeHead(200, {'content-type': 'text/plain'});
      return response.end('User-agent: *\nDisallow: /forbidden\n');
    }
    if (url.pathname === '/pixel.svg') {
      response.writeHead(200, {'content-type': 'image/svg+xml'});
      return response.end('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="green"/></svg>');
    }
    if (url.pathname !== '/index.php') { response.writeHead(404); return response.end(); }
    const title = url.searchParams.get('page') === 'service' ? 'Declared service' : 'Wrong homepage';
    response.writeHead(200, {'content-type': 'text/html', 'set-cookie': 'private-session=DO-NOT-STORE; HttpOnly; SameSite=Lax'});
    response.end(`<!doctype html><html lang="en"><head><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><h1>${title}</h1><img src="/pixel.svg"><form action="/forbidden" method="post"><button>Submit</button></form><iframe title="Excluded page" src="/forbidden"></iframe></main></body></html>`);
  });
  const source = await serve(t, (request, response) => {
    if (request.url === '/robots.txt') {
      response.writeHead(200, {'content-type': 'text/plain'});
      return response.end('User-agent: *\nAllow: /\n');
    }
    response.writeHead(302, {location: `${target}/index.php?page=service`});
    response.end();
  });
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ministry-cli-test-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const result = await runCli(['--url', `${source}/go`, '--allow-origin', target, '--allow-local',
    '--runs', '1', '--delay-ms', '0', '--chrome-path', chromePath, '--out', directory, '--location', 'fixture-network']);
  assert.equal(result.code, 0, result.output);
  const run = (await readdir(directory)).find(entry => entry !== 'monitoring');
  const text = await readFile(path.join(directory, run, 'custom-site', 'report.json'), 'utf8');
  const report = JSON.parse(text);
  const evidence = report.pages[0].browser;
  for (const profile of ['mobile', 'desktop']) {
    assert.equal(evidence.observations[profile].title, 'Declared service');
    assert.ok(evidence.accessibility.profiles[profile].violations.some(rule => rule.id === 'image-alt'));
    assert.equal(evidence.performance[profile].runs[0].status, 'Collected');
    assert.equal(evidence.performance[profile].metrics.LCP.count, 1);
  }
  assert.equal(report.rawScore, null);
  assert.equal(report.rank, null);
  assert.equal(report.status, 'Not Rankable');
  assert.deepEqual(contacts.filter(contact => contact.url.startsWith('/forbidden')), []);
  assert.deepEqual(contacts.filter(contact => !['GET', 'HEAD'].includes(contact.method)), []);
  assert.equal(text.includes('DO-NOT-STORE'), false);
});
