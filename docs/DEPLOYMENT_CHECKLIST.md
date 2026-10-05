# ADAM V2 manual deployment checklist

This change authorizes no broadcasts. The network deployer reviews and signs manually; no keys, keystores, or private RPC credentials belong in this repository. Existing deployed contracts and the existing token stay in place. The supplied deployment record is Sepolia; mainnet activation requires a separately reviewed existing mainnet ADAM address and balance.

## Review before signing

- [ ] Review the revised DistributorV2 and hook-only mint script, with independent review of the audit remediation. Confirm the source/compiler/artifacts match Solidity 0.8.26 and the unchanged Foundry settings.
- [ ] Confirm target chain and code for every configured PoolManager, PositionManager, Permit2, reward token/pool/hook, NFT collection, and deterministic deployer. The existing script's mainnet preset must not be used with Sepolia addresses.
- [ ] Confirm existing ADAM identity and fixed 1,000,000,000 supply; do not redeploy or re-mint it. Do not redeploy legacy V1 application contracts for the intended mainnet pipeline.
- [ ] Review extension configuration: creator/funder, team wallet, oracle signer and canonical questionHash, immutable NFT counts/ranges, future NFT launch timestamp, per-leg 1 ETH caps, 300 bps slippage floors, and 600-second cooldown. Fee decay, allocation bounds, split logic and 0.5% keeper bounty are unchanged.
- [ ] Communicate the 24-hour principal rule: every positive successful stake, top-up, or stakeFor resets the entire wallet's deadline. NFT claimAndStake also resets it. Permissionless third-party stakeFor gifts can prolong the deadline. There is no early withdrawal or administrator bypass. Reward-only claim(), claimReward(token), and claimIMDSTR remain usable during the lock, subject to their existing token/slippage rules.
- [ ] Accept irreversible LP ownership: the hook-only position is minted directly to `0x000000000000000000000000000000000000dEaD`. There is no recipient override, recovery, or deployer liquidity withdrawal. This position cannot later be migrated to another range.

## Extension, then hook-only pool

1. Simulate the existing `DeployAdamExtension.run(Config)` using a reviewed existing token. Inspect constructor inputs and the 110,000,000 ADAM NFTClaim funding transfer before the operator signs. A separate funder approves exactly that amount. Record each successful action to avoid duplicating deployments after an interruption.
2. Set `DEPLOYER`, `TEAM_WALLET`, `ADAM_TOKEN` and `TREASURY` for `DeployAdam.run()`. `TREASURY` must be the reviewed TreasuryV2 wired to the revised DistributorV2. DEPLOYER must hold the required ADAM, be the signer and initially own the hook. There is no private-key environment input.
3. Leave `LIQUIDITY_ADAM` unset for **890000000000000000000000000 atomic units** (890 million ADAM), the remaining 89% after NFTClaim funding. Set it explicitly only to a positive smaller amount if other allocations reduce the balance. An upward override, zero, or insufficient held balance fails before pool initialization; balance shortages are never silently converted into a lower LP allocation.
4. Simulate `forge script script/DeployAdam.s.sol:DeployAdam --sender <deployer>` against the operator's configured target-chain provider, without `--broadcast`. Check the fee-0, spacing-60 native ETH/ADAM hooked PoolKey, opening tick 177240 and lower tick 108180. This token1-only range deposits zero ETH at initialization (below the opening token1/token0 tick, corresponding to higher ETH-per-ADAM prices).
5. Inspect the PositionManager `MINT_POSITION` recipient: it must be the fixed dead address. The subsequent settlement pays from the signer. Approvals retain the existing one-hour Permit2 expiration and requested ADAM allowance. Small liquidity-rounding dust may remain with the signer; no LP NFT goes to the signer.
6. Only the network deployer decides whether to sign and broadcast the reviewed transactions. No transaction has been broadcast by this assignment. After interruption, inspect chain state and funding before resuming; initialization and deployment steps are not an idempotent recovery procedure.

## Verify activation and operate

- [ ] Record final contract addresses, canonical ABIs, PoolKey, pool ID, LP token ID, amount actually deposited, transaction hashes, and verified code. A fork fixture does not establish a production address.
- [ ] Verify PositionManager `ownerOf(lpId) == 0x000000000000000000000000000000000000dEaD`, no deployer ownership/approval of the new position, and the single mint Transfer event from zero directly to dead. In simulation verify buys and sells, hook fees, and a reverted deployer decrease-liquidity action.
- [ ] Verify NFTClaim holds exactly 110 million ADAM and the remaining LP allocation matches the signed value; existing pools stay unchanged. Frontends/routers must pin the new hooked PoolKey.
- [ ] Verify a test claimant's `unlockTime` resets to the claimAndStake timestamp plus 86400; withdrawal at unlockTime minus one fails, and at unlockTime succeeds. Frontends distinguish principal lock from always-available reward-only claims and IMDSTR's external transfer restrictions.
- [ ] Arrange keeper process() calls, heartbeat funding/reports, and team pull payments. IMDSTR whitelist authority remains with the external token owner; enabling direct distribution is the existing one-way switch and does not alter prior ETH claims.
