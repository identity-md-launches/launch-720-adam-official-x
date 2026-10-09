# Website validation and Better Interface review — 2026-10-09 redesign

## Scope and assumptions

Reviewed the redesigned React/TypeScript/Vite site in `web/` and its production export `dist/`: sticky header with wallet connect and mobile menu, video hero, ticker, live stats with count-up cards, oracle split, rewards distributed, liquidity proof and cumulative totals, about/rules/contract table, Watch section (two locally hosted X videos), NFT claim, stake/rewards/IMDSTR, keepers, relayer workspace (gated), parents and the footer with X link and contract addresses. Applied the pinned Better Interface workflow and the core principles of all six domains while building; the rendered checks below were made with Playwright-driven Chromium (headless shell 1246) on the final export served under `/preview/`, since the IMD browser launcher preview (`test/scratch/browser/preview.json`) was not present in this session.

Consequential assumptions: the site is dark-only (the brief asks for a dark cinematic look; the previous light theme and toggle were removed and recorded in the changelog); the one accent is ADAM's bandana blue (`#58a6ff`) sampled from the hero video; the hero buttons are "Stake" (section link) and "Buy" (Uniswap, external); videos were re-encoded to fit the 8 MiB submission budget (sizes in README). No Solidity, build configuration, dependency, ABI, address, RPC list, environment file or Git metadata was changed.

**Outcome: Complete for the stated scope**, with the limitations listed at the end.

## Commands and results

All commands below returned exit code 0 on the final source and export unless marked.

| Check | Actual result |
| --- | --- |
| `npm ci --prefix web` | 31 packages from the lockfile; no dependency change |
| `npm run typecheck --prefix web` | Passed |
| `npm run test --prefix web` | 8 tests passed (rank permutations, amounts, slippage, unlock boundaries, attestation mapping, pool ID, write payloads) |
| `npm run build --prefix web` | Passed; `dist/` regenerated after the last source change; main chunk 333 kB (84.5 kB gzip), viem chunks lazy |
| `node web/scripts/interaction-check.mjs` | 16 checks passed, 14 simulated writes (`approve, stake, unstake, exit, claimReward ×2, claimIMDSTR, process, claimKeeper, claimAndStake ×2, claim ×2, submit`), zero broadcasts; see `interaction-validation.json` |
| `node web/scripts/browser-check.mjs` (live read-only RPC/API through the Node proxy) | 21 checks passed, no uncaught errors, no failed resources; see `browser-validation.json`. The optional "Load cumulative totals" scan did not complete within 150 s on the public RPCs in either run (`totalsError` recorded); the previous release completed it, and the code path is unchanged |
| Lighthouse 12.x, mobile preset, on `dist/` via a local static server | gzip text: Performance 95 / Accessibility 100 / Best practices 100 (FCP 1.6 s, LCP 2.2 s, TBT 210 ms, CLS 0). Uncompressed text: Performance 83 (FCP 2.9 s, LCP 3.6 s, TBT 160 ms, CLS 0); earlier runs ranged 72–83. See `lighthouse-mobile.json` |
| Video provenance | fxtwitter JSON for the three post IDs returned the `video.twimg.com` MP4 variants; originals downloaded (SHA-256 below), re-encoded with ffmpeg 7 (`libx264`, `libvpx-vp9`), posters from frame 0 |

Original download hashes: hero `10fa7fb8f5365ddd619a0be723a77736c407663ca77f643005eee52cad2f9eed`, rise `70d167e612fa8187c60341916cc75192e79f04092e845dbb9e2588ddeec63c16`, staked `339ea9ec3ebfdd5e78ddfbc20d2d3574188d112a716965ae1a3edc2e733bd70b`.

## Six-domain coverage

| Domain | Coverage | Evidence and limits |
| --- | --- | --- |
| Accessibility | Checked | Native buttons/links/labels/checkboxes, one `h1`, descending headings, skip link, `main` landmark, `scroll-padding-top` for the sticky header. Icon-only controls carry `aria-label`; external links announce "(opens in a new tab)". Hero autoplay has a visible pause control; Watch cards expose play/pause and sound toggles with `aria-pressed`. Motion is opt-in under `prefers-reduced-motion: no-preference`; reduced-motion run showed posters and no transitions. Keyboard: Tab order and visible 3px focus ring captured (`keyboard-focus.jpg`); mocked keyboard stake flow passes. Not performed: screen-reader session, native 200% zoom, physical device. |
| Layout | Checked | No horizontal overflow at 1440, 900, 390 and 320 px (live data). Media bleeds, controls stay inside margins; mobile menu, stacked grids, wrapping footer contract rows and wrapping split percentages verified after a fix. Not verified: RTL mirror (English-only product), native zoom. |
| Writing | Checked | Verb-first labels unchanged from the previous release ("Approve & Stake", "Claim selected", "Process fees", "Open on X", "Pause background", "Sound off/on"); errors keep their stated fix; sentence case throughout; tagline and section leads are plain. |
| Typography | Checked | Local Archivo Black loaded (`document.fonts.check`), system body stack, descending heading sizes, balanced headings, pretty paragraphs capped at 68ch, tabular numerals on all changing values, inputs ≥ 16px. Rendered desktop/mobile screenshots inspected for wrapping; one wrap defect fixed (Watch card link). |
| Colors | Checked | Single accent ramp plus one danger text color; semantic tokens only in components. Measured rendered pairs (final run): body 18.15:1, muted/lead/nav 8.76:1, primary button 7.51:1, footer code 8.42:1, badge/eyebrow/tagline 18.15:1 against the dark base. Hero text over the video is only verified against the dark gradient base, not every video frame. |
| UI | Checked | Pill buttons with hover/press (0.96) states, panel hover lift, glass header, concentric video-frame radius, one icon set at 2px stroke with `currentColor`, reveal and count-up transitions interruptible and skipped under reduced motion. Observed states: loading, live, stale-data alert, disconnected empty state, missing-wallet error, mocked transaction statuses, rejection, lock. Not performed: 10%-speed animation replay in DevTools. |

## Findings and fixes

| Severity / domain | Finding and evidence | Fix / recheck |
| --- | --- | --- |
| High / accessibility | `web/src/App.tsx` hero: the background wrapper carried `aria-hidden="true"` around the focusable "Pause background" button, hiding a focusable control from assistive tech (browser-check could not find the button by role). | Removed `aria-hidden` from the wrapper; the video keeps `aria-hidden` and the shade is decorative. Recheck: pause/play control found by role and toggles playback. |
| Medium / layout | `web/src/styles.css` `.split-values`: three "33.33%" display-size values could not shrink at 320 px, producing 365 px of page width with live data. | Allowed wrapping with a gap and reduced the compact size to 24px. Recheck: no overflow at 320 px with live data. |
| Medium / performance (UI) | `web/src/api.ts`, `web/src/wallet.ts`, `web/vite.config.ts`: viem and the chain definitions were in the static import graph, so first paint waited for about 590 kB of script (mobile Lighthouse 68–70 uncompressed). | viem now loads through a cached dynamic import; `index.html` ships a static header/hero shell with a preloaded poster (plus a 480 px variant). Recheck: 92–95 with gzip, 72–83 without; all interaction checks still pass. |
| Low / typography | `docs/website/watch.jpg` (first run): "Open on X" wrapped to two lines in the second Watch card at 1440 px. | `.watch-meta .button{white-space:nowrap;flex-shrink:0}`. Recheck: final `watch.jpg`. |
| Low / delivery | `docs/website/adam-site.car`, `ipfs.json`, `dark.jpg`: stale packaging and light-theme evidence from the previous export. | Removed; README documents the publisher flow and the optional packaging script whose outputs are not committed. |

## Evidence and limitations

- `desktop.jpg`, `mobile.jpg` (full page, 390 px), `watch.jpg`, `keyboard-focus.jpg`: final-export screenshots from the Chromium run.
- `browser-validation.json`: checks, hero attributes, metrics text, contrast inputs, focus state, Watch links, totals error.
- `interaction-validation.json`: mocked flows and decoded write arguments (fixtures, not transactions).
- `lighthouse-mobile.json`: category scores and core metrics for both server configurations.
- `live-read-check.txt`, `attestation-check.txt`: historical read-only observations from the previous release, unchanged.

Unperformed: screen-reader, hardware-wallet, real signature/receipt, replacement transaction, physical device, native browser zoom, Safari/Firefox, DevTools animation replay, and the supplied IMD browser launcher (absent in this session; the installed Playwright/Chromium runner was used instead). The cumulative-totals scan is rate-limited by public RPCs and timed out in both validation runs. Mobile Lighthouse above 85 depends on the host serving compressed text; the export cannot force that. None of these worker results is an independent network certification.

## Submission size

Submission bytes are dominated by the six video files (4.0 MB) which Git stores once because `web/public/video/` and `dist/video/` are identical blobs. Estimated Git bundle after this job: existing packed history 2.70 MiB plus about 4.45 MiB of new deflated unique blobs, about 7.15 MiB, below the 8,388,608-byte budget (`size-check.json`). No node_modules, npm caches, registry mirrors, dependency tarballs, CAR archives or submodules are included; `test/scratch/` is ignored and holds the originals, tooling and Lighthouse reports.
