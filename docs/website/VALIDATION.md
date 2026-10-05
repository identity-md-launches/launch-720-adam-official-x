# Website validation and Better Interface review

## Scope and authority

Reviewed the delivered React/TypeScript/Vite/viem site, all requested sections, light/dark themes, injected-wallet flows and the production `dist/` export. Applied the pinned Better Interface workflow and all six domain core sections during implementation. Mainnet addresses and verified interfaces from the assignment override the historical Sepolia inputs. No Solidity, existing build configuration, dependency mirror, environment file or Git metadata was edited.

**Outcome: website implemented and locally checked; overall assignment incomplete only for persistent IPFS hosting.** The CID and complete CAR are prepared and verified, but no publisher connector, persistent node or credentials were available. There is no claim that the public gateway URL currently resolves. The website itself and the archive are useful deliverables independent of that remaining hosting step.

## Commands and results

All listed final commands returned exit code 0 unless specifically marked unavailable.

| Check | Actual result |
| --- | --- |
| `npm ci --prefix web --offline --cache /tmp/adam-npm-cache --no-audit --no-fund` | 37 packages installed entirely from the populated cache |
| `npm run typecheck --prefix web` | Passed, including the final transaction replacement fix |
| `npm run test --prefix web` | 8 tests passed: all rank permutations, exact amounts, slippage, unlock boundaries, real API shape, malformed reports, exact pool ID and verified write payloads |
| `npm run build --prefix web --offline` | Passed after final source change; all chunks below 500 kB |
| `node web/scripts/verify-abis.mjs` and `--online` | All 11 ABI hashes match; all 11 current Sourcify responses also match |
| `web/scripts/read-check.ts` / equivalent initial scratch recipes | Mainnet state, exact pool price, LP owner, oracle relayer, fee history and market endpoint read successfully |
| Real attestation simulation | API request `4dd47615-7358-4dd5-aee8-c56225fc6cce` decoded to 213 → 30/50/20; deployed `submit(a, signature)` returned true under `eth_call` as the configured relayer |
| `node web/scripts/browser-check.mjs` with installed Playwright/Chromium | Production export at `/preview/`; no page overflow at 1440×1000, 820×1000, 390×1000 or 320×1000; no uncaught app errors or failed resources in final run |
| `node web/scripts/interaction-check.mjs` with installed Playwright/Chromium | Mock wallet/RPC tests pass; 14 simulated write payloads, zero broadcasts; full 3,178-ID ownership range checked |
| `IPFS_TOOLS_DIR=test/scratch/ipfs node web/scripts/package-ipfs.mjs` | CAR root and all block digests verified; every export file re-imported and byte-compared |
| Built-in browser connector | Unavailable: `Transport closed`; installed Chromium runner used instead |
| Kubo distribution endpoint | Connection timeout; no persistent publishing service supplied |

The browser runner uses `/opt/imd-tools/playwright-mcp/node_modules/playwright-core/index.mjs` and `/opt/imd-tools/ms-playwright/chromium_headless_shell-1246/chrome-headless-shell-linux64/chrome-headless-shell`. It starts and stops its own foreground static server. Live external reads were forwarded through Node's environment proxy. The mock-wallet runner intercepts every RPC and wallet request; its write hashes are fixtures, not transactions.

## Six-domain coverage

| Domain | Coverage | Evidence and limits |
| --- | --- | --- |
| Accessibility | Checked | Native headings/landmarks, skip link, labels, disabled actions, described form errors, 3px focus, status/error text, keyboard stake flow and reduced motion. Browser focus state checked. No screen-reader or physical-device session; no claim of full WCAG compliance. |
| Layout | Checked | Four responsive widths, visible contract addresses, scrolling NFT list/table, mobile stacking and real parent images. No page overflow. Native 200% zoom and localized/RTL variants not verified; English-only product. |
| Writing | Checked | Plain action labels, exact amounts/units, lock-reset warning, explicit stale/unavailable data, recoverable RPC/wallet errors, per-batch signature explanation and no endorsement implication. |
| Typography | Checked | Local Archivo font loaded, heading hierarchy, selectable/wrapping identifiers, 16px inputs, tabular balances and timers. Rendered desktop/mobile screenshots inspected. |
| Colors | Checked | Both themes rendered; representative text/background contrast measured below. No status depends only on color. This sampled check does not certify every hover/focus/background pair. |
| UI | Checked | Empty/disconnected state, scan progress, live stats, wrong-chain switching, invalid form input, wallet rejection, confirmed transaction feedback, relayer gating and quote expiry controls. No modal exists, so modal focus traps are not applicable. No staged animation exists, so slow-motion animation inspection is not applicable. |

## Findings and fixes

Locations refer to final source files; line numbers identify the containing implementation.

| Severity / domain | Finding and evidence | Fix / recheck |
| --- | --- | --- |
| High / UI | `web/src/wallet.ts:19`: oracle `submit` can return false without reverting. Treating a successful receipt as acceptance would misreport success. Verified deployed source establishes this behavior. | Require true simulation result and a SplitUpdated log. Mock browser false-result test keeps Submit disabled; real report simulation returned true. |
| High / UI | `web/src/App.tsx:25`: asynchronous quotes could outlive edited inputs or an account change. Source review reproduced the ordering risk. | Generation guard drops stale quote results, and input/account/balance changes clear the quote. Claim checks the quoted account and expiry. |
| High / UI | `web/src/App.tsx:31`: a scan started after a multi-transaction sequence could reuse the previous account closure. | Account ref and abort guards discard old-account results; account-change browser test clears NFT rows and hides relayer controls. |
| Medium / writing | `web/src/App.tsx:43`: initial oracle text previously described a fallback before a live response existed. | Loading now says it is awaiting the oracle. Actual fallback and signed values are distinguished. |
| Medium / accessibility | `web/src/App.tsx:27`: custom stake validation did not return focus to the field. | Associate error text and focus the amount field. Keyboard test enters an invalid amount, sees no transaction request, corrects it and stakes via Tab/Enter. |
| Medium / UI | `web/src/wallet.ts:19`: replacement receipt handling could report a canceled or different transaction as the intended action. | Repriced replacements remain trackable; cancellations/different actions stop the batch with a review instruction. Source checked; actual replacement signing not performed. |
| Low / UI | `web/src/App.tsx:50`: completed transaction status previously had only an error-clear control. | Dismiss now clears completed status, error and link. Browser wallet sequences dismiss and continue. |
| Low / delivery | `web/vite.config.ts:2`: initial bundle exceeded Vite's 500 kB chunk warning. | Split EVM and React dependencies; final production build has no chunk-size warning. |

## Rendered contrast samples

Ratios use computed foreground colors and the nearest actual opaque ancestor background. Opaque text panels avoid photo/gradient blending.

| Theme / pair | Ratio |
| --- | ---: |
| Light body `#0B2838` on `#F0F0F0` | 13.40:1 |
| Light hero text `#47616C` on `#F0F0F0` | 5.77:1 |
| Light primary `#FFFFFF` on `#105070` | 8.74:1 |
| Oracle panel `#F0F0F0` on `#105070` | 7.67:1 |
| Light secondary `#47616C` on `#FFFFFF` | 6.57:1 |
| Dark body `#F0F0F0` on `#0D202B` | 14.64:1 |
| Dark hero text `#ABC8D5` on `#0D202B` | 9.50:1 |
| Dark primary `#0B2838` on `#70B0D0` | 6.41:1 |
| Dark secondary `#ABC8D5` on `#142F3E` | 7.94:1 |

All sampled text pairs exceed 4.5:1. Dark ratios were calculated from the browser-captured colors. No ratio is inferred from a screenshot.

## Evidence and limitations

- `desktop.jpg`, `mobile.jpg`, `dark.jpg`: production screenshots. `keyboard-focus.jpg` shows the visible focus ring on the main navigation; external reads were blocked for that focused-state capture only. The mobile full-page capture scrolls to load the locally bundled parent images first.
- `browser-validation.json`: viewports, resources, focus, contrast inputs and live cumulative-block evidence.
- `interaction-validation.json`: successful mocked flows and exact decoded write arguments.
- `live-read-check.txt`, `attestation-check.txt`: real read-only observations, which are historical snapshots rather than current claims.
- `ipfs.json`, `adam-site.car`: content address, every exported file's hash, archive hash and explicit unpinned status.

The screen-reader, hardware-wallet, real-signature, live-receipt, replacement-transaction and physical-device checks remain unperformed. Browser checks use Chromium, not Safari/Firefox; native browser zoom and every gateway's CORS/injected-wallet behavior are unverified. The timestamp countdown uses the visitor's clock; the contract simulation remains authoritative at execution. Public APIs can become unavailable or rate-limit large historical scans. None of these worker results is an independent network certification.

## Submission size

The complete deliverable tree and its gzip tar both fit below the 8,388,608-byte budget; final measured sizes are recorded in `size-check.json`. No node_modules, npm caches, registry mirrors, dependency tarballs or submodules are included. The precise historical Git bundle could not be generated because this checkout has missing promisor objects and Git metadata is read-only; its attempted lazy fetch was rejected by the filesystem. No repository Git metadata changed. The worker-side byte check covers the entire submitted file tree, including preserved contract dependencies and the IPFS CAR.
