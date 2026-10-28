# Observatory design refresh — 19 October 2026

The public website now uses an original vector globe to represent the national research corpus, a dark emerald visual panel, a larger typographic hierarchy, and category cards with dedicated icons and proportional rubric-weight bars. The bars represent possible category points, never measured ministry scores. The globe is decorative, not a live scan or geographic coverage claim. Its coordinates identify Algiers as geographic context.

The existing English, French and Arabic content, preferences, directory, profile routes and evidence separation are retained. On mobile the illustration follows the main calls to action. Motion uses CSS transforms and opacity; reduced-motion preferences disable animation and transitions. No animation library, external font service or third-party visual asset was added.

## Research and rationale

- [Linear: A calmer interface for a product in motion](https://linear.app/now/behind-the-latest-design-refresh): consistent interface structure and restrained surfaces.
- [Vercel Geist typography](https://vercel.com/geist/typography): distinct heading, body and metadata hierarchy.
- [Stripe: Connect front-end experience](https://stripe.com/blog/connect-front-end-experience): product storytelling through original visual compositions.
- [Nielsen Norman Group: The role of animation and motion in UX](https://www.nngroup.com/articles/animation-purpose-ux/): keep interaction feedback useful and avoid delaying navigation.
- [Nielsen Norman Group: Animation duration](https://www.nngroup.com/articles/animation-duration/): short interaction transitions with deliberate easing.
- [web.dev: High-performance CSS animations](https://web.dev/articles/animations-guide): prefer transform and opacity animations.
- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/get-started/): deploy the built Vite assets to the existing Worker.

These references informed the implementation; no reference branding or layouts were copied.

## Verification and deployment

Production build passed. Chromium checked 24 combinations: English/French/Arabic × light/dark × 320/390/768/1440 px. All had no page-level horizontal overflow and no JavaScript errors. Reduced-motion emulation returned no globe-orbit animation. An additional full-page axe check with all reveal content made visible caught one summary-card contrast issue; this was corrected and the repeated WCAG A/AA-tag scan returned zero violations. This is automated verification, not full accessibility certification.

Cloudflare deployment version: `9dc3d84c-fcb5-4d70-b7c6-143eb57fdd0e`.

## Editorial revision

Following design review, the globe, glowing points, gradients and rounded-card treatment were replaced with a more focused editorial system. The hero now presents the actual seven rubric weights, with a restrained specimen-sheet layout. The custom angular W symbol uses a square lime field and solid ink geometry, with no external visual assets. Typography uses Inter, fine rules and monospaced metadata. Repeating decorative motion and animated counters were removed from the hero; finite scroll reveals and interaction feedback remain. This revision supersedes the globe direction above.

Editorial revision validation: production build and 24 language/theme/viewport checks passed; full-page WCAG A/AA-tag automated scan returned zero violations after revealing all content. Desktop and mobile screenshots were visually inspected. Published Cloudflare version: `d7189bef-76d9-40d2-9e99-4cb64dd2ff05`.

## Hero and identity refinement

The desktop hero now fills the available viewport below the header, with compact panel spacing for heights up to 850 px. Mobile layouts retain natural scrolling. A single Inter font family replaces monospaced secondary text (Arabic retains Noto Sans Arabic). The W logo has a transparent background with dedicated light/dark artwork, including the hero specimen. The language selector retains its accessible label and native select, with the decorative language icon removed. Verified no horizontal overflow in 24 language/theme/width combinations; additional viewport-fit checks at 1536×744, 1920×930, 1440×900 and 1024×768 kept the full panel visible. The full-page accessibility scan after revealing content returned zero WCAG A/AA-tag violations.
