# ADAM design system

## Overview

The single-page mainnet site serves ADAM holders, NFT claimants, keepers and the authorized oracle relayer. It uses an ocean palette, oversized display headings, a large surf photograph and plain transaction copy. Editorial sections introduce the token; denser panels group actions and balances. The hero's curved image and circular sticker are specific to the landing section.

The implementation is `web/src/App.tsx` and `web/src/styles.css`. The source has no component library. `config.ts` owns addresses, links and the daily oracle question. Light and dark modes are implemented with one `data-theme` attribute; the initial preference follows the device and an explicit choice is stored locally.

## Colors

Canonical values and semantic aliases are in `styles.css:2–3`.

| Primitive | Value | Implemented role |
| --- | --- | --- |
| Teal | `#105070` | Light-theme action/focus; permanent ocean strip and oracle panel |
| Ocean | `#307090` | Brand palette reference; currently unused primitive |
| Sky | `#70B0D0` | Dark-theme action/focus; decorative accents and split segment |
| Bright blue | `#1090D0` | Third split segment, accompanied by numerical text |
| Foam | `#F0F0F0` | Light page and dark foreground |
| Near-black | `#101010` | Brand palette reference; currently unused primitive |
| Navy | `#0B2838` | Light text, dark action text and secondary dark surface |
| White | `#FFFFFF` | Light panel and light-theme action foreground |
| Mist | `#E6F0F3` | Light secondary surface |
| Sea gray | `#47616C` | Light secondary text |
| Deep / deep surface | `#0D202B` / `#142F3E` | Dark page / panel |
| Ice | `#ABC8D5` | Dark secondary text |
| Light / dark line | `#BDCFD5` / `#385766` | Structural boundaries |

Components use `--bg`, `--surface`, `--surface-soft`, `--text`, `--muted`, `--accent`, `--accent-text`, `--line` and `--focus` for themed roles. Permanent brand illustrations use the fixed brand primitives. Status is written in text, not encoded solely by color. The hero sticker and caption have opaque backgrounds so text does not depend on the underlying photo.

Measured rendered text contrast is recorded in `docs/website/browser-validation.json` and `VALIDATION.md`. Representative light pairs range from 5.77:1 to 13.40:1; dark pairs from 6.41:1 to 14.64:1. This is a sample, not a full accessibility certification.

## Typography

`--display` is locally bundled Archivo Black at its real 400 weight, followed by Arial Black and sans-serif. The WOFF2 and OFL license are in `web/public/fonts/`. `--body` uses Arial, Helvetica and sans-serif. Monospace is reserved for addresses and IDs.

- Body: 16px / 1.6 globally; explanatory panels use 13–15px / 1.6. Long paragraphs cap at 70ch.
- H1: fluid 62–102px on desktop; 60–86px on mobile, with the I/M/D characters accented. Its line height is 1.05.
- Section H2: fluid 32–52px, 34px on narrow layouts and 30px at 360px or less. Display headings have negative tracking and balanced wrapping.
- H3: ordinarily 23px, with explicit editorial variants; H4 is 18px. Headings use tight 1.13 line height for short text.
- Eyebrow: 11px, uppercase through CSS, 0.12em tracking; reduced to 9–10px in limited mobile spaces.
- Inputs: at least 16px; stake amount is 25px. Labels remain visible when values are filled.
- Dynamic balances, prices, counters and timers use tabular numerals. Full contract addresses remain selectable and wrap with `overflow-wrap:anywhere`.

## Layout

Content caps at 1600px. Desktop inline margins are 4%, mobile 5%. The declared spacing references are 8, 16, 24, 32, 48 and 80px; section padding is 80px vertically, falling to 55px on mobile. Related controls use a 12px gap. The source also uses component-specific values for compact rows and media.

The hero is two columns. Story allocations and rules pair side by side; live metrics use four columns; oracle, proof, staking and parent sections use two. Breakpoints at 1150, 920, 680 and 360px adjust these structures. At 920px, navigation wraps to its own full-width row and live metrics become two columns. At 680px, the hero and functional panels become one column. At 360px, quote fields stack. The contract table can scroll within its container, and the NFT list has a bounded internal scroll region. Neither creates page overflow at the checked 320, 390, 820 and 1440px widths.

Hash anchors select sections, with `aria-current` in navigation. Content order is the DOM reading order. No drawer or modal hides essential actions. The transaction status panel floats at the lower right, caps at 35vh, scrolls internally and can be dismissed after processing stops.

## Elevation & Depth

Most depth comes from contrasting surfaces and space. Tables, fields and selected/focused elements use structural borders. The transaction status uses a soft shadow and z-index 20; the skip link uses z-index 30. Images carry a subtle 1px black outline in light mode and white outline in dark mode. There is no page-load animation or parallax.

## Shapes

Panels use the 20px `--radius`; primary controls use 9px corners; inputs use 8px. Badges and theme controls are round. The hero has a 120px top-leading corner on wide screens, dropping to 80px; its other corners are 20px or 16px. The mascot avatars and hero sticker are circles.

## Components

The local patterns in `App.tsx` are:

- `External`: links with a visible outward arrow, `target="_blank"` and `rel="noopener noreferrer"`.
- `Heading`: eyebrow, H2 and optional trailing action, wrapping on small screens.
- `Metric`: label, tabular value and optional explanatory note; missing values use an em dash or explicit unavailable label.
- `Copy`: clipboard button with copied feedback and a text-selection fallback.
- `Relayer`: privileged section gated by the connected address, with fetch, preview, validation and submission states. The contract remains the authorization boundary.
- `.panel`, `.split-card`, `.notice`, `.reward-row`, `.nft-row`: common groupings for dense functional content.
- Buttons: one emphasized action per functional group, neutral secondary controls and native disabled states. Controls normally target at least 44px high; compact mobile navigation remains at least 40px high.
- Forms: native labeled inputs and checkboxes. Stake validation associates an error with the input and returns focus to it. Quote errors are described by both relevant inputs. Scan/transaction states are announced in status regions.

Keyboard focus is a 3px solid semantic focus color with a 4px offset; forced-colors mode uses system Highlight. The first link skips to main content. Button press scales to 0.96 only with no reduced-motion preference, using a 150ms transform transition. Theme changes do not animate colors.

## Do's and Don'ts

Start another section with `.section`, `Heading` and the existing panel/grid patterns. Keep essential explanations beside their actions. Use semantic color roles for themed surfaces and controls; use existing fixed brand colors for illustrations. Keep numerical units visible and distinguish IMDSTR tokens from its ETH budget.

Keep wallet operations, account checks and receipts in `useWallet`; put reads in `api.ts` and addresses in `config.ts`. Preserve hash navigation and relative production assets. Do not introduce a router requiring server rewrites, external image hotlinks, hidden action labels, or optimistic transaction-success messages. Any future export change requires a rebuilt static site and a new IPFS CID.
