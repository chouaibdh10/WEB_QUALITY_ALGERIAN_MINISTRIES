// Exact row weights from section 7 of both methodology PDFs (layout-preserving extraction).
// Tool evidence never awards points: neither PDF specifies the full/partial/zero thresholds.
import {categoryMax} from '../../src/data/ministries.js';
import {assessCriteria, summarizeAssessments, ASSESSMENT_METHOD} from './assessment.mjs';

export const rubric = [
  ['security', 'External Security Posture and Technical Privacy', [
    ['https', 'HTTPS enforced', 2, 'HTTP redirect chain and final browser URL', 'httpRedirect'],
    ['certificate', 'Valid TLS certificate', 2, 'Trust, hostname and validity period', 'tls'],
    ['tls-configuration', 'Modern TLS configuration', 2, 'Full protocol/cipher assessment, not one negotiated connection', null],
    ['hsts', 'HSTS present and meaningful', 2, 'Header plus policy review', 'headers'],
    ['csp', 'Content-Security-Policy present and meaningful', 2, 'Header plus policy review', 'headers'],
    ['security-headers', 'Other important security headers', 2, 'Header capture and hardening review', 'headers'],
    ['cookies', 'Secure cookie configuration', 2, 'Flags of observed cookies', 'cookies'],
    ['mixed-content', 'No mixed HTTP/HTTPS content', 1, 'Browser and sampled-page evidence', 'browser'],
    ['version-exposure', 'No unnecessary software/version exposure', 1, 'Headers and passive public metadata', 'headers'],
    ['configuration-exposure', 'No obvious sensitive configuration exposure', 2, 'Passive eligible-page review only; no guessed sensitive paths', null],
    ['tracking', 'Third-party tracking and technical privacy restraint', 2, 'Request inventory plus tracking classification', 'browser'],
  ]],
  ['performance', 'Performance', [
    ['lcp', 'Largest Contentful Paint', 4, 'Median lab LCP; p75 field LCP where available', 'performance'],
    ['responsiveness', 'Responsiveness', 3, 'Field INP or explicitly labelled lab TBT proxy', 'performance'],
    ['cls', 'Cumulative Layout Shift', 3, 'Median lab CLS; p75 field CLS where available', 'performance'],
    ['server-content', 'Server response and first content', 2, 'TTFB and FCP under declared conditions', 'performance'],
    ['resources', 'Resource and page-weight efficiency', 2, 'Transfer bytes, requests and diagnostics', 'performance'],
    ['consistency', 'Performance consistency', 1, 'Spread across repeated runs and sampled pages', 'performance'],
  ]],
  ['accessibility', 'Accessibility', [
    ['wcag', 'Verified WCAG 2.2 issue set', 3, 'Automated findings verified manually', 'axe'],
    ['contrast', 'Color contrast', 2, 'Automated findings and manual spot check', 'axe'],
    ['alt', 'Image alternative text', 1, 'Automated and manual review', 'axe'],
    ['form-access', 'Form labels, instructions and errors', 2, 'Manual form inspection plus axe', 'axe'],
    ['keyboard', 'Keyboard navigation', 2, 'Manual keyboard path notes', null],
    ['semantics', 'Semantic HTML and headings', 1, 'DOM and heading outline', 'browser'],
    ['focus', 'Focus indicators', 1, 'Manual interaction notes', null],
    ['language-aria', 'Correct page language and ARIA usage', 1, 'Language and ARIA findings with manual review', 'axe'],
    ['zoom', 'Zoom, reflow and orientation', 1, 'Manual responsive accessibility review', 'browser'],
    ['complete-process', 'Complete-process accessibility check', 1, 'Selected citizen journey notes', null],
  ]],
  ['reliability', 'Reliability and Availability', [
    ['uptime', 'Uptime percentage', 4, 'Complete 28-day monitor log with observation gaps', 'monitor'],
    ['failures', 'HTTP/server failure rate', 2, 'Status and timeout history', 'monitor'],
    ['response-stability', 'Response-time stability', 2, 'Median, p90 and p95 response times', 'monitor'],
    ['connection-continuity', 'DNS, TLS and redirect continuity', 1, 'Connection-chain events over time', 'monitor'],
    ['endpoints', 'Critical endpoint consistency', 1, 'Home and selected service endpoint history', 'monitor'],
  ]],
  ['mobile', 'Mobile Usability and Citizen Journeys', [
    ['reflow', 'Responsive design and reflow', 2, 'Desktop and mobile screenshots', 'browser'],
    ['touch', 'Mobile readability and touch targets', 2, 'Manual viewport review', 'browser'],
    ['navigation', 'Navigation and information architecture', 2, 'Task walkthrough notes', null],
    ['mobile-forms', 'Forms usable on mobile', 2, 'Manual form inspection', 'browser'],
    ['journey', 'Citizen-journey task success', 4, 'Standard task protocol', null],
    ['interface', 'Interface consistency', 1, 'Sample-page comparison', 'browser'],
    ['recovery', 'Errors, recovery and contextual help', 2, 'Journey and form notes', null],
  ]],
  ['content', 'Content, Public Services and Trust', [
    ['identity', 'Official identity and domain ownership clear', 1, 'Independent government-source verification', null],
    ['mission', 'Ministry mission and organization available', 1, 'About and organization pages', null],
    ['service-list', 'Public services clearly listed', 2, 'Service directory evidence', null],
    ['procedures', 'Procedures and eligibility explained', 2, 'Procedure pages or documents', null],
    ['documents', 'Required documents, forms and instructions available', 2, 'Forms, PDFs and instructions', null],
    ['service-function', 'Service links/forms functional', 2, 'Non-destructive manual click-through tests', null],
    ['contact', 'Contact or feedback channel available', 1, 'Contact path reviewed manually', null],
    ['multilingual', 'Useful multilingual content where applicable', 2, 'Arabic, French, Tamazight and English review', 'browser'],
    ['dates', 'Publication and update dates available', 1, 'Dated content sample', null],
    ['clarity', 'Content clarity and cross-page consistency', 1, 'Manual sample review', null],
  ]],
  ['technical', 'Technical Quality and Findability', [
    ['links', 'No significant broken internal links', 2, 'Eligible crawl plus manual validation; explicit sample is not a full crawl', null],
    ['broken-resources', 'No broken images/resources', 1, 'Observed browser response failures', 'browser'],
    ['metadata', 'Meaningful page titles and metadata', 1, 'Title, description and manual usefulness check', 'browser'],
    ['crawlability', 'Sitemap/crawlability configuration', 1, 'robots.txt and sitemap.xml observations', 'robots'],
    ['canonical', 'Clean URLs, canonicalization and redirects', 1, 'Declared URL sample, canonical and redirects', 'browser'],
    ['site-search', 'Functional site search and discoverability', 2, 'Manual search task, not mere input presence', 'browser'],
    ['obsolete-technology', 'No critically outdated public technology', 1, 'Passive fingerprint plus verified support status', null],
    ['cross-page', 'Cross-page technical consistency', 1, 'Comparison of representative pages', 'browser'],
  ]],
].map(([key, label, rows]) => ({key, label, maxPoints: categoryMax[key], rows: rows.map(([id, label, maxPoints, requirement, source]) => ({id: `${key}.${id}`, label, maxPoints, requirement, source}))}));

export const privacyIndicators = [
  'Privacy or personal-data notice availability',
  'Explanation of personal-data collection in forms or services',
  'Cookie, analytics and third-party tracking transparency',
  'Contact channel for privacy-related requests',
  'Secure submission of personal data through HTTPS forms',
  'Consistency of privacy information across language versions',
];

export function coverageReport(pages, {robotsEvidence = [], monitoring = null, httpRedirect = null} = {}) {
  const assessments = assessCriteria(pages, {robotsEvidence, monitoring, httpRedirect});
  const references = {
    httpRedirect: httpRedirect?.status ? ['http-redirect.json'] : [],
    tls: pages.filter(p => p.http?.tls).map(p => `${p.id}/http.json#tls`),
    headers: pages.filter(p => p.http?.status).map(p => `${p.id}/http.json#headers`),
    cookies: pages.filter(p => p.http?.cookies?.length).map(p => `${p.id}/http.json#cookies`),
    robots: robotsEvidence.length ? ['robots.json', ...pages.filter(p => p.type === 'homepage' && p.sitemap?.status).map(p => `${p.id}/sitemap.json`)] : [],
    browser: pages.filter(p => Object.values(p.browser?.observations ?? {}).some(Boolean)).map(p => `${p.id}/browser.json#observations`),
    axe: pages.filter(p => Object.values(p.browser?.accessibility?.profiles ?? {}).some(v => v?.testEngine)).map(p => `${p.id}/browser.json#accessibility`),
    performance: pages.filter(p => Object.values(p.browser?.performance ?? {}).some(v => v?.runs?.some(r => r.status === 'Collected'))).map(p => `${p.id}/browser.json#performance`),
    monitor: monitoring?.samples ? ['monitoring-summary.json'] : [],
  };
  const categories = rubric.map(category => ({
    key: category.key, label: category.label, maxPoints: category.maxPoints, awardedPoints: null,
    rows: category.rows.map(({source, ...row}) => {
      const evidence = references[source] ?? [];
      return {...row, awardedPoints: null, status: evidence.length ? 'Review required' : 'N/M', evidence, assessment: assessments[row.id]};
    }),
  }));
  const rows = categories.flatMap(c => c.rows);
  return {
    rawScore: null, rank: null, status: 'Not Rankable',
    reason: 'Candidate ownership, representative-page coverage, scoring thresholds, 28-day monitoring and independent review are not approved by this automated collection.',
    categories,
    assessmentMethod: ASSESSMENT_METHOD,
    assessmentSummary: summarizeAssessments(rows),
    coverage: {
      totalCriteria: rows.length, scoredCriteria: 0,
      criteriaWithSupportingEvidence: rows.filter(r => r.evidence.length).length,
      unmeasuredCriteria: rows.filter(r => r.status === 'N/M').map(r => r.id),
      pendingReviewCriteria: rows.filter(r => r.status === 'Review required').map(r => r.id),
      note: 'Supporting evidence is not scored measurement coverage; no renormalization or automated compliance claim.',
    },
    dataProtection: privacyIndicators.map(label => ({label, status: 'N/M', note: 'Separate evidence flags, not a legal compliance score; human review required.'})),
  };
}
