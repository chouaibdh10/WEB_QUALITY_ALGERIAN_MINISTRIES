# Clarity DZ — evidence-gap revision, 26 October 2026

This revision preserves all original 57 criterion weights, 100-point budgets and full/half/zero thresholds. It does not convert unmeasured items into zero, pass or “not applicable.” Collection coverage and a ministry's score remain different quantities.

## Primary-source research

- W3C's [WCAG-EM overview](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/) supports a declared representative sample with recorded evaluation steps, rather than treating tool pass counts as complete website conformance.
- W3C's [conformance guidance](https://www.w3.org/WAI/WCAG22/Understanding/conformance) requires evaluation across a complete process for a process-conformance claim. A reachable form is not evidence that the entire service conforms.
- Chrome's [performance-scoring documentation](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring/) explains why conditions and distributions matter. Existing repeated timings are retained rather than replaced by a selected favourable run.
- Chrome's [TBT documentation](https://developer.chrome.com/docs/lighthouse/performance/lighthouse-total-blocking-time) defines a laboratory load-blocking metric. This publication continues to label TBT as a proxy, without calling it measured field INP.
- [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html) describes crawler rules and their handling. The existing trusted-TLS, robots and rate-limit collection safeguards remain in effect.

The 28-day, multiple-network reliability requirement is this project's declared protocol. It is not presented as a universal requirement imposed by these sources.

## Correcting a false document-size exclusion

The previous collector excluded Youth's 18 retained successful timing captures because their main HTML document was 703 bytes. Their screenshots actually show the loaded client-rendered ministry application: substantive news, the contact form and the organization view. HTML bootstrap length alone did not justify excluding these documents.

Each of the 18 final screenshots was reviewed individually alongside the corresponding normal-browser page. A private receipt identifies the exact original Lighthouse file and screenshot by SHA-256, records the main document URL, review date and reason, and explicitly accepts that rendered document. No raw measurement, original N/M annotation or failed attempt is overwritten. The audit requires a successful approved-origin main document, no runtime error, an exact file hash and an exact screenshot hash before accepting this exception. Successful iframes, blank pages, unreviewed small responses and runtime failures remain excluded. Timing profiles and score thresholds are unchanged. This is an implementing-evaluator correction; independent review remains pending.

## Supplementary checks

Before navigation, a private manifest freezes observed same-site links and observed GET search actions/fields from the retained core DOM. The follow-up tests at most one offered-language URL, one candidate institutional-information link and one benign query per ministry. Candidate labels are discovery evidence only; a news item containing the word “mission” does not establish organizational responsibilities. No personal data, service form, account or authentication step is submitted. Search results are reviewed for relevance before scoring.

Responses titled “Web Page Blocked” are excluded as access restrictions. Their underlying cause or location is not attributed to the ministry without evidence, and the client-address text is never published. A blocked search or language request is not a measured functional failure. Actual application-error responses are distinguished from these block pages and from collector-rejected analytics requests.

Retained 320/390 px screenshots and the recorded 320/390/844 px dimensions are also reviewed for content and layout, not just absence of horizontal overflow. Narrow text columns and diagrams requiring additional enlargement are distinguished from blocking failures. These layout awards do not imply complete WCAG conformity or completed service delivery.

## Separate Foreign Affairs timing follow-up

The 26 October follow-up retains four valid Lighthouse 13.5.0 runs under Chrome 156.0.8078.47: three mobile homepage runs and one desktop homepage run. Collection stopped when a third-party Twitter timeline returned HTTP 429; the remaining fourteen runs were not attempted. These observations appear in a separate table, with their actual browser version, date, counts, medians and ranges. They are not mixed with the original Chrome 153 sample, and do not resolve the six performance criteria. The publisher and recalculation both validate the successful main document and declared browser configuration directly from the retained raw Lighthouse files. The original local runner failure is retained privately and is not counted as a ministry failure.

## Still incomplete

No short collection can supply missing 28-day history. TLS/cipher enumeration, adequate request/privacy inventories, complete service-process and error/recovery tests, inaccessible routes, remaining manual criteria and independent review retain explicit unmeasured budgets where their evidence is insufficient. These gaps must not be relabelled “not applicable” to make the publication appear complete. All results remain provisional.

## 28 October: independent directory verification

The Republic of Türkiye Ministry of Trade's May 2026 Algeria investment profile provides an independent government directory of ministry links on pages 21–22. Both complete pages were visually reviewed and their embedded PDF link targets inspected using Poppler and pypdf. Eight links match the sampled ministry domains (normalizing only apex/www variants). The Religious Affairs hyperlink points to marw.gov.dz even though its adjacent printed address uses marw.dz; the actual hyperlink was checked explicitly. Distinct legacy domains for Communication, Vocational Training and Public Works are not assumed equivalent; constrained redirect checks do not receive awards. The foreign government directory supports the frozen domain-association criterion, not legal registration, current availability, Algerian-government certification or every entry's accuracy. Retained ministry content and trust-verified observations remain the target-site evidence. Original ownership observations are preserved privately. Source: [official government publication](https://ticaret.gov.tr/data/63dcb13313b87627bc2a1d36/Cezayir%20Yat%C4%B1r%C4%B1m%20%C3%9Clke%20Profili%2011.05.2026.pdf).

The same review confirms localized missing field labels on Labour's sampled complaint form, corroborating DOM field records against the specific automated findings. This does not establish tested error handling or service delivery.

## 28 October: fresh mobile form review

Sixteen previously observed form routes were declared before navigation, using the existing representative page captures as the URL source. A normal-concurrency Chrome 156.0.8078.47 pass retained full-page screenshots and visible field dimensions/types at 320/390/844 CSS widths, plus actual Tab records. All requests remain GET/HEAD with normal TLS trust, robots enforcement and rate-limit stops. No data, file, CAPTCHA answer, login, survey vote or service submission was supplied. Main documents must be representative before an award is considered.

Fifteen sampled initial form interfaces were manually reviewed against the images and geometry. The Interior contact page now shows no corresponding form in these captures; its mobile-forms criterion remains unmeasured rather than receiving a no-form pass. Full credit is limited to readable, fitting sampled initial interfaces; clipped fields, cramped layouts and inappropriate input modes receive partial credit where directly verified. Fields fitting a viewport do not resolve the separate touch-target, keyboard/menu, error-recovery, complete-process or physical-device criteria. Page overflow beyond the form remains visible in the source records and is not erased by a form-specific award.

## 28 October: separate Foreign Affairs full-sample retry

Two days after the earlier rate-limit stop, the evaluator declared another full 18-attempt campaign against the same three original core URLs and both device profiles. Fresh trusted-TLS HTTP preflight and robots checks preceded sequential fresh-process Lighthouse runs. No other browser collection or UI testing overlaps the timing campaign. The previous main sample and 26 October stopped follow-up remain intact. There is no third-party filtering, authentication, form operation, favourable-run selection or changed threshold.

Only an entirely valid three-run set for every declared page/device pair can replace the main timing sample and resolve its performance criteria. A complete replacement records its own date, browser version, profiles, original-source history and artifact hashes; the separate auditor recomputes those medians, ranges and score rules from that campaign's raw files. An incomplete retry instead remains a separate unscored observation set. Old and new campaigns are never pooled into a three-run result. Neither outcome supplies the missing long-term reliability, complete-service or independent-review evidence.

The same-day Defence robots refresh returned HTTP 200 and still explicitly excludes the sampled site's CSS and JavaScript directories. No excluded resource was fetched and no stylesheet-free timing was scored. Its remaining performance gap is a currently verified collection constraint, not inferred from the earlier Chrome/TLS errors and not classified as website downtime.

## 28 October: structural and bounded-link review

A fixed manifest covers the original page sample for all 32 entries. Three normal-browser workers collect one page per ministry at a time; no timing campaign runs concurrently. Fresh DOM and Chrome accessibility-tree observations supplement the retained captures. GET/HEAD, public-address validation, normal TLS, robots policy and rate-limit stops remain enforced. No field values, submitted transactions, authentication or CAPTCHA interactions are collected. An explicit Defence resource-policy restriction prevents a new representative browser collection.

Failed robots retrieval is an access/collection constraint, not proof of an intentional site exclusion. Nonrepresentative documents, local CDP timeouts and constrained captures do not become ministry failures or passing absence claims. Fresh and retained evidence retain their separate dates. Manual decisions distinguish a canonical HTTP signal from an actual transport downgrade; percent-encoding case and stable query-ID URLs are not treated as defects by themselves. Missing canonical tags alone do not establish broken canonicalization.

A bounded internal-link decision names its three declared core destinations and requires observed cross-page anchors and representative successful destination captures. It does not certify every link, a downstream service or present-day availability. Semantic review compares actual headings, landmarks and the exposed accessibility tree; missing main landmarks or heading-level skips alone are not called automatic WCAG failures. The ARIA review distinguishes description references from unmounted closed-popup targets.

Primary interpretation references: [W3C ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/), [W3C landmark guidance](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/), and [W3C language declaration guidance](https://www.w3.org/International/questions/qa-html-language-declarations). These references guide interpretation; they do not supply or replace target-site observations.
