# Cloudflare deployment

Public frontend:

https://refined-algerian-ministries-web-quality.algerian-ministries-web-quality-index.workers.dev/

The site uses **Cloudflare Workers Static Assets** with a small `worker.js` delivery handler, configured in `wrangler.jsonc`. The handler serves the built HTML bundled with the active Worker using `Cache-Control: no-store`; fingerprinted assets remain cacheable. This prevents an older HTML shell from retaining old JS/CSS references. React profile routes receive the same current HTML; missing files return actual 404 responses. The current Wrangler version routes new Pages creation toward Workers; this deployment is not an existing unrelated Pages project. Its static asset directory is `dist/` and it includes both methodology PDFs.

## Redeploy

```sh
npm ci
npx wrangler whoami
npm run deploy
```

`npm run deploy` builds the Vite frontend and uploads the resulting static assets. Authenticate using `npx wrangler login` if the local session is unavailable. For CI, provision a Cloudflare token/account ID through protected environment secrets; never commit credentials. Local Wrangler state is gitignored.

No measurements, screenshots, private evidence or API keys are deployed. The measurement CLI remains a local tool. Do not move `evidence/` under `public/` or the build directory.

## Display preferences and responsive layout

The header provides light/dark appearance and English, French, and Arabic interface controls. Arabic uses right-to-left layout; website domains stay left-to-right. Localization includes all 34 portfolio names, search/filter states, profiles, methodology content, dates, numbers, and accessibility labels. Search accepts the selected language, original English portfolio names, and candidate domains, ignoring accents and combining marks.

Choices persist locally under `wqi-theme` and `wqi-language`. Without a saved choice, appearance follows the initial system color scheme and language follows the browser's primary language when it is English, French, or Arabic; otherwise it defaults to English. Blocked browser storage does not prevent changing the interface, but choices cannot persist. `/preferences-init.js` runs before React to initialize appearance and document direction without a wrong-theme flash.

French selects the French methodology PDF. English and Arabic select the original English PDF; Arabic labels explicitly identify its document language. An Arabic PDF is not provided or implied.

Maintain preferences in `src/Preferences.jsx` and translations in `src/interfaceMessages.js`, `src/contentMessages.js`, and `src/directoryMessages.js`. The original ministry corpus remains unchanged for the measurement CLI. Responsive styles use content flow and logical spacing rather than a fixed page height; menus are viewport-bounded and independently scrollable, and profile drawers use the dynamic viewport height with a sticky close control.

Typography is self-hosted via `@fontsource-variable` packages (Inter for interface text, Space Grotesk for display headings, Noto Sans Arabic for Arabic) — no external font requests. The motion layer (scroll reveals, hover micro-interactions, hero ambience) is compositor-only (`transform`/`opacity`/`translate`), applied only when JavaScript marks the document, and fully disabled under `prefers-reduced-motion`; without JavaScript the content renders statically visible.

## Project identity

The current identity uses an original angular W symbol with a transparent background. It is built directly from SVG paths and used in the header, footer and favicon. The wordmark is set in Inter; the visual system uses ink-and-paper colors, ruled layouts, restrained corner radii and consistent Inter typography for research metadata. The hero presents the actual seven rubric weights, which are possible points rather than measured ministry results. Its animation is limited to finite content reveals and interaction feedback.

The school logo remains in the explicitly labelled student-project attribution. It is not the project logo and does not imply official government endorsement. Brand files are `/brand/web-quality-mark.svg`, `/brand/web-quality-mark-dark.svg` and `/brand/favicon.svg`.

Design references, applied as original implementation rather than copied branding or product screens:

- [Linear dashboard practices](https://linear.app/now/dashboards-best-practices): a focused workspace, clear status context and less visual noise.
- [Vercel Geist](https://vercel.com/geist/introduction) and [dashboard redesign](https://vercel.com/blog/dashboard-redesign): restrained surfaces, consistent typography, accessible actions and responsive hierarchy.
- [Our World in Data explorers](https://ourworldindata.org/explorers): searchable public-data context with explicit sources and distinctions between observed data and interpretation.

The directory displays ten portfolios per page, searches the complete corpus, resets pagination when search/filter changes, and uses stacked rows on mobile. The dark hero panel describes the measurement workflow; it is not a fabricated live scan or sample score.

## Observed verification

The localized theme/responsive update passed `npm run deploy` (Vite production build plus Cloudflare upload). Deployed version: `127d9aba-6b58-4654-bb28-17e392230663`; production assets include `index-Br6bgPwL.css`, `index-CFxoLEPD.js`, and `preferences-init.js`.

Actual Chromium checks exercised:

- All three languages × both themes × eleven viewports: 320×480, 360×640, 390×844, 430×932, 568×320, 768×1024, 844×320, 1024×768, 1280×720, 1440×900, and 1920×1080. All 66 combinations had no page-level horizontal overflow; collapsed menus remained inside the viewport and their last action was reachable by scrolling.
- The previously reproduced 844×320 menu overflow is fixed. Arabic profile drawers were also checked at 320×320, 568×320, 844×320, and 390×844: no horizontal clipping, sticky close access, and reachable source links.
- Localized/last-page searches, accent-insensitive French search, pagination, unresolved profiles without fabricated host links, empty-state reset, PDF language selection, modal focus containment/Escape/opener restoration, and background scroll/inert restoration.
- Saved choices after reload, French-browser/system-dark defaults, and working controls when browser storage throws a security error.
- axe-core WCAG A/AA-tag checks reported zero violations on the six desktop language/theme surfaces. This automated result is not a complete accessibility audit or certification.

The production site loaded directly in Chromium after deployment. Live checks verified the exact production asset names, French/dark persistence after reload, the scrollable Arabic menu at 844×320, and Arabic search/profile/focus restoration at 320×480. Both methodology PDF endpoints returned HTTP 200 with `application/pdf` and a `%PDF-` signature; the preference bootstrap returned HTTP 200.

Static deployment reference: https://developers.cloudflare.com/workers/static-assets/get-started/

## Deployment verification

`npm run deploy` now runs `npm run verify:deployment` after uploading. The check compares the normal homepage, the previously stale revision URL and a profile URL against the local build, verifies the HTML no-store policy, checks script/style response types and confirms standalone W logo artwork at the new asset URLs. Logo files now use `wqi-mark-v3.svg`, `wqi-mark-dark-v3.svg` and `wqi-favicon-v3.svg`.

The stale-shell correction was deployed as `3027175d-9216-4f36-96b9-86c6d3fcd724`. Live Chromium navigation without cache-bypass headers verified both `/` and `/?revision=72073f61-final`: no language icon, a transparent dark-theme W, Inter secondary text, and the full panel inside the desktop viewport.

## Verified version address

The original workers.dev address continued to return older static HTML intermittently, and a newly created Worker address returned intermittent 1042 routing errors. The `refined` version alias of the original Worker is the verified public review address above. It pins the current uploaded version (`42fed34e-0819-4eda-b3a9-49b4356bac79`) and passed script/style/HTML/logo validation plus live Chromium checks without request cache overrides. Future `npm run deploy` runs also update this alias before checking it. The original Worker remains deployed; the research evidence is unaffected.
