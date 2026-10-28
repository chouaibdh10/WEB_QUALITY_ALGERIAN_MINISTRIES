import {createHash} from 'node:crypto';

export const REQUIRED_PAGE_TYPES = ['homepage', 'service', 'news', 'contact', 'deep', 'random', 'language', 'journey'];
const DISCOVERY_TYPES = ['service', 'news', 'contact', 'deep', 'random'];
const PAGE_TYPES = new Set(REQUIRED_PAGE_TYPES);
const UNSAFE_PATH = /(?:^|[/_.-])(?:admin|log[-_]?in|log[-_]?out|sign[-_]?in|sign[-_]?out|connexion|d[eé]connexion|supprimer|effacer|d[eé]sinscription|auth|oauth|account|session|register|delete|remove|destroy|unsubscribe|submit|checkout|payment|cart|download|upload|export)(?:$|[/_.-])/i;
const DOWNLOAD_PATH = /\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|gz|exe|apk|csv|xml|json|jpe?g|png|gif|svg|mp[34]|webm)(?:$|\/)/i;
const MATCHERS = {
  service: /service|procedure|d[eé]marche|prestation|خدم|إجراء|اجراء/i,
  news: /news|actualit|communiqu|presse|[ée]v[ée]nement|أخبار|اخبار|مستجد|بيان/i,
  contact: /contact|coordonn|nous[- ]joindre|اتصل|اتصال|تواصل/i,
};

export function cleanUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only public HTTP(S) URLs without credentials are allowed');
  url.hash = '';
  return url.href;
}

// Pure configuration planning: no collector, DNS resolution or network contact.
export function createMeasurementPlans(targets, {samples = {}, approvedExtraOrigins = []} = {}) {
  if (!samples || Array.isArray(samples) || typeof samples !== 'object') throw new Error('--samples must contain an object keyed by ministry IDs');
  const extras = approvedExtraOrigins.map(value => new URL(cleanUrl(value)).origin);
  return targets.map(ministry => {
    const defaultUrl = ministry.url ? cleanUrl(ministry.url) : ministry.domain ? `https://${ministry.domain}/` : null;
    const origin = defaultUrl ? new URL(defaultUrl) : null;
    const origins = origin ? [...new Set([origin.origin, `${origin.protocol === 'https:' ? 'http:' : 'https:'}//${origin.host}`, ...extras])] : [];
    const explicitSamples = Object.hasOwn(samples, ministry.id);
    const declared = explicitSamples ? samples[ministry.id] : defaultUrl ? [{type: 'homepage', url: defaultUrl, note: 'Default homepage-only sample; representative corpus incomplete'}] : [];
    if (!Array.isArray(declared) || declared.length > 12 || (defaultUrl && declared.length === 0)) throw new Error(`${ministry.id}: declare 1–12 public sample pages`);
    const pages = declared.map((page, index) => {
      if (!page || !PAGE_TYPES.has(page.type) || typeof page.url !== 'string') throw new Error(`${ministry.id}: every page needs a supported type and URL`);
      const url = cleanUrl(page.url);
      if (!origins.includes(new URL(url).origin)) throw new Error(`${ministry.id}: sample origin outside target; explicitly approve with --allow-origin`);
      return {id: `page-${index + 1}`, type: page.type, url, note: page.note ?? 'No sampling rationale supplied'};
    });
    if (new Set(pages.map(page => page.url)).size !== pages.length) throw new Error(`${ministry.id}: duplicate sample URLs are not independent coverage`);
    return {ministry, origins, pages, explicitSamples, skipped: !defaultUrl,
      skipReason: defaultUrl ? null : 'Unresolved candidate domain; no origin approved and no requests planned.',
      requiredMissingPageTypes: REQUIRED_PAGE_TYPES.filter(type => !pages.some(page => page.type === type))};
  });
}

export function offlinePlan(plans, {discover = false, mode = 'http-and-browser', ...settings} = {}) {
  return {schemaVersion: 1, kind: 'offline-measurement-plan', networkContacted: false,
    totalPortfolios: plans.length, runnablePortfolios: plans.filter(plan => !plan.skipped).length,
    unresolvedSkips: plans.filter(plan => plan.skipped).map(plan => ({id: plan.ministry.id, reason: plan.skipReason})),
    mode, settings, rawScore: null, rank: null,
    note: 'Candidate origins are operator-scoped, not verified government ownership. Missing types remain missing until observed or explicitly declared; no URLs are invented.',
    portfolios: plans.map(plan => ({...plan, approvedOrigins: plan.origins,
      discovery: !discover ? 'Not requested' : plan.skipped ? 'Skipped: unresolved domain' : plan.explicitSamples ? 'Skipped: explicit --samples takes precedence' : 'After homepage browser collection: select at most five distinct observed service/news/contact/deep/random candidates; guard each before collection',
    }))};
}

function candidateReason(raw, homepageOrigin) {
  let url;
  try { url = new URL(raw); } catch { return 'Invalid absolute URL'; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return 'Non-HTTP(S) or credential-bearing URL';
  if (url.origin !== homepageOrigin) return 'Not same-origin with observed homepage';
  if (url.search || url.hash) return 'Query or fragment URL excluded from discovery';
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return 'Invalid encoded path'; }
  if (UNSAFE_PATH.test(pathname) || DOWNLOAD_PATH.test(pathname)) return 'Authentication, destructive, submission or download path excluded';
  return null;
}

// Only links actually observed on the collected homepage are eligible. Hash ordering
// makes the random diagnostic repeatable; it is not a full-corpus WCAG sample.
export function discoverSamples(homepage, pages) {
  const sourcePool = [];
  const byUrl = new Map();
  const used = new Set(pages.flatMap(page => [page.url, page.http?.finalUrl,
    ...Object.values(page.browser?.observations ?? {}).map(observation => observation?.finalUrl)]).filter(Boolean));
  let inventories = 0;
  for (const [profile, observation] of Object.entries(homepage?.browser?.observations ?? {})) {
    if (!Array.isArray(observation?.links)) continue;
    inventories++;
    const origin = new URL(observation.finalUrl ?? homepage.http?.finalUrl ?? homepage.url).origin;
    for (const link of observation.links) {
      if (!link || typeof link.url !== 'string') continue;
      const existing = byUrl.get(link.url);
      if (existing) {
        if (!existing.profiles.includes(profile)) existing.profiles.push(profile);
        if (typeof link.label === 'string' && !existing.labels.includes(link.label.slice(0, 100))) existing.labels.push(link.label.slice(0, 100));
        continue;
      }
      const omission = candidateReason(link.url, origin) ?? (used.has(link.url) ? 'Already declared or collected; not rediscovered' : null);
      const candidate = {url: link.url, labels: typeof link.label === 'string' ? [link.label.slice(0, 100)] : [], profiles: [profile], eligible: !omission, omission};
      sourcePool.push(candidate);
      byUrl.set(link.url, candidate);
    }
  }
  const eligible = sourcePool.filter(candidate => candidate.eligible).sort((a, b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0);
  const selected = [];
  const omissions = [];
  for (const type of DISCOVERY_TYPES) {
    let choices = eligible.filter(candidate => !used.has(candidate.url));
    if (MATCHERS[type]) choices = choices.filter(candidate => MATCHERS[type].test(`${decodeURIComponent(new URL(candidate.url).pathname)} ${candidate.labels.join(' ')}`));
    if (type === 'deep') choices = choices.filter(candidate => new URL(candidate.url).pathname.split('/').filter(Boolean).length >= 2);
    if (type === 'random') choices = choices.sort((a, b) => {
      const hash = candidate => createHash('sha256').update(`${homepage.url}\n${candidate.url}`).digest('hex');
      return hash(a).localeCompare(hash(b));
    });
    const choice = choices[0];
    if (!choice) {
      omissions.push({type, reason: inventories ? 'No distinct eligible observed homepage link matched this selection rule' : 'Homepage DOM link inventory was not collected'});
      continue;
    }
    const rationale = type === 'random' ? 'Lowest SHA-256(homepage URL + newline + candidate URL) among remaining observed eligible homepage links; deterministic pseudo-random diagnostic, not full-corpus WCAG selection'
      : type === 'deep' ? 'Observed eligible homepage link with at least two nonempty path segments; lexicographically first remaining URL'
        : `Observed homepage label/path matched the ${type} keyword rule (English/French/Arabic heuristic); lexicographically first remaining URL, manual relevance review required`;
    used.add(choice.url);
    selected.push({id: `page-${pages.length + selected.length + 1}`, type, url: choice.url, note: rationale,
      discovery: {homepageUrl: homepage.url, labels: choice.labels, profiles: choice.profiles, rationale}});
  }
  for (const candidate of sourcePool) if (candidate.eligible && !selected.some(page => page.url === candidate.url)) candidate.omission = 'Not selected: at most one distinct URL per diagnostic type, maximum five additional pages';
  return {schemaVersion: 1, method: 'Observed homepage links only; deterministic label/path heuristics, not a representative-corpus guarantee',
    homepageUrl: homepage?.url ?? null, sourceInventoryAvailable: inventories > 0, sourcePool, selected, omissions,
    requiredMissingPageTypes: REQUIRED_PAGE_TYPES.filter(type => ![...pages, ...selected].some(page => page.type === type)),
    review: 'Review source pool, type assignments and omissions; freeze approved URLs in --samples JSON before the national run. No form interaction or invented URLs.'};
}
