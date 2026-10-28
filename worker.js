import indexHtml from './dist/index.html';

const release = indexHtml.match(/assets\/index-([^./]+)\.js/)?.[1] ?? 'unknown';

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const url = new URL(request.url);
    const lastSegment = url.pathname.split('/').pop();
    // Bundle the page shell with this deployment rather than reusing an HTML asset cache.
    // React handles extensionless directory/profile routes; files keep real asset semantics.
    if (!lastSegment || !lastSegment.includes('.') || url.pathname === '/index.html') {
      return new Response(request.method === 'HEAD' ? null : indexHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'CDN-Cache-Control': 'no-store',
          'X-WQI-Release': release,
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    headers.set('Cache-Control', url.pathname.startsWith('/assets/') && asset.ok
      ? 'public, max-age=31536000, immutable' : 'no-cache');
    headers.set('X-WQI-Release', release);
    return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
  },
};
