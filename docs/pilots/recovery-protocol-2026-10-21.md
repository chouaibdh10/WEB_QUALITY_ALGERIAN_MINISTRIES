# Recovery collection 1.4 — 21 October 2026

This separate campaign preserves the first 23 published reports and their evidence. It corrects collection limitations, not scoring thresholds. The existing [Pilot 1.3 award rules](additional-protocol-v1.md) and all 57 criterion budgets remain in force. A recovered sample is provisional and does not complete the 28-day reliability or independent review requirements.

## Robots parsing

The previous collector rejected HTML content types and any unrecognized line. RFC 9309 section 2.3.1.5 requires crawlers to attempt line parsing and use parseable rules; Google's documented implementation also extracts rules from HTML responses. For this campaign only, the explicitly selected `rfc9309-recovery` mode retains recognizable User-agent, Allow, Disallow, Crawl-delay, Sitemap and Host directives and ignores unrelated lines. Recognizable malformed rules still stop collection conservatively. Actual exclusions, pacing, 401/403 denial, network/5xx failure and 429/503 stops remain enforced. Non-plain-text content is recorded as a format warning, with ignored/retained line counts and a body hash; the original response is retained privately. An HTML fallback is not described as an intentional crawl ban or a website outage.

Sources: https://www.rfc-editor.org/rfc/rfc9309.html#section-2.3.1.5 and https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec#file-format

## Missing certificate intermediates

Five hosts failed Node's default certificate-chain construction with UNABLE_TO_VERIFY_LEAF_SIGNATURE. Public leaf certificates identify Sectigo Public Server Authentication CA DV R36 or DigiCert Global G2 TLS RSA SHA256 2020 CA1 as issuers. The public issuer certificates were retrieved from their CA distribution endpoints and independently verified with OpenSSL against the existing system root store. Each captured host leaf also passed hostname/date/chain verification with those intermediates as untrusted chain-building material. The private verification receipt and certificate hashes preserve this evidence.

Recovery Node processes supply these two intermediate certificates through NODE_EXTRA_CA_CERTS. No new root certificate, self-signed leaf, partial-chain trust, TLS bypass flag or disabled hostname verification is used. Native HTTPS verification remains enabled. This makes the collection environment different from the original default-Node failure: both observations must be disclosed. A certificate score cannot imply that the server supplied a complete chain or that every client can connect. Certificate delivery completeness remains a documented defect/limitation. Chrome is run without certificate-error bypasses.

## Sampling and publication

Select distinct actually observed page URLs before observations/timings. Record normal-browser follow-up before sequential timing runs. Preserve failed attempts rather than replacing them. Missing pages or blocked resources are not zeros. Publish only reviewed aggregates, harmless policy headers, reasons and raw-artifact hashes. Where no dedicated official domain can be verified, retain a reviewed unresolved-domain entry without a score; do not substitute an agency or commercial preview.

Defence resource restrictions are also enforced in the normal-browser follow-up. Because its explicit CSS/JS exclusions prevent representative visitor rendering, timing preflight declines the declared Lighthouse runs and retains N/M reasons. No artificially fast stylesheet-free timing is awarded points. Constrained DOM captures cannot establish absence of accessibility or responsive defects.

Youth: the original HTTP-entry robots preflight returned 503 and correctly stopped that collector before target observations. The original stopped root is retained. After a minimum three-minute cooldown, a separate, predeclared HTTPS-only sample can be collected under the HTTPS origin’s independently retrieved robots policy. This narrows scope: HTTP-to-HTTPS enforcement remains N/M. It is not a replacement of failed timing attempts.
