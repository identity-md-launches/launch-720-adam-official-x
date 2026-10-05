# ADAM independent source audit

Date: 2026-10-05. Reviewed parent head: `785edda603f9ed41364e08d46ecea440bcc0d6e2` (PR #2). Official project identity supplied by requester: https://x.com/IaMaDamIMD.

## Opinion and independence

No reproducible Critical, High or Medium implementation defect was identified in the bounded review. No production code or economics were changed. This is a source review with regression evidence, not a guarantee of safety or approval to broadcast. Mainnet activation still depends on the unsigned deployment choices and external services listed below.

Three separately tasked AI reviewers (`/root/treasury`, `/root/distributor`, `/root/oracle_nft`), not participants in the supplied parent implementation, reviewed (1) Treasury accounting/economics, (2) Distributor accounting/access and IMDSTR, and (3) oracle/NFT/token. The coordinating reviewer reviewed the hook and scripts and acted as consolidation judge. These are independent review passes within one agent system, not independent audit firms or an external certification. The judge retained the disclosed design risks below and did not manufacture fixes for intended economics.

Scope: LaunchToken, AdamHook, AdamTreasuryV2, AdamDistributorV2, AdamSplitOracle, NFTClaim, DeployAdam hook-only mode, DeployAdamExtension, and inherited AdamTreasury/AdamDistributor code reachable through V2. Legacy standalone deployments are not the intended mainnet architecture. Vendored libraries were read as integration dependencies, not exhaustively re-audited. The pinned deployment input describes existing Sepolia contracts, not a verified mainnet ADAM deployment. Nothing was broadcast, redeployed or re-minted on any chain.

## Findings and dispositions

| ID | Severity | Status | Evidence and reasoning |
| --- | --- | --- | --- |
| A-01 | Low / design risk | acknowledged | `AdamDistributor._distribute` allocates new rewards immediately to current stake. A staker can enter before public `process()` and exit after allocation, diluting longer-term holders. The seven-day thresholded stream applies only to backlog. Changing this would change the explicitly retained economics; no change. |
| A-02 | Low / trust risk | acknowledged | `AdamDistributorV2.enableDirectDistribution` is irreversible and trusts IMDSTR's `isDistributor`; external owner revocation or proxy changes can freeze that asset. `claimReward` and `unstake` isolate other assets/principal. Existing `ExtensionAdversarial.testDirectTokenLockCannotPreventPrincipalOrOtherRewards` and new AuditDistributor tests support the isolation. Do not enable without accepting that external dependency. |
| A-03 | Low / economic risk | acknowledged | `AdamTreasury.quoteMinOut` uses spot and its last successful checkpoint, not an independent execution-price oracle. Slippage within the bound and successive checkpoint changes remain exploitable in principle; persistent adverse repricing can defer buys. `process()` is public and awards a bounty on fresh allocation even when swaps fail. These are specified mechanics. Existing sandwich tests show one rejected manipulation, not universal MEV resistance. |
| A-04 | Informational / trust assumption | acknowledged | `AdamSplitOracle._valid` verifies one signer, not individual panel signatures or actual historical block hashes. Panel size/quorum/agreed, block range/hash and rationale are signed assertions. A compromised authorized signer can choose any accepted bounded weights. This matches the single-signer attestation design; no claim of trustless panel consensus is made. |
| A-05 | Low / deployment risk | acknowledged | `DeployAdam.mainnetConfig` defaults to 1,000,000,000 LP tokens although funding NFTClaim leaves at most 890,000,000. The balance guard rejects this default after funding. Set `LIQUIDITY_ADAM` explicitly. Manual broadcast spans multiple transactions; any interruption requires checking already deployed addresses, creator nonces and balances before resuming. No allocation/default economics changed. |
| A-06 | Informational / documentation | acknowledged | "Above current price" refers to ETH per ADAM. The actual v4 token1/token0 ticks are `[108180,177240]` with initialization at the upper boundary 177240; token1-only liquidity is below that tick. This is the correct orientation for ADAM-only funding, not an inverted launch position. |

Critical: 0. High: 0. Medium: 0. Fixed findings: none. The absence of a finding is a bounded review result, not proof that no vulnerability exists. Acknowledgment here records the judge's disposition; it does not assert the token owner's acceptance.

## Attributable review evidence

- Treasury reviewer: `AdamTreasuryV2.process`, `unsplitEth`, `executeV2`, `_executeLeg` and inherited `_failed`/`quoteMinOut`. Keeper debt is reserved in unsplit accounting, deferred payouts cannot earn twice, swap and notification share a rollback boundary, successful legs survive another leg's failure. New `test/unit/AuditTreasury.t.sol` exercises rollback and conservation. Continuous failure requirements and reroute remain bounded by existing tests; third-leg ETH accrual is not a swap and does not refresh its price checkpoint.
- Distributor reviewer: V2 `stakeFor` settles the beneficiary before adding stake and pulls only caller funds; `claimIMDSTR` consumes caller ETH obligations atomically; `unlockCallback` checks manager, active swap, full input and actual received minimum. New `test/unit/AuditDistributor.t.sol` fuzzes separated ETH/token backlogs across the one-time switch and beneficiary credit ownership.
- Oracle/NFT reviewer: `AdamSplitOracle.digest/_valid/currentSplit/clamp` bind EIP-712 consumer address, chain, immutable question and signer; reject reused request IDs and non-increasing issuance, future/expired/over-26-hour reports, malformed answer encoding, wrong reason hash and insufficient signed quorum fields. Clamps preserve sum 10000 and 1500–7000 limits. Invalid submissions leave the previous report intact. NFTClaim checks current ownership per ID, records cumulative claims before transfer/staking, clears allowance, and closes claims exactly at launch+39 days. New `test/unit/AuditOracleNFT.t.sol` adds boundary and transfer/vesting fuzz coverage. Token is a single constructor mint with no mint/admin surface.
- Hook/script reviewer: `AdamHook.beforeInitialize` restricts initialization to owner and one native ETH/ADAM pool; callbacks are PoolManager-only. Four swap modes use specified/unspecified ETH fee accounting; prepaid ETH partial fills revert atomically; empty swaps cannot start decay. Owner can only lower steady fee. Existing HookAdversarial/AdamHook tests cover modes, partial fills and unauthorized calls. Extension deployment validates supply/name/symbol/decimals, predicts and checks the excluded claim address, and funds exactly 110,000,000. `resolvePipeline` uses ABI-compatible inherited getters to reuse V2. New fork test `testAuditFreshTokenExtensionThenHookOnlySingleSidedLaunch` covers the entire intended pipeline locally on mainnet state with a fixture token; it does not create a live token.

Primary external evidence read during this audit:

- [Uniswap official mainnet deployments](https://developers.uniswap.org/docs/protocols/v4/deployments): confirms the mainnet PoolManager, PositionManager and Permit2 addresses below. This does not authenticate the project's reward pools.
- [IMD public v2 attestation](https://api.imd.fun/oracle/requests/cbb2d9c7-fd79-4033-8ebc-a76f2b256260/attestation): fetched with curl; retained in `artifacts/oracle-public-attestation.json`. Domain/type ordering/signature match `OraclePublicVector.t.sol`, whose recovery uses the public signer below. It is an unrelated uint256 answer, not a valid ADAM allocation report and not proof of a configured ADAM heartbeat.
- Mainnet fork tests read pinned state at 26,126,549 (legacy stack checks) and 26,127,182 (IMDSTR/NFT/extension). These are historical observations, not a latest-block safety certificate. Completed baseline fork results validate the observed 10% PNKSTR/IMDSTR output taxes and IMDSTR receipt/whitelist behavior at those blocks.

## Mainnet deployment checklist and exact constructor map

No fresh mainnet token address, signing deployer, team wallet, launch timestamp or canonical ADAM question hash was supplied. Symbols `T`, `C`, `D`, `N`, `O`, `V`, `H`, `TEAM`, `L`, `Q` below mean the actual reviewed token, creator, DistributorV2, NFTClaim, oracle, TreasuryV2, hook, team beneficiary, launch Unix timestamp and canonical question hash. They MUST be concretized in the unsigned transaction review; they are not arbitrary default values.

1. Confirm chain ID **1**, manually signed creator `C`, and freshly provisioned intended mainnet `LaunchToken()` (no constructor arguments). Confirm exact reviewed bytecode, name/symbol `ADAM`, decimals 18, supply `1000000000000000000000000000`, no additional mint function. This job provides no authorization to deploy or replace the existing Sepolia token. Verify at least `110000000000000000000000000` ADAM atomic units available to the chosen funder.
2. Set `DeployAdamExtension.Config`: `chainId=1`, `adam=T`, `creator=C`, `funder=C` (or separately reviewed approved funder), NFT addresses/counts below, `launch=L` in the future, `signer=0x5598Aa9146215Bc13eb26f2c692Ad1461Fd32982`, `questionHash=Q != 0`, and Treasury fields below. Confirm Q is the canonical service question, not a human prose hash chosen ad hoc. Confirm service signs domain `IdentityMD Oracle`, version `2`, chain 1, verifyingContract `O`, bytes32-array answer type 5, exactly four words (three basis-point weights plus reason hash), panel size >=5 and quorum >=4. Configure/validate a real ADAM report before relying on signed weights; absent reports deliberately fall back.
3. Constructor `AdamSplitOracle(signer,Q)` with the exact signer above. It is immutable: independently confirm service key mandate before signing. A public sample only demonstrates possession for that historical request.
4. Constructor `AdamDistributorV2(T, IMD, PNKSTR, PM, N, K2, 1000000000000000000)`. `N` must be the exact next NFTClaim CREATE address in the script order (oracle → DistributorV2 → NFTClaim → TreasuryV2); do not interleave creator transactions. Verify `isExcluded(N)` and `NFTClaim.distributor()==D` afterward.
5. Constructor `NFTClaim(T,D,0x0000eC93127BAA929E58E97dd0095A2BFb38ec1D,0x999ce0CE8C5f7661e0c74a568FfE27CEB9177bDB,2000,1178,L)`. Verify IDs 0–1999 and 1–1178, live counters covering frozen ranges, per-ID shares, day-0 10% through day-9 100%, deadline `L+3369600`. Transfer exactly `110000000000000000000000000` atomic units to N and verify balance before claim launch. Burn sends to dead address without reducing totalSupply.
6. Constructor `AdamTreasuryV2(Config(D,TEAM,PM,[K0,K1,K2],[0,1000,1000],1000000000000000000,300,600,O))`, where struct order is exactly the source order. Independently verify TEAM is usable for pull payment and all three pools have expected code/liquidity, initialized price and taxes at execution time. Verify 50-bps keeper bounty, remaining 90/10 holder/team split, caps, immutable pointers and initial checkpoints. No V1 Treasury/Distributor is to be deployed.

| Constant | Exact mainnet value |
| --- | --- |
| PM | `0x000000000004444c5dc75cB358380D2e3dE08A90` |
| IMD | `0xD34a99Bc0f67aE1bbd63C660e6d0b0dd03E263B7` |
| PNKSTR | `0xc50673EDb3A7b94E8CAD8a7d4E0cD68864E33eDF` |
| IMDSTR | `0x80271ce20184e38F4AFe90d4Ca134304d197Aca2` |
| K0 | `(address(0),IMD,10000,200,address(0))` |
| K1 | `(address(0),PNKSTR,0,60,0xfAaad5B731F52cDc9746F2414c823eca9B06E844)` |
| K2 | `(address(0),IMDSTR,0,60,0x66b05C8eecA9329F7a2332C02Ce3855cfaB72444)` |
| PositionManager | `0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| CREATE2 deployer | `0x4e59b44847b379578588920cA78FbF26c0B4956C` |

7. Hook-only `DeployAdam`: set `DEPLOYER=C`, `TEAM_WALLET=TEAM`, `ADAM_TOKEN=T`, `TREASURY=V`, and explicit `LIQUIDITY_ADAM=890000000000000000000000000` if all remaining supply goes to LP (otherwise the reviewed smaller amount). Ensure actual manual broadcaster equals C. Constructor `AdamHook(PM,T,V,C)`; mine salt against exact compiler output/constructor bytes and CREATE2 deployer; verify `uint160(H)&0x3fff == 0x20cc` and predicted equals actual. Do not run the legacy zero-treasury branch.
8. Initialize key `(address(0),T,0,60,H)` at `TickMath.getSqrtPriceAtTick(177240)`. Mint position ticks `[108180,177240]`, amount0Max=0, amount1Max=the reviewed LP allocation, liquidity from `getLiquidityForAmount1`, recipient C. Verify zero native ETH deposited and only rounding dust remains. Position owner C can later withdraw liquidity; no LP lock is implemented. Pin this exact key in frontends; other pools bypass this hook fee.
9. Verify hook owner, immutable treasury, initial fee 150 bps and launchTimestamp zero before first fill; first filled trade starts the 2000-bps/1800-second decay independently of NFT launch L. Confirm NFT funding, approvals, constructor calldata and code against simulation. Record all actual addresses, salt and LP ID. Check any partial broadcast state before retrying. Arrange keeper calls and oracle report refresh. Do not enable IMDSTR direct mode until the external whitelist and irreversible dependency are consciously accepted.

## Validation

Validation results follow below and are mirrored in `artifacts/report.md`. Source checksums are recorded in `artifacts/source-sha256.txt`. Commands use unchanged pinned Solidity 0.8.26/cancun/via-IR configuration and Foundry 1.8.3. Fork tests require public historical RPC despite offline compilation. No build configuration or dependency was changed. README changes only the fork endpoint description after a public Nodies HTTP 429 failure; contract runtime behavior is unchanged.

Executed checks:

- Initial `forge test --offline -q`: exit 0 on the parent baseline (before added audit suites).
- Independent Treasury regressions: 2 passed with 512 fuzz runs/seed 0x1, repeated with 1024/0x2.
- Independent Distributor regressions: 2 passed with default 256 fuzz runs, repeated with 1024/0x1234.
- Independent oracle/NFT suites: 12 passed (including inherited oracle tests), repeated with 1024 fuzz runs/seed 0x42.
- Full `forge test --offline --fuzz-seed 0x1234 --fuzz-runs 1024`: **167 passed, 0 failed, 0 skipped**, across 24 suites, including invariants; see `artifacts/unit-tests.log`.
- Final `FOUNDRY_PROFILE=fork forge test --offline -vv --threads 1 --compute-units-per-second 30`: **11 passed, 0 failed, 0 skipped**. `artifacts/fork-tests.log` is the final result. Earlier failures remain in `fork-first-attempt.log` (public Nodies 429) and `fork-rounding-assertion.log` (audit test's overly strict 1000-atomic-unit dust assertion). The new 890-million-token LP left 3352 atomic units; the corrected assertion checks exact conservation and dust below one billionth of an ADAM. No production defect was inferred from test scaffolding or RPC failure.
- `forge build --offline`: exit 0 (compiler successful; informational lint warnings retained in `artifacts/build.log`).
- `forge fmt --check`: exit 0; `git diff --check`: exit 0. Protected configuration/dependency paths have no diff.

Unanswered deployment questions: actual T/C/TEAM/L/Q addresses and values, live ADAM-specific signed report/service configuration, current pool liquidity/price/tax/implementation and external IMDSTR owner's future whitelist policy. These are deliberately not guessed from the supplied Sepolia deployment or unrelated public attestation. A successful historical fork does not answer them.
