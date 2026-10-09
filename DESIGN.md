# ADAM design system

## Overview

The single-page mainnet site serves ADAM holders, NFT claimants, keepers and the authorized oracle relayer. The 2026-10-09 redesign gives it a dark, cinematic identity: the official "RISE $ADAM RISE" video plays behind a full-bleed hero, one electric blue accent is lifted from ADAM's bandana, headings are set large in Archivo Black, and functional content sits in glassy tonal panels with generous spacing. Content and contract behavior are unchanged from the previous light/dark site; this document describes the implemented dark-only design.

The implementation is `web/src/App.tsx` (page structure and all contract interactions), `web/src/media.tsx` (icons, scroll reveal, count-up numbers, hero and watch videos) and `web/src/styles.css` (tokens and every style rule). `web/index.html` carries a static shell of the header and hero so the first paint does not wait for the application bundle. There is no component library, CSS framework or animation library. `config.ts` owns addresses, links and the daily oracle question.

System-wide rules are the tokens, the panel/button/field patterns and the responsive breakpoints below. The hero video, ticker strip and Watch cards are page-specific arrangements rather than rules for every future page.

## Colors

Canonical values and semantic aliases are in `styles.css:3–11`. Primitives are named by hue; components only use the semantic tier. The notation is hex for opaque primitives and `rgba()` for translucent surfaces and lines.

| Primitive | Value | Semantic role(s) |
| --- | --- | --- |
| `--night-950` | `#070a10` | `--bg` page background; base of `--glass` and `--shade` |
| `--night-900` | `#0b1019` | `--bg-raised` (ticker, footer), `--surface-input`, video letterbox |
| `--night-800` | `#111826` | `--surface-solid` (floating transaction panel, report preview) |
| `--night-200` | `#a3adbf` | `--muted` secondary text, labels, captions |
| `--night-50` | `#f3f5f9` | `--text` primary text; first split-bar segment |
| `--sky-500` | `#58a6ff` | `--accent`: the one filled action per group, eyebrows, status dot, split segment, list markers |
| `--sky-400` | `#7dbbff` | `--accent-hover` |
| `--sky-300` | `#9ccbff` | `--focus` keyboard ring |
| `--sky-900` | `#06111f` | `--accent-text` on accent fills |
| `--coral-300` | `#ff9b8f` | `--danger-text` inline error text (always paired with text, never color alone) |

Translucent roles: `--surface` `rgba(255,255,255,.045)` and `--surface-hover` `.075` for panels and neutral buttons; `--line` `rgba(255,255,255,.1)` and `--line-strong` `.18` for structure; `--accent-soft` `rgba(88,166,255,.14)` for notices and numbered rule badges; `--glass` `rgba(7,10,16,.62)` for the sticky header, hero chips and video tool chips (with `backdrop-filter: blur`). The hero shade is a two-layer gradient from `rgba(7,10,16,.35)` to the page background (`.hero-shade`, `styles.css`), so hero text always sits on a dark base regardless of the video frame. The oracle split card uses an `oklab` accent gradient (`.accent-panel`).

Exactly one filled accent action appears per functional group (`.primary`); peers are neutral outlined buttons. Status is written in text, never encoded only by color. Measured rendered contrast samples are in `docs/website/browser-validation.json` and `docs/website/VALIDATION.md`; the hero text over video is measured against the dark base only.

## Typography

- `--display`: locally bundled Archivo Black (`web/public/fonts/archivo-black-latin.woff2`, OFL, single 400 weight, preloaded in `index.html`), fallbacks Arial Black, Impact, sans-serif. Used for the wordmark, H1, H2, section numbers, metric values, split percentages, allocation figures and the footer brand.
- `--body`: `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` for everything else. `--mono`: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` for addresses, IDs and the pool key.
- Root: 16px / 1.6, antialiased, `::selection` in accent on accent-text.
- H1 wordmark: `clamp(96px, 19vw, 260px)`, letter-spacing −0.06em, line-height 0.9, with a soft shadow for readability over video; 84–180px below 900px and 76px at 360px.
- Section H2: `clamp(34px, 4.2vw, 60px)`, −0.04em, balanced wrapping; 34px below 640px. Section eyebrows are 11px uppercase, 0.14em tracking, accent-colored.
- H3: 22px / 700 in panels; display-face variants of 26–36px in the oracle card and section copy. H4: 17px.
- Tagline: `clamp(18px, 2.2vw, 26px)` / 1.4, max 34ch. Lead paragraphs: 16px muted, max 60ch. Body paragraphs cap at 68ch with `text-wrap: pretty`.
- Metric values: display face `clamp(26px, 2.4vw, 38px)`; all changing values (metrics, counters, timers, balances) use `font-variant-numeric: tabular-nums`.
- Inputs are 16px minimum; the stake amount field is 26px. Captions and helper text are 12–13px at weight 400 or heavier. Addresses wrap with `overflow-wrap: anywhere` and remain selectable.

## Layout

Content caps at 1360px (`.header-inner`, `.section`, footer blocks) with inline padding `clamp(16px, 4vw, 40px)`. The spacing scale is `--space-1…7` = 8, 16, 24, 32, 48, 72, 112px; sections use 112px vertical padding (72px below 900px). Related controls use a 12px gap (`.actions`); groups are separated by 24–48px.

Grids: live metrics 4 columns; oracle/rewards, proof, allocation, Watch, stake, keeper and parents 2 columns; rules 4 columns. Breakpoints come from where content stops fitting: 1100px (metrics and rules to 2 columns), 900px (all two-column grids stack, navigation moves into the menu button, hero shrinks), 640px (compact header at 56px, hero text left-aligned, single-column rules and allocation, footer contract rows wrap), 360px (single-column metrics, smaller wordmark and chips). The contract table scrolls inside `.table-wrap`; the NFT list scrolls inside a 360px region. No page width checked (1440, 900, 390, 320) overflows.

The header is `position: sticky` glass chrome (`--header-h` 64px / 56px) with `scroll-padding-top` on the root so hash targets clear it. Media bleeds to the viewport edges (hero, ticker, footer background); text and controls stay inside the layout margins. Hash anchors select sections with `aria-current` in navigation; DOM order is reading order. The floating transaction panel stays at the lower right, capped at 35vh with internal scrolling.

## Elevation & Depth

Depth comes from tonal layers rather than borders: translucent `--surface` panels on the near-black page, with a 1px `--line` border for structure and `--shadow-card` (an inset highlight plus a soft 50px drop shadow). Floating chrome (transaction panel, network notice) uses `--shadow-float`. The header, hero chips, pause control and video tool chips are glass (`--glass` + `backdrop-filter: blur(10–16px)`); this is reserved for elements over media. The primary button carries an accent-tinted shadow. Images carry a 1px white outline at 10% opacity (`img`), except media inside hero and parent banners. Stacking: skip link 60, wallet state 50, header 40, hero background −1 within its isolated section.

## Shapes

`--radius-lg` 24px for panels, cards and the oracle card; `--radius-md` 16px for metric tiles, rule tiles, the transaction panel and footer contract list; `--radius-sm` 10px for inputs, notices and inline link chips; `--radius-pill` for every button, badge, chip and navigation link. Video frames inside Watch cards use the concentric radius (24px − 12px padding). Avatars, the status dot, rule numbers and the Watch play control are circles.

## Components

All are local patterns in `App.tsx` and `media.tsx`; none is a library export.

- `Icon` (`media.tsx`): one inline SVG set, 2px stroke, `currentColor`, `aria-hidden`. Names: x, copy, check, external, arrow, play, pause, sound, muted, wallet, refresh, bolt, spark, menu, close. `XLogo` is the filled X mark.
- Buttons (`styles.css` `button, .button`): pill, 44px minimum height, neutral outlined by default. Variants: `.primary` (accent fill, one per group), `.glass` (over media), `.ghost` (transparent), `.large` (hero, 54px), `.icon-button` (40px square, needs `aria-label`), `.chip-button` (compact glass chip), `.copy` (text-only inline action). Hover changes background/border; press scales to 0.96 only without reduced motion; native `disabled` at 45% opacity.
- `External` (`App.tsx`): new-tab link with the external icon and a visually hidden "(opens in a new tab)" note.
- `Heading`: eyebrow number, H2, optional lead paragraph and trailing action; stacks below 900px.
- `Metric`: uppercase label, display-face tabular value, optional note. Inside `.metrics` it renders as a tile with hover lift.
- `Count` (`media.tsx`): count-up number that animates from zero the first time it scrolls into view (1.1s cubic ease-out via `requestAnimationFrame`), then follows value changes instantly; skipped under reduced motion. Takes a numeric value and a render function.
- `Copy`: clipboard button with "Copied" feedback for 2.5s and a text-selection fallback; `compact` renders an icon button with the feedback in its accessible name.
- `HeroVideo` (`media.tsx`): autoplay, muted, loop, playsinline background with the poster as fallback, a visible "Pause background" toggle, and the poster image instead of video at ≤767px or under `prefers-reduced-motion`.
- `WatchCard` (`media.tsx`): poster-first card that plays on hover (not under reduced motion) and on tap or via the centered play/pause button (`aria-pressed`), a sound toggle (`aria-pressed`, "Sound off/on"), and an "Open on X" link to the original post. Videos are `preload="none"`.
- Panels: `.panel` (default), `.accent-panel` (oracle split), `.claim-panel`, `.parent` (image card), `.watch-card`. Reveal-on-scroll is opt-in via the `data-reveal` attribute (`useReveal` adds `.is-in`; opacity/translate transition only under `prefers-reduced-motion: no-preference`).
- Forms: native labeled inputs, `aria-invalid` and `aria-describedby` for the stake amount error, native checkboxes in `.nft-row`, `progress` for scans. Error text uses `.alert`; informational callouts use `.notice`; status updates use `role="status"`.
- Header: `.site-header` with brand, desktop nav, wallet button and a menu button (`aria-expanded`, `aria-controls`) that reveals `#mobile-nav` below 900px.
- Footer: `.footer-contracts` list with name, full address, compact copy button and Etherscan icon link per contract; X follow button; link column.

Keyboard focus is a 3px solid `--focus` ring with 3px offset on `:focus-visible`; forced-colors mode uses system Highlight and hides the hero shade. The first focusable element skips to `#main`.

## Do's and Don'ts

- Start a new section with `.section`, `Heading` and `.panel` or `.metrics` tiles; add `data-reveal` to the blocks that should fade in.
- Use `.primary` for exactly one action per group; everything else is the neutral pill.
- Pick colors only from the semantic tokens; add a token rather than borrowing `--line` or `--muted` for a new role. Keep the single accent; do not add a second hue for emphasis.
- Keep display type for headings and headline numbers; body and controls stay on the system stack.
- Put any new video under `web/public/video/` as mp4 + webm + first-frame poster and render it through `WatchCard` or the same poster-first pattern; never embed X or autoplay with sound.
- Keep motion opt-in under `prefers-reduced-motion: no-preference` and pair every animated state with a static cue.
- Keep wallet operations in `useWallet`, reads in `api.ts` and addresses in `config.ts`; preserve hash navigation and relative asset URLs. Do not reintroduce a light theme or a router that needs server rewrites.

Recipe for one more page: copy `index.html`'s head and static shell, render `<header>` and `<footer>` from `App.tsx`, place content in `.section` blocks with `Heading`, reuse `.panel`/`.metrics`/`.rule` tiles and the button variants, and rebuild with `npm run build --prefix web`.
