# ADAM website

The mainnet ADAM site is implemented in `web/`; the production static export is in `dist/`. It includes NFT claims, staking, rewards, keeper actions, live statistics and the authorized relayer workspace. No contract source or deployment was changed. Nothing was broadcast onchain.

**IPFS status: prepared, not hosted.** The deterministic directory CID is `bafybeihbhzlu3zx6s65nnqseitmd5d6fjsuqdyygv6dhwxdxjcrepdgoqe`. The upload-ready [CAR archive](docs/website/adam-site.car) contains the entire site. No publisher connector, persistent IPFS node or pinning credentials were provided. The expected gateway URL is https://ipfs.io/ipfs/bafybeihbhzlu3zx6s65nnqseitmd5d6fjsuqdyygv6dhwxdxjcrepdgoqe/; it is **not claimed to be reachable** until the archive is pinned. See [IPFS manifest](docs/website/ipfs.json) for file hashes and publishing status.

## Install, preview and rebuild

Node 22 and npm are sufficient. The frontend has its own manifest and lockfile; the existing Foundry configuration and dependencies are untouched.

```sh
npm ci --prefix web
npm run typecheck --prefix web
npm run test --prefix web
npm run build --prefix web
npm run preview --prefix web
```

Open the Vite preview URL printed by the last command. To preview the exact export at a gateway-like subpath, run `python3 -m http.server 8080` in the repository root and open `http://localhost:8080/dist/index.html`. The page uses section hashes and Vite `base: './'`. It needs no server-side routing. All six requested profile images and the display font are bundled locally. Only live RPC and market/oracle requests need the network.

With a populated npm cache, `npm ci --prefix web --offline` and `npm run build --prefix web --offline` work without network access; both were run successfully using the worker's cache. A fresh machine needs network access for its initial dependency installation. No npm registry, cache or dependency archive is shipped.

## Mainnet and verified interfaces

[`web/src/config.ts`](web/src/config.ts) is the single application address/configuration file, including the exact hooked PoolKey, pool ID, LP NFT, relayer, reward tokens, NFT ranges and public RPC fallbacks. The assignment's mainnet addresses override the old pinned Sepolia inputs. Those old records are not loaded at runtime.

All eleven ABI files were downloaded from verified Sourcify chain-1 contracts, including the actual deployed oracle. [`provenance.json`](web/src/abi/provenance.json) records URLs, verification matches and SHA-256 hashes. The standard ERC-20 getters for reward tokens reuse the verified ADAM ERC-20 interface. No ABI was derived from repository Solidity. Uniswap mainnet PositionManager and StateView addresses were checked against the [official deployment list](https://developers.uniswap.org/docs/protocols/v4/deployments).

```sh
node web/scripts/verify-abis.mjs
# Optional comparison against Sourcify's live responses:
node web/scripts/verify-abis.mjs --online
# Read-only live mainnet check; optionally supply an oracle request UUID:
cd web
npx tsx scripts/read-check.ts
```

`NODE_USE_ENV_PROXY=1` was used for network checks on this worker. The site has no API keys, private keys, privileged backend or swap widget. Wallet connection uses the injected EIP-1193 provider; WalletConnect is not configured. Transactions require chain 1, recheck the selected account, simulate first, request the visitor's signature and wait for a receipt. Exact approvals precede staking when needed. Errors, rejections, pending receipts, replacements and explorer links remain visible until dismissed. Real hardware-wallet signing and real transaction settlement were not exercised.

## Interactions and data definitions

- **Trading:** Uniswap is an external link. It may choose another route, so the page asks visitors to verify the official hooked pool. The contract table exposes the full PoolKey and addresses.
- **Statistics:** ETH spot price comes from StateView's pool square-root price (both currencies have 18 decimals). USD price and USD liquidity come from DexScreener's exact mainnet pool, with market cap calculated as USD price × fixed 1B supply. Failed market requests show unavailable values. Mainnet reads are timestamped and refresh every minute; stale snapshots are labeled.
- **Cumulative totals:** an explicit Load cumulative totals action scans every FeeTaken event from verified hook deployment block 26,128,644 through the displayed block, and all 3,178 NFT `claimed` mappings at one block. Incomplete requests never publish partial totals. Hook fees exclude unsolicited ETH donations. Larger histories may encounter public-RPC limits; retry rather than treating partial totals as complete. Rewards use `totalDistributed` and fetched token decimals. IMDSTR tokens and ETH budgets are displayed separately.
- **NFTs:** all eligible IDs are checked with `ownerOf` through Multicall3 in 80-ID chunks, pinned to one block. Transport failures fail the scan; reverted ownerOf calls mean absent/burned IDs. Cancellation and account changes discard incomplete results. Share, prior claimed and claimable amounts are read from NFTClaim. Selected NFTs are batched in groups of up to 40 per collection, each requiring its own wallet confirmation. A partial sequence can be resumed after rescanning. Claim & Stake explicitly warns that the whole principal lock resets for 24 hours. The claim deadline and next daily unlock come from the deployed contract.
- **Staking:** stake, unstake and exit use the deployed distributor. Principal controls follow `unlockTime`; rewards remain claimable while locked. IMD and PNKSTR have independent claim buttons. Direct IMDSTR rewards are shown when `directDistribution` is enabled; legacy ETH budget remains claimable too.
- **IMDSTR quote:** `eth_call` simulates `claimIMDSTR` for the connected wallet with a positive test minimum. The result includes the actual distributor/pool path. User slippage is 0.1–10%, parsed in integer basis points; quotes expire after 60 seconds and reset on input/account/balance changes. Execution has a 10-minute deadline and is simulated again with the real minimum. Quote failure never enables an unprotected claim.
- **Keepers:** process simulates current cooldown/work; claimKeeper always targets the connected wallet. Bounty is 0.5% of newly processed ETH, followed by the 90/10 staker/team split.
- **Relayer:** visible only for the configured address. The API's `message` fields map to the deployed Attestation tuple, `uint256` maps to answerType 3, and the answer decodes as one of six rank codes. Preview includes weights, window, panel agreement and validity. The contract simulation verifies the actual signing domain/signature/replay rules. `submit(a, signature)` is checked both for a true simulation result and a SplitUpdated receipt event. A successful receipt alone does not prove report acceptance. The exact daily question has a copy control.

## Validation results

Production build and TypeScript checks passed. Eight logic/ABI tests passed. Chromium checked the production export under `/preview/`, with real read-only RPC/API responses, at 1440, 820, 390 and 320 CSS pixels: no page overflow, uncaught application errors or failed resources in the final run. Theme persistence, font loading, hash navigation, copy feedback, full cumulative reads and reduced motion passed. Separate mocked-wallet browser tests passed staking, withdrawal, rewards, quotes, both NFT claim paths, keeper flows, wrong-chain switching, rejection handling and relayer authorization/submission. The keyboard stake flow was also exercised.

The built-in browser connector failed with `Transport closed`; the installed Chromium/Playwright runner supplied the rendered checks instead. The live browser harness forwards public HTTPS requests through Node's configured proxy; it does not prove every gateway's CORS or wallet-injection behavior. No physical-device, screen-reader or native 200% zoom session was performed. See [six-domain review and evidence](docs/website/VALIDATION.md), [design system](DESIGN.md), and the machine-readable browser results alongside the screenshots.

The optional browser runners start and stop their own local static server. They accept a Playwright module and Chromium executable installed outside this repository:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs \
CHROMIUM_EXECUTABLE=/absolute/path/to/chromium \
node web/scripts/interaction-check.mjs

PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs \
CHROMIUM_EXECUTABLE=/absolute/path/to/chromium \
node web/scripts/browser-check.mjs
```

## Publish to IPFS

Import the delivered CAR into an operator's persistent Kubo node. These commands upload only static files and do not interact with Ethereum:

```sh
ipfs dag import --pin-roots=true docs/website/adam-site.car
ipfs pin ls bafybeihbhzlu3zx6s65nnqseitmd5d6fjsuqdyygv6dhwxdxjcrepdgoqe
ipfs cat /ipfs/bafybeihbhzlu3zx6s65nnqseitmd5d6fjsuqdyygv6dhwxdxjcrepdgoqe/index.html
```

Keep that node online or upload the CAR to the operator's chosen pinning provider. Then verify `index.html`, JS, CSS, fonts and images through a public gateway at the CID URL above, including a reload with `#stake`. No pinning credential belongs in the frontend or repository. The CID identifies bytes; computing it does not establish hosting.

To regenerate the CAR after rebuilding, install these optional tools in a temporary directory, outside the submission:

```sh
npm install --prefix /tmp/adam-ipfs-tools ipfs-unixfs-importer@16.1.4 @ipld/car@5.4.2 ipfs-unixfs-exporter@15.0.4
IPFS_TOOLS_DIR=/tmp/adam-ipfs-tools node web/scripts/package-ipfs.mjs
```

The packaging script verifies every block hash and re-imports every file to compare its bytes with `dist/`. It rewrites `docs/website/ipfs.json` and `adam-site.car`; a changed export has a changed CID. Update this README's CID when doing so.

## Prior contract work

The previous README is preserved verbatim in [contract history](docs/CONTRACT_HISTORY.md). It describes historical Sepolia deployments and repository-head contract interfaces; it is not the address or ABI source for this mainnet site. No deployment commands from that history were run for this job.
