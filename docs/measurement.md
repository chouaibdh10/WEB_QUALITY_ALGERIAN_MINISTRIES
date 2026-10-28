# Ministry website quality measurement

## What the script does

`npm run measure` is a local, read-only website scanner with criterion-level diagnostics for the corpus used by the frontend (`src/data/ministries.js`). It can process one portfolio or all 34. The two unresolved portfolios are explicitly skipped, never assigned guessed domains. Default sampling is the homepage; `--discover` can propose and scan additional actually observed pages, or `--samples` can freeze a reviewed page set.

The implementation captures:

- robots policies, declared crawl-delay, HTTP status, bounded redirect chains and selected response headers;
- cookie attributes without names/values, and the negotiated TLS protocol/cipher/certificate metadata when a verified HTTPS connection succeeds;
- actual Chrome observations and mobile/desktop screenshots;
- axe-core WCAG 2 A/AA, 2.1 A/AA and 2.2 AA findings, including incomplete checks;
- repeated mobile and desktop Lighthouse reports: LCP, CLS, FCP, labelled TBT proxy, document server-response audit and transfer bytes, with median/min/max/p90/count;
- title, description, language, canonical, viewport, headings, form-label and image-alt counts, search-control detection, horizontal overflow, visible touch-target rectangles, insecure form actions, language hints and eligible same-origin links;
- loaded-resource failures and blocked requests; a blocked request is not evidence of an intrinsically broken resource;
- a separate append-only monitoring mode, with endpoint-specific sample availability, median/p90/p95 response time, observation gaps and period length;
- all **57 rubric rows**, exact point budgets and actual per-criterion diagnostic results: `Issue detected`, `No issue detected`, `Needs review` or `Not measured`, with page/profile values, method and scope;
- private JSON/CSV/Markdown summaries, a per-ministry `criteria.csv`, reviewable discovered samples and a SHA-256 artifact manifest; stray async errors that escape per-page error handling are recorded in a run-level `crashes.jsonl` and collection continues.

The CLI does **not** publish results to the dashboard or run from the public Cloudflare website. Browser tools and scanning remain on the operator's workstation.

## Install and run

Use Node 22+ and an installed Chrome/Chromium binary. Dependencies are pinned in the lockfile.

```sh
npm ci
npm run measure -- --help
npm run measure -- --list
npm run measure -- --ministry higher-education --location "Bejaia, Algeria" --evaluator "Research operator"
npm run measure -- --all --http-only --location "Bejaia, Algeria"
```

The last command makes conservative discovery observations of candidate domains, not verified ministry scores. The full browser mode defaults to three repeated runs for **each** device profile. Three is an implementation choice, not a repetition count prescribed by the PDF. Increase it consistently across the corpus after the pilot.

Use `--chrome-path` or `CHROME_PATH` for another installed Chrome binary. Chrome's sandbox stays enabled. `CHROME_NO_SANDBOX=1` is an explicit exception for an isolated container, not the recommended workstation configuration.

`--http-only` deliberately omits browser evidence; it is not an automatic fallback that fabricates performance or accessibility values. Failed requests, refused robots policies and unavailable metrics remain explicit.

### Prepare the nationwide campaign without scanning

```sh
npm run measure -- --all --plan --out evidence
```

This executable offline path writes `plan.json` and prints the complete plan: 34 portfolios, 32 candidate hosts and two unresolved skips, approved origins, declared pages, missing page types and settings. It does not resolve DNS, contact websites or launch Chrome. It is a configuration preview, not domain verification.

### Discover observed pages and measure individual criteria

```sh
npm run measure -- --ministry higher-education --discover --runs 3 --location "Bejaia, Algeria"
```

Discovery first measures the actual homepage in a browser, then selects at most five additional distinct URLs from its observed same-origin link inventory. English/French/Arabic label/path heuristics identify service, news and contact candidates; a deeper-path candidate and deterministic SHA-256 selection supply additional diagnostic samples. No URLs are invented. Query/fragment, download, authentication, destructive and submission routes are excluded, including common French authentication/destructive names. Every selected URL passes the collector guard before contact.

`discovered-samples.json` records the source pool, selection rationale, omissions, guard results and a `samples` object to review and freeze. The pseudo-random selection is from the observed eligible homepage links, not a claim of full eligible-corpus sampling. Explicit `--samples` entries take precedence. `--discover` is incompatible with `--http-only` and `--monitor` because those modes do not collect a DOM inventory.

Each criterion's `assessment` contains `status`, `automated`, `measurements`, `reason` and `scope`, using the versioned `passive-criterion-diagnostics/1.0` method. Reports expose actual HSTS/CSP parsing, hardening/cookie conditions, observed TLS trust, performance values and distributions, mapped axe findings/incomplete checks, reflow and mobile-form observations, resources/metadata and observed monitoring statistics. Manual-only criteria retain a precise review requirement. Failure to measure a page/profile cannot silently become a clean result; no observed cookies cannot become “secure cookies.”

`No issue detected` means only that a particular automated diagnostic found no issue in its stated sample/context. It does not mean the entire PDF criterion or website passed. A detected issue can propagate from one sampled page while missing/constrained samples remain explicit. Diagnostic counts are not rubric points or scoring coverage.

Performance diagnostic references are [LCP](https://web.dev/articles/lcp), [CLS](https://web.dev/articles/cls) and lab-only [TBT](https://web.dev/articles/tbt); published CWV field thresholds apply to field p75, not a claim that a lab median establishes field compliance. TBT is not INP. Touch-size counts flag rectangles for review, respecting the [WCAG 2.2 target-size exceptions](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), rather than treating every small inline link as an AA failure.

Before the national run, verify primary domains and canonical origins, pilot the rubric on at least three diverse sites, and freeze approved sample manifests/settings. Then the existing sequential batch command can scan the corpus using reviewed samples:

```sh
npm run measure -- --all --samples approved-samples.json --runs 3 --location "Bejaia, Algeria"
```

Prepare that JSON file from reviewed per-ministry declarations; the filename is not a bundled measured dataset. Omitted ministries otherwise retain the default homepage-only plan. The two unresolved domains remain skipped. Per-target collection errors are recorded while the batch continues; input/configuration errors fail before contact. No automatic retry, result publication or final national ranking is performed.


### Representative pages

Prepare a JSON file keyed by the exact IDs printed by `--list`. Each entry is an array of objects with:

- `type`: `homepage`, `service`, `news`, `contact`, `deep`, `random`, `language` or `journey`;
- `url`: the actual public HTTP(S) URL;
- `note`: sampling rationale, documented substitution or the reproducible random-selection method.

For example, this valid discovery-only input still does **not** meet representative-page coverage:

```json
{
  "higher-education": [
    {"type": "homepage", "url": "https://mesrs.dz/", "note": "Discovery homepage only; representative corpus incomplete"}
  ]
}
```

After saving the input as `samples.json`:

```sh
npm run measure -- --ministry higher-education --samples samples.json --runs 3 --location "Bejaia, Algeria"
```

The collector accepts up to 12 explicitly declared pages per portfolio and rejects duplicate URLs. It does not pretend a randomly named page is a reproducibly selected random sample. Complete domain verification and eligible-corpus selection separately; do not guess service paths or sensitive configuration locations.

HTTP and HTTPS on the original host are approved. A different canonical host or redirect origin must be explicitly supplied with `--allow-origin`; inspect official ownership evidence before approving it. Both HTTP and browser redirects are checked before contacting unapproved documents. Browser runs start from the exact declared URL, including its public query parameters, rather than a redacted report URL.

### Monitoring

`--monitor` performs **one** timestamped observation of each declared endpoint and appends to `evidence/monitoring/<portfolio-id>.jsonl`. Schedule it externally at the interval declared in the command. A suggested ten-minute interval is not a PDF-mandated value:

```sh
npm run measure -- --ministry higher-education --samples samples.json --monitor --interval-seconds 600 --location "Bejaia, Algeria"
```

Keep the output root, endpoint manifest, location/network label and interval consistent across scheduled invocations for at least 28 days. Run from independently documented networks where the protocol requires it. Logs from one declared network do not prove two-network verification. Planned maintenance, source identity and network labels require human review. Samples collected with changed intervals cannot be labelled a complete declared schedule.

`sampleAvailabilityPercent` is successful observations divided by actual network observations, **not continuous uptime**. DNS/TLS/timeout failures are failed observations. Policy refusals and unknown errors are excluded and reported, never treated as success. Logs remain provisional even when their span reaches 28 days. A long gap does not become uptime evidence merely because first and last timestamps are far apart.

## Safety and evidence handling

- GET/HEAD only; no authentication, forms, citizen-task submissions, exploit payloads, fuzzing, password checks or guessed sensitive paths.
- HTTP requests are sequential, paced by at least 1.5 seconds by default, and honor positive robots crawl-delay. Public pacing cannot be set below 500 ms.
- Browser loads cap concurrent network requests at four and space document runs. An explicit positive crawl-delay causes browser collection to be omitted, rather than violating that delay or corrupting the performance waterfall with artificial per-resource delays.
- Missing robots (404) allows collection; denied, malformed or unreachable robots fails closed. This is intentionally more conservative than some interpretations of RFC 9309.
- HTTP 429 or 503 halts the collector for that target. Subsequent requests are recorded as excluded, not silently retried.
- Redirects are bounded and origin-checked. HTTP response bodies are bounded to 2 MB; target HTML is not retained. Timeout and byte-limit omissions are explicit.
- Private, reserved and link-local addresses are rejected. Native HTTP requests use a validated, pinned DNS snapshot and normal certificate verification. Chromium validates DNS but uses its own resolver/proxy; **browser DNS rebinding is not fully prevented**. Run only against reviewed public targets on an isolated research workstation, not as an arbitrary-URL internet service.
- `--allow-local` permits approved loopback fixtures only, never private LAN addresses.
- Raw cookie values, authorization headers, DOM snippets and form values are omitted from tool JSON. Tool-reported URL queries are redacted; declared sample URLs are retained in the private manifest. Never include credentials or secret-bearing URLs in samples.
- Evidence directories are mode 0700 and files 0600 on POSIX. `evidence/` is gitignored and outside `public/`. Custom `--out` paths must remain private. Screenshots, public-page metadata and reports still require **manual redaction before publication**. File permissions are not encryption.

## Why there is no automatic 0–100 ministry score

Both methodology PDFs agree on the following category weights:

| Category | Possible points |
|---|---:|
| External security posture and technical privacy | 20 |
| Performance | 15 |
| Accessibility | 15 |
| Reliability and availability | 10 |
| Mobile usability and citizen journeys | 15 |
| Content, public services and trust | 15 |
| Technical quality and findability | 10 |

Layout-preserving PDF extraction was used to recover the point budget of every row. The PDFs do **not** provide the complete full/partial/zero thresholds, numeric minimum coverage thresholds, exact repetitions or monitoring interval. Those choices must be predeclared in the scoring workbook, piloted and independently approved. The script cannot invent them.

Consequently `rawScore`, category `awardedPoints` and `rank` stay null. The evidence-review state (`Review required` or `N/M`) is distinct from the new `assessment.status`, which carries actual criterion diagnostic outcomes and values. `criteriaWithSupportingEvidence` and `criteriaWithMeasurements` are not scored measurement coverage. An automated diagnostic is not independent approval of a rubric item. No upward renormalization occurs.

Manual work remains essential for keyboard paths, focus visibility, assistive-technology behavior, citizen-journey success, mobile form recovery, content usefulness, multilingual equivalence, identity/ownership, trackers, legal/privacy interpretation and disputed findings. A successful TLS connection does not enumerate every supported protocol or cipher. Header presence does not prove a meaningful CSP/HSTS policy. No-violation axe output does not establish WCAG conformance. No field INP is inferred from lab TBT. Lighthouse's aggregate performance/accessibility scores never receive separate rubric points.

Final publication still requires the representative corpus, complete reliability protocol, reviewed scoring workbook, evidence approval and ranking-stability/sensitivity checks. Exact ties share rank; differences under two points are the same performance band unless stability evidence supports ordering. The collector does not label a site persistently unreachable from a single failed network observation.

## Tool research and choices

Research used the following primary documentation, rather than obsolete API tutorials. The core is local and keyless; the other services are researched options, **not implemented integrations**.

| Tool | Useful evidence / rubric coverage | Access and caveats | Decision |
|---|---|---|---|
| [Lighthouse Node API/CLI](https://github.com/GoogleChrome/lighthouse/blob/main/readme.md), [variability guidance](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md) | Repeated LCP, CLS, FCP, TBT, loading and resource diagnostics | Local Chrome, Node 22+; hardware/network variance; keep mobile/desktop profiles separate | Implemented; store reports and metric distributions, not ministry points |
| [axe-core API](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md) | Rendered-page WCAG-related violations and incomplete checks | Local; hidden states and entire processes require explicit manual review | Implemented; combine with screenshots and human review |
| [W3C evaluation-tool guidance](https://www.w3.org/WAI/test-evaluate/tools/selecting/) | Defines the limits of automated accessibility checks | Tools assist, but cannot determine complete accessibility/conformance | Governs interpretation of axe output |
| [PageSpeed Insights v5](https://developers.google.com/speed/docs/insights/v5/get-started) | Hosted Lighthouse, remote lab perspective | Can be used without a key; a key is recommended for frequent automated calls; quotas and service errors apply; field-data inclusion is being discontinued | Alternative to local runs, not an extra score to add |
| [CrUX API](https://developer.chrome.com/docs/crux/api) | Field p75 LCP, CLS, INP by URL/origin/form factor | Google Cloud API key; low-traffic sites may have no eligible record; retain collection period and distinguish URL from origin | Prefer this for field data; missing data is N/M, not a penalty |
| [MDN HTTP Observatory](https://github.com/mdn/mdn-http-observatory/blob/main/README.md) | HTTP hardening policy diagnostics | Local CLI available; current hosted endpoint is POST `https://observatory-api.mdn.mozilla.net/api/v2/scan?host=...`; one scan per host per minute, otherwise cached; hosted API omits detailed headers | Useful supplementary cross-check; old v1 shut down 31 October 2024; local headers collected directly |
| [SSL Labs v4](https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v4.md) | Supported TLS protocols/ciphers and certificate-chain assessment | Registration and registered organization-email header; third-party server assessments, terms, capacity/rate limits; assessments commonly take at least 60 seconds | Review terms/scope before use; never replace full TLS assessment with one handshake |
| [Internet.nl batch API/dashboard](https://internet.nl/faqs/batch-and-dashboard/), [API docs](https://github.com/internetstandards/Internet.nl-API-docs) | IPv6, DNSSEC, HTTPS/TLS and modern internet standards | Hosted batch-service setup and terms; many tests are supplementary metadata, not automatically index points | Optional independently documented standards assessment |
| [WAVE API](https://wave.webaim.org/api/) | Independent rendered-page accessibility findings | API key and purchased credits; licensed local engine also available | Optional manual/automated cross-check, not an accessibility certification |
| [WebPageTest API](https://github.com/catchpoint/WebPageTest.docs/blob/main/src/api/index.md) | Multi-location/browser tests, waterfalls, repeated runs and cache conditions | API key/service limits; hosted test agent locations must be recorded | Useful for multi-network/repeated-run evidence when access is available |
| Native Node HTTP/TLS/DNS plus Chromium observations | Headers, redirects, trust-verified connections, passive public metadata | Negotiated connection and explicit page sample only; browser DNS limitation documented above | Implemented without external scan services |
| Scheduled endpoint collector / [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html) | Availability samples, failures, gaps and conservative robots handling | Requires sustained scheduling and maintenance/network review | Implemented append-only observation mode; not fabricated 28-day uptime |

Neither aggressive vulnerability scanners nor automatically submitted citizen forms belong in this passive benchmark.

## Verification

```sh
npm run test:measurement
npm run build
```

The development smoke used a controlled localhost page with an actual missing image alternative, a robots-disallowed iframe and a POST form. Real Chrome/axe/Lighthouse runs produced mobile/desktop screenshots, two Lighthouse repetitions per profile and the expected `image-alt` finding. The excluded path received no requests and the form was never submitted. A one-observation monitor remained provisional with no claim of a completed 28-day period.

The criterion/discovery extension was exercised against another controlled site containing weak CSP, missing image alternatives, a genuinely missing resource, an undersized control, an insecure form, a robots-blocked iframe and an authentication link. The CLI discovered and measured the homepage plus observed service, contact and deterministic random candidates: four pages, two profiles and two Lighthouse repetitions per profile (16 successful Lighthouse runs). It did not invent missing news/deep/language/journey pages. All 51 artifact hashes matched; the cookie secret was absent from saved JSON, and neither the blocked nor authentication URL was contacted. No form writes occurred. A false mixed-content classification on HTTP-only pages was corrected and verified by re-evaluating the actual collected observations: mixed-content assessment now requires an HTTPS document. The final regression suite passed all 53 tests with none skipped.

The nationwide offline plan was also executed: 34 portfolios, 32 candidate hosts, two unresolved skips and no site contacts. No new nationwide ministry scan was started during this implementation.

An additional smoke preserved a query-dependent service page through an explicitly approved cross-origin redirect, with two successful Lighthouse runs per profile. In the first successful smoke, all saved JSON omitted the fixture cookie secret and all 16 manifest hashes matched their artifacts. The permanent browser regression covers the actual CLI path, redirect/query correctness, accessibility finding, policy blocking and absence of form writes; it explicitly skips only when the required Chrome binary is unavailable.

A real `higher-education` discovery attempt also produced a private report; this workstation could not resolve `mesrs.dz`, so the report preserved `ERR_DNS` and N/M instead of assigning zero or inventing a score. This is not proof the ministry website is globally unreachable.

## Published Communication pilot

The first reviewed pilot lives at `/ministries/communication`, with a publication-safe JSON download at `/evaluations/communication-pilot.json`. Its separately versioned scoring decisions are in `docs/pilots/communication-protocol-v1.md`. This is a provisional evaluation of the candidate host `mcomm.gov.dz`, not an independently approved ministry ranking. It preserves every unmeasured point budget, including the full reliability period.

`scripts/pilot-communication.mjs` records the sequential pilot lab campaign, `scripts/pilot-manual.mjs <private-evidence-directory>` records read-only responsive/keyboard/page observations, and `scripts/publish-communication-pilot.mjs <private-evidence-directory>` requires all 57 explicit review decisions before publishing aggregates. Raw evidence stays outside the public build. Network interstitials and failed exploratory attempts are excluded. The ordinary collector's automatic diagnostics remain unscored.
