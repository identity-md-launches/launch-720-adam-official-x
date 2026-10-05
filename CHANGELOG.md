# Changelog

## 2026-10-05 — stakeFor griefing fix and post-audit review

- Restricted DistributorV2.stakeFor to its immutable NFTClaim address with OnlyNFTClaim(); holders use stake() for themselves. NFT claimAndStake retains the claimant's 24-hour lock and exact allowance handling.
- Added unauthorized-caller fuzzing, repeated 1-wei griefing, second-wallet/NFT-transfer JIT checks, operator rejection, lock-state/accounting invariants, deployment wiring checks and expanded fork LP withdrawal checks.
- Re-reviewed every change since audited commit 785edda; REVIEW.md records the fixed Medium withdrawal-DoS finding, per-item conclusions, assumptions and validation. Updated current staking/deployment documentation; the earlier entry below records historical permissionless behavior that this fix supersedes. No broadcast or change to token, fees, rewards, LP policy, build configuration or dependencies.

## 2026-10-05 — audit remediation

- A-01: DistributorV2 principal withdrawals and exit now require 24 hours since the wallet's latest stake/stakeFor, including NFT claimAndStake. Added unlockTime, StakeLocked and StakeLockUpdated; reward-only claims and accounting remain unchanged. Permissionless stakeFor gifts also reset the recipient's lock.
- Hook-only deployment mints the LP NFT directly to the fixed dead address. The default liquidity allocation is 890 million ADAM after the 110 million NFT reserve; only positive downward overrides are accepted.
- Added lock boundary, JIT, NFT, reward, fuzz/invariant and fork LP regressions, plus the deployment checklist. Existing token, hook, Treasury economics, oracle, NFT allocation, IMDSTR rules and keeper bounty are unchanged. No broadcast.
