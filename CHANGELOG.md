# Changelog

## 2026-10-09 — website redesign (design only)

- Redesigned the ADAM site in `web/` with a dark, cinematic look: full-bleed hero over the official "RISE $ADAM RISE" video (muted, looped, inline, with a pause control and poster fallback on compact screens and under reduced motion), one accent blue taken from ADAM's bandana, Archivo Black display type, glassy panels, count-up stat cards, scroll reveals and hover states without any animation library.
- Added a Watch section hosting the two other official X videos locally (mp4 H.264 + webm VP9 + first-frame posters, each well under 8 MB): play on hover or tap, muted by default with a sound toggle, keyboard play/pause and a link to each original post. No X embed.
- Added a sticky compact header with wallet connect and a mobile menu, and a footer with the X link and all six mainnet contract addresses with copy buttons and Etherscan links.
- Kept every existing feature and contract call unchanged: live stats, oracle split, rewards distributed, cumulative totals, NFT scan/claim/claim-and-stake, stake/unstake/exit, IMD/PNKSTR/IMDSTR claims with quotes, keeper actions and the relayer workspace. Addresses, ABIs, RPC fallbacks and wallet flow logic are untouched; viem now loads as a lazy chunk so the first paint does not wait for it.
- Removed the light theme (the brief asks for a dark design) and the stale IPFS CAR/manifest from the previous export; the publisher serves the committed `dist/`. Documentation, validation records and DESIGN.md describe the new source. No contract, build configuration or dependency change; nothing broadcast onchain.

## 2026-10-05 — daily IMD oracle compatibility

- Removed the immutable questionHash pin; the per-run hash remains signed and can change with each pinned block window.
- Added immutable relayer authorization with OnlyRelayer() and configurable EIP-712 domainVerifyingContract (zero selects the oracle itself). Domain introspection and digest use the same current chain and effective address. Existing signature, answer, quorum, time, replay, clamp and fallback checks remain.
- Updated DeployAdamExtension.Config and mainnetConfig: relayer `0x087Bada60BB18d1667F03a8BA6b2aE5394E0E2C5`, website domain `0x37bfb8ac7c960e558657871d41ca70e07e7dbfff`, no questionHash argument; reject zero signer/relayer before deployment.
- Added both-domain success/failure and changing-window fuzz coverage, independent signing/domain checks, relayer rejection/state preservation and deployment defaults. The saved real IMD signature now verifies at a normally deployed oracle without code etching.
- Updated README, heartbeat, checklist and review with constructor parameters, shared-domain trust and relayer policy/monitoring responsibilities. No broadcast; token, hook, treasury/distributor/NFT economics, build configuration and dependencies are unchanged.

## 2026-10-05 — stakeFor griefing fix and post-audit review

- Restricted DistributorV2.stakeFor to its immutable NFTClaim address with OnlyNFTClaim(); holders use stake() for themselves. NFT claimAndStake retains the claimant's 24-hour lock and exact allowance handling.
- Added unauthorized-caller fuzzing, repeated 1-wei griefing, second-wallet/NFT-transfer JIT checks, operator rejection, lock-state/accounting invariants, deployment wiring checks and expanded fork LP withdrawal checks.
- Re-reviewed every change since audited commit 785edda; REVIEW.md records the fixed Medium withdrawal-DoS finding, per-item conclusions, assumptions and validation. Updated current staking/deployment documentation; the earlier entry below records historical permissionless behavior that this fix supersedes. No broadcast or change to token, fees, rewards, LP policy, build configuration or dependencies.

## 2026-10-05 — audit remediation

- A-01: DistributorV2 principal withdrawals and exit now require 24 hours since the wallet's latest stake/stakeFor, including NFT claimAndStake. Added unlockTime, StakeLocked and StakeLockUpdated; reward-only claims and accounting remain unchanged. Permissionless stakeFor gifts also reset the recipient's lock.
- Hook-only deployment mints the LP NFT directly to the fixed dead address. The default liquidity allocation is 890 million ADAM after the 110 million NFT reserve; only positive downward overrides are accepted.
- Added lock boundary, JIT, NFT, reward, fuzz/invariant and fork LP regressions, plus the deployment checklist. Existing token, hook, Treasury economics, oracle, NFT allocation, IMDSTR rules and keeper bounty are unchanged. No broadcast.
