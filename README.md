# ADAM website

The mainnet ADAM site is implemented in `web/`; the production static export is in `dist/`. It includes NFT claims, staking, rewards, keeper actions, live statistics, the authorized relayer workspace and, since the 2026-10-09 redesign, a video hero and a Watch section built from the official X account's videos. No contract source or deployment was changed. Nothing was broadcast onchain.

The redesign is design-only: every contract call, address, statistic and section of the previous site is still present and uses the same `config.ts`, ABIs, RPC fallbacks and wallet flow. The site is dark-only now (the previous light theme and its toggle were removed to match the requested cinematic direction). The design system is documented in [DESIGN.md](DESIGN.md); the review and validation record is in [docs/website/VALIDATION.md](docs/website/VALIDATION.md).

## Install, preview and rebuild

Node 22+ and npm are sufficient. The frontend has its own manifest and lockfile (`web/package.json`, `web/package-lock.json`); the existing Foundry configuration and dependencies are untouched.

```sh
npm ci --prefix web
npm run typecheck --prefix web
npm run test --prefix web
npm run build --prefix web
npm run preview --prefix web
```

Open the Vite preview URL printed by the last command. To preview the exact export at a gateway-like subpath, run `python3 -m http.server 8080` in the repository root and open `http://localhost:8080/dist/index.html`. The page uses section hashes and Vite `base: './'`, so every asset URL is relative and no server-side routing is needed. Fonts, images and videos are bundled locally; only live RPC and market/oracle requests need the network.

`npm run build` writes `dist/` (it empties the directory first). Commit `dist/` together with the source after every rebuild: the publisher serves the committed export and does not rebuild.

## Videos

The three videos come from the official X posts and are hosted with the site (no X embed):

| File | Source post | Use |
| --- | --- | --- |
| `web/public/video/hero.*` | https://x.com/IaMaDamIMD/status/2107887948394049999 | Hero background: autoplay, muted, loop, playsinline, dark gradient overlay, visible pause control |
| `web/public/video/rise.*` | https://x.com/IaMaDamIMD/status/2107469324206170244 | Watch card "RISE" |
| `web/public/video/staked.*` | https://x.com/IaMaDamIMD/status/2107360470965670193 | Watch card "Staked and paid" |

Each original MP4 URL was taken from the public `api.fxtwitter.com/IaMaDamIMD/status/<id>` JSON (highest-bitrate `video/mp4` variant, no login) and downloaded with `curl`. Originals: hero 1280×720 15.0 s, rise 718×1280 14.2 s, staked 720×1280 13.1 s, each about 3 MB. They were re-encoded with ffmpeg for the web and the 8 MiB submission budget: two-pass H.264 (`libx264`, high profile, yuv420p, faststart) and two-pass VP9 (`libvpx-vp9`, Opus audio); the hero has no audio track because it only ever plays muted. The poster is the first frame as JPEG (`hero.jpg` 960×540 plus `hero-480.jpg` for compact screens). Output sizes: hero 804 KB mp4 / 619 KB webm, rise 780 KB / 580 KB, staked 718 KB / 521 KB. The recipe (hero at 960×540 420k/330k without audio, cards at 480 px wide 360k/270k with audio):

```sh
ffmpeg -i in.mp4 -vf scale=960:540 -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -b:v 420k -maxrate 630k -bufsize 1260k -g 60 -pass 1 -an -f mp4 /dev/null
ffmpeg -i in.mp4 -vf scale=960:540 -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -b:v 420k -maxrate 630k -bufsize 1260k -g 60 -pass 2 -an -movflags +faststart hero.mp4
ffmpeg -i in.mp4 -vf scale=960:540 -c:v libvpx-vp9 -b:v 330k -row-mt 1 -deadline good -cpu-used 1 -g 60 -pass 1 -an -f webm /dev/null
ffmpeg -i in.mp4 -vf scale=960:540 -c:v libvpx-vp9 -b:v 330k -row-mt 1 -deadline good -cpu-used 1 -g 60 -pass 2 -an hero.webm
ffmpeg -i in.mp4 -frames:v 1 -vf scale=960:540 -q:v 5 hero.jpg
```

On screens up to 767 px wide and whenever `prefers-reduced-motion: reduce` is set, the hero shows its poster instead of autoplaying, and Watch cards never start on hover; they still play from their explicit play button. Watch videos use `preload="none"`.

## Mainnet and verified interfaces

[`web/src/config.ts`](web/src/config.ts) is the single application address/configuration file, including the exact hooked PoolKey, pool ID, LP NFT, relayer, reward tokens, NFT ranges and public RPC fallbacks. The assignment's mainnet addresses override the old pinned Sepolia inputs. Those old records are not loaded at runtime.

All eleven ABI files were downloaded from verified Sourcify chain-1 contracts, including the actual deployed oracle. [`provenance.json`](web/src/abi/provenance.json) records URLs, verification matches and SHA-256 hashes. The redesign did not change any ABI file.

```sh
node web/scripts/verify-abis.mjs
# Optional comparison against Sourcify's live responses:
node web/scripts/verify-abis.mjs --online
# Read-only live mainnet check; optionally supply an oracle request UUID:
cd web
npx tsx scripts/read-check.ts
```

The site has no API keys, private keys, privileged backend or swap widget. Wallet connection uses the injected EIP-1193 provider; WalletConnect is not configured. Transactions require chain 1, recheck the selected account, simulate first, request the visitor's signature and wait for a receipt. Exact approvals precede staking when needed. Errors, rejections, pending receipts, replacements and explorer links remain visible until dismissed. viem and the mainnet chain definition are loaded as a lazy chunk from `api.ts` so the first paint does not wait for them; the client and all read/write paths are otherwise unchanged.

## Interactions and data definitions

- **Trading:** Uniswap is an external link (hero "Buy", footer). It may choose another route, so the page asks visitors to verify the official hooked pool. The contract table and footer expose the full PoolKey and addresses.
- **Statistics:** ETH spot price comes from StateView's pool square-root price. USD price and USD liquidity come from DexScreener's exact mainnet pool, with market cap calculated as USD price × fixed 1B supply. Failed market requests show unavailable values. Mainnet reads are timestamped and refresh every minute; stale snapshots are labeled. Stat cards count up from zero the first time they scroll into view and then follow live values directly.
- **Cumulative totals:** an explicit Load cumulative totals action scans every FeeTaken event from verified hook deployment block 26,128,644 through the displayed block, and all 3,178 NFT `claimed` mappings at one block. Incomplete requests never publish partial totals. Larger histories may exceed public-RPC limits; retry rather than treating partial totals as complete.
- **NFTs:** all eligible IDs are checked with `ownerOf` through Multicall3 in 80-ID chunks, pinned to one block. Selected NFTs are batched in groups of up to 40 per collection, each requiring its own wallet confirmation. Claim & Stake warns that the whole principal lock resets for 24 hours.
- **Staking:** stake, unstake and exit use the deployed distributor. Principal controls follow `unlockTime`; rewards remain claimable while locked. IMD and PNKSTR have independent claim buttons; direct IMDSTR rewards appear when `directDistribution` is enabled.
- **IMDSTR quote:** `eth_call` simulates `claimIMDSTR` for the connected wallet. User slippage is 0.1–10%; quotes expire after 60 seconds and reset on input/account/balance changes. Execution has a 10-minute deadline and is simulated again with the real minimum.
- **Keepers:** process simulates current cooldown/work; claimKeeper always targets the connected wallet.
- **Relayer:** visible only for the configured address; fetch, preview, validation and submission are unchanged from the previous release.

## Validation results

Commands run on the final source and export, all exit code 0 unless noted:

| Check | Result |
| --- | --- |
| `npm run typecheck --prefix web` | Passed |
| `npm run test --prefix web` | 8 tests passed |
| `npm run build --prefix web` | Passed; main chunk 333 kB (84.5 kB gzip), viem chunks loaded lazily |
| `node web/scripts/interaction-check.mjs` (Playwright + Chromium, mocked wallet/RPC) | 16 checks passed: connect, chain switch, keyboard stake with exact approval, unstake, exit, IMD/PNKSTR claims, IMDSTR quote and claim, keeper process and bounty, full 3,178-ID NFT scan, Claim & Stake and claim batches, lock enforcement, wallet rejection, relayer gate/submit, no uncaught errors; 14 simulated writes, zero broadcasts |
| `node web/scripts/browser-check.mjs` (Playwright + Chromium, live read-only RPC) | 21 checks passed: live snapshot, font, hero autoplay attributes and pause control, no overflow at 1440/900/390/320, poster on compact and reduced-motion, mobile menu, Watch hover play, sound toggle, keyboard play/pause, counted stat cards, hash navigation under `/preview/`, missing-wallet message, footer copy and six Etherscan links, sampled contrast ≥ 4.5:1, no uncaught errors. The optional cumulative-totals load did not finish within 150 s on the public RPCs during the run (recorded, feature unchanged). |
| Lighthouse 12 mobile (emulated Moto G, slow 4G) on `dist/` | Final export: Performance 95, Accessibility 100, Best practices 100 with the local server sending gzip for HTML/JS/CSS (92–95 across runs); Performance 83 with text compression disabled (72–83 across runs, FCP 2.9 s, LCP 3.6 s). The hosting gateway should serve compressed text to keep the 85+ target with margin; the export is identical in both runs. Summary in `docs/website/lighthouse-mobile.json`. |

Screenshots of the final export are in `docs/website/` (`desktop.jpg`, `mobile.jpg`, `watch.jpg`, `keyboard-focus.jpg`) with machine-readable results in `browser-validation.json` and `interaction-validation.json`. No physical-device, screen-reader, Safari/Firefox or hardware-wallet session was performed; see [VALIDATION.md](docs/website/VALIDATION.md) for the six-domain review, findings and limitations.

The browser runners start and stop their own local static server (serving `dist/` under `/preview/`). They accept a Playwright module and a Chromium executable installed outside this repository:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs \
CHROMIUM_EXECUTABLE=/absolute/path/to/chromium \
node web/scripts/interaction-check.mjs

PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs \
CHROMIUM_EXECUTABLE=/absolute/path/to/chromium \
node web/scripts/browser-check.mjs
```

## Publish

The committed `dist/` directory is the site. The IdentityMD publisher uploads it as the next version of `adam.site.identitymd.eth` / adam.sites.imd.fun; it does not rebuild, so rebuild and commit `dist/` after any source change. Any static host or IPFS gateway that serves the directory works because every URL is relative; serve HTML, JS and CSS with gzip or brotli for the best mobile performance.

To publish the same export to IPFS yourself, add the directory with Kubo (`ipfs add -r --cid-version 1 dist`) and pin the resulting CID, or run the optional packaging script with its tools installed in a temporary directory outside the submission:

```sh
npm install --prefix /tmp/adam-ipfs-tools ipfs-unixfs-importer@16.1.4 @ipld/car@5.4.2 ipfs-unixfs-exporter@15.0.4
IPFS_TOOLS_DIR=/tmp/adam-ipfs-tools node web/scripts/package-ipfs.mjs
```

It writes `docs/website/ipfs.json` and `docs/website/adam-site.car`; those generated artifacts are not committed (the previous release's CAR was removed as stale packaging). Computing a CID does not establish hosting; keep a node online or use a pinning provider.

## Prior contract work

The previous README is preserved verbatim in [contract history](docs/CONTRACT_HISTORY.md). It describes historical Sepolia deployments and repository-head contract interfaces; it is not the address or ABI source for this mainnet site. No deployment commands from that history were run for this job.
