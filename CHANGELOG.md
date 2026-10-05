# Changelog

## 2026-10-05 — audit remediation

- A-01: DistributorV2 principal withdrawals and exit now require 24 hours since the wallet's latest stake/stakeFor, including NFT claimAndStake. Added unlockTime, StakeLocked and StakeLockUpdated; reward-only claims and accounting remain unchanged. Permissionless stakeFor gifts also reset the recipient's lock.
- Hook-only deployment mints the LP NFT directly to the fixed dead address. The default liquidity allocation is 890 million ADAM after the 110 million NFT reserve; only positive downward overrides are accepted.
- Added lock boundary, JIT, NFT, reward, fuzz/invariant and fork LP regressions, plus the deployment checklist. Existing token, hook, Treasury economics, oracle, NFT allocation, IMDSTR rules and keeper bounty are unchanged. No broadcast.
