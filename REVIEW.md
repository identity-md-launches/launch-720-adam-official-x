# Audit remediation implementation review

Scope: A-01's V2 principal holding period and permanent ownership of the hook-only LP. This is the implementer's verification record, not a new independent audit. The prior independent findings remain in AUDIT.md; the network's independent review must assess this diff before release.

## Disposition

- A-01: added a 24-hour wallet deadline in DistributorV2. Shared base stake/unstake methods gained internal virtual access points without changing their accounting. V2 resets the deadline on stake and stakeFor; inherited unstake and exit both dispatch through the guarded withdrawal override. All reward-only entry points retain their original code. Failed transactions roll back the lock and accounting together.
- Permanent LP: production hook-only deployment encodes the fixed dead recipient directly in MINT_POSITION. Default and maximum allocation are 890 million ADAM, reserving 110 million for NFTClaim. The caller may explicitly choose a smaller positive allocation, with the existing balance check. Legacy V1 simulation helpers retain prior behavior; run() mandates hook-only mode.
- Reviewed scope boundaries: no source edits to LaunchToken, AdamHook, Treasury/V2, NFTClaim, the split oracle or IMDSTR swap/accounting logic. Protected configuration and dependencies are unchanged. No broadcasts, new token deployments on a live chain, or signing material.

## Assumptions and limits

The existing plain fixed-supply ADAM is the staking asset. The contracts are immutable; the source change does not upgrade existing deployments. Positive permissionless stakeFor gifts reset the recipient's entire principal deadline, including unwanted dust gifts. This consequence of the requested rule is documented; the change does not add beneficiary consent. Fresh rewards remain immediately eligible, so a funded attacker who accepts 24 hours of capital lock can still receive them.

“LP burned” means the ERC-721 owner is the dead address, not a destroyed ERC-721 or removed liquidity. It assumes no party can control that address. The deployer has no position ownership/approval and cannot decrease it. This removes recovery and migration as well as ordinary withdrawal. LP-rounding ADAM dust can remain with the funder. Other positions and pools are outside this change.

The reproducible commands and final local outcomes are recorded below. Fork tests use external pinned archive state and are explicitly separate from the offline verification suite; they do not broadcast. Slither/Mythril were not run. Operational review/signing remains with the network deployer; see docs/DEPLOYMENT_CHECKLIST.md.

## Final local validation — 2026-10-05

Foundry 1.8.3, pinned Solidity 0.8.26, Cancun, via-IR, optimizer enabled with 44,444,444 runs. No compiler or optimizer override was used.

| Command | Result |
| --- | --- |
| `forge build --offline --threads 1` | Passed. Full clean-source compilation completed in 262.63 seconds; final incremental check also passed. |
| `forge test --offline --threads 2` | 179 passed, 0 failed, 0 skipped across 27 suites. |
| `forge test --offline --threads 2 --fuzz-seed 0x20261005 --fuzz-runs 1024` | 179 passed, 0 failed, 0 skipped. New lock and LP fuzz tests each ran 1,024 cases. |
| `forge test --profile fork --offline --threads 1 --compute-units-per-second 50` | 11 passed, 0 failed, 0 skipped across two suites. Public Tenderly archive endpoint, blocks 26,126,549 and 26,127,182. `--offline` controls compiler acquisition; these explicit fork tests read RPC state. |
| `forge fmt --check` / `git diff --check` | Passed. |

Both offline runs passed the original distributor/treasury invariants and the new V2 lock invariant: each ran 256 sequences at depth 64 (16,384 calls), with no unexpected reverts. The fork LP test uses the real PositionManager, verifies its single direct mint to dead, zero deployer LP balance and no approvals, executes both swap directions, and asserts the exact NotApproved(deployer) decrease-liquidity failure with unchanged position liquidity afterward.

Deployed bytecode sizes remain below EIP-170: DistributorV2 11,331 bytes, TreasuryV2 12,192, NFTClaim 5,046, split oracle 6,969. Forge emits advisory timestamp/type-cast/event lints; the new timestamp comparison is the requested wall-clock lock, and stake/withdraw/claim external paths remain nonReentrant with atomic rollback. No unchecked cast was added to the lock logic.

The previous attempt's timeout/exit 137 was addressed without changing protected build settings: shared test fixtures deploy the already-compiled PoolManager and scripts via deployCode, avoiding repeated embedding in test creation bytecode. During this run a large fork-test function was split to satisfy the IR compiler, and a reserved testFail-prefix name was corrected. The final commands above all passed. All protected paths and the unchanged production components named in the scope were checked for an empty diff.
