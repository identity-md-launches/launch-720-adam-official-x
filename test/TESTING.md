# Verification

Use the existing Solidity 0.8.26 Foundry profile:

```sh
forge build
forge test
forge fmt --check
FOUNDRY_PROFILE=fork forge test -vv --threads 1 --compute-units-per-second 50
```

Default tests are offline and deterministic. Fork tests are excluded by the existing default configuration; the fork profile uses public mainnet RPC with hard-coded pinned blocks and visibly fails if RPC is unavailable. No test reads or changes environment variables. No FFI or filesystem permission is needed.

New coverage:

| Suite | Coverage |
|---|---|
| NFTClaim | daily boundaries, launch/expiry, current ownership, transfer of remaining rights, operator rejection, invalid/post-snapshot IDs, atomic batches, duplicates, claim-and-stake, exclusions, burned IDs, burn deadline, unlock conservation fuzz |
| AdamSplitOracle | signed weights, clamping, sum/bounds fuzz, malformed ABI fuzz, signature/chain/domain/question/reason failures, quorum, future/stale/expired reports, monotonic/replay guards, exact 26h boundary, equal fallback |
| OraclePublicVector | exact EIP-712 compatibility with a published IMD v2 signature, and rejection as an unrelated reward report |
| AdamExtension | all three legs, pull rewards/team, buy-on-claim, wallet transfer lock, minOut/deadline rollback, unauthorized claims, direct switch, old ETH claims after switch, stale split, retries/three-leg reroute, revoked whitelist, callback guards, backlog/new staker accounting, bounty/conservation fuzz |
| ExtensionAdversarial | NFT stake reentry, keeper reentry, independently claimable assets after token relock, principal availability, two-staker ETH conservation fuzz |
| ExtensionDeploy | existing token/supply preservation, exactly 11% funded, mutual address wiring, immutable NFT exclusion, signer simulation via run(Config), both funding paths, wrong chain/missing token/invalid snapshot failures |
| IMDSTRFork | block 26,127,182: pool key/state/liquidity, proxy implementation/hook, onchain NFT counts, PoolManager not whitelisted, EOA buy-on-claim, exact 10% hook tax from raw Swap versus net delivery, wallet InvalidTransfer(), simulated owner whitelist/direct distribution |

All original token/hook/distributor/treasury, adversarial, fuzz and invariant suites remain. The parent mainnet suite retains block 26,126,549 and now uses an explicit RPC instead of reading the environment. It covers IMD/PNKSTR tax/floors, original hooked single-sided launch and fee/staking integration.

Parent extension results (historical; the audit-remediation rerun is recorded in REVIEW.md):

- `forge build`: passed with Solidity 0.8.26.
- `forge test`: **151 passed, 0 failed, 0 skipped**, across 20 suites. New fuzz tests each use 256 runs; the original suites retain their fuzz/invariant settings.
- `forge fmt --check` and `git diff --check`: passed.
- Pinned mainnet forks: **10 passed, 0 failed** across the four new IMDSTR/NFT tests and six original integration tests. The 1 ETH IMDSTR buy delivered 3,432,834.287892671935600222 tokens against a 3,371,166.235868870877848721-token floor.
- All four new production contracts fit EIP-170's 24,576-byte deployed-code limit; largest is TreasuryV2 at 12,192 bytes.

Fork endpoints: the new suite uses `https://eth-pokt.nodies.app`; the original suite uses `https://mainnet.gateway.tenderly.co`. Earlier providers lacked historical state or rate-limited requests. These are external RPC failures, not skipped tests; the final suites passed against public archive providers. Use the documented single-thread/request-rate options. Public RPC availability is not guaranteed; substituting another archive endpoint leaves the pinned blocks and assertions intact.

## Audit remediation regression coverage

- `StakingLock`: exact 24-hour boundary for partial unstake and exit, zero/failed stakes do not reset the deadline, reward-only claims remain live, restaking after exit, and fuzzed direct/delegated top-ups before/after the previous deadline.
- `StakingLockInvariant`: random direct/delegated stakes, partial withdrawals/exits, claims, funding and time advances; expected lock reverts are checked explicitly. Independent last-stake/principal counters verify timing and fund conservation; all principal is recovered after a final wait. 256 runs at depth 64, fail-on-revert enabled.
- `AdamExtension.testJITProcessCannotExitButCanClaimAllRewardForms`: stake immediately before the real local TreasuryV2 process, reject same-block exit/unstake, exercise per-asset and buy-on-claim rewards while locked, and recover principal at expiry.
- `NFTClaim.testClaimAndStakeSetsAndResetsClaimantsLock`: first claim and a second NFT claim reset the beneficiary's whole stake, without locking NFTClaim itself.
- `LiquidityLock`: exact offline mint-action encoding to the fixed dead address, default NFT reserve, fuzzed downward allocations, rejection of upward/zero allocations and insufficient balance. This mocks external periphery calls; actual ownership and settlement are covered on the fork.
- `IMDSTRFork.testAuditFreshTokenExtensionThenHookOnlySingleSidedLaunch`: block 26,127,182, complete extension + hook-only deployment; exactly one mint from zero directly to dead, owner/approval/deployer balance checks, no ETH deposited at launch, both swap directions, and real PositionManager rejection of deployer liquidity decrease. NFT claimAndStake also verifies unlockTime on the fork.

The original V1 fixtures explicitly keep their prior full-supply allocation; production hook-only defaults are 890 million. Existing V2 withdrawal-success tests now wait for their wallet's unlockTime while preserving their original reward/conservation assertions. Shared fixtures load the compiled PoolManager and deployment scripts with Foundry's deployCode helper so the IR optimizer does not embed their large constructor bytecode in every inheriting test. All artifacts are built locally from the unchanged vendored dependencies; no FFI, network dependency, or build-setting override is introduced into default tests.

Final remediation results: **179 offline tests passed** on both the normal run and a second seed (`0x20261005`, 1,024 fuzz cases); **11 fork tests passed** against the public Tenderly archive endpoint. All three invariant suites passed 256 runs at depth 64. Build and formatting passed with the original compiler settings. See [REVIEW.md](../REVIEW.md) for exact commands, sizes, limitations and results.
