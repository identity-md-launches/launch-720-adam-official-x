# Daily IMD oracle heartbeat

Official X: https://x.com/IaMaDamIMD

Protocol: [IMD oracle v2](https://imd.fun/docs/#oracle) and [request schema](https://imd.fun/docs/#oracle-body), recorded by the parent job on 2026-10-05 (not re-queried by this change). The attester returned by `GET https://api.imd.fun/oracle/requests?limit=1` was `0x5598aa9146215bc13eb26f2c692ad1461fd32982`. The deployer must independently confirm it before signing deployment. The contract has no signer-rotation power.

## Responsibilities and cadence

The project operator funds and schedules one `oracle.request` each day at 00:10 UTC. No job, payment, schedule, signature or transaction was submitted by this assignment. Only the immutable relayer retrieves the completed attestation, verifies the request policy and calls `AdamSplitOracle.submit`. The mainnet preset relayer is `0x087Bada60BB18d1667F03a8BA6b2aE5394E0E2C5`; every other caller reverts with `OnlyRelayer()`, including the IMD signer unless it is also configured as relayer. Separate keepers call Treasury `process()` hourly. Report signing belongs to the IMD service, never to the keeper or a language model.

Before deployment, freeze the complete question and definitions. The task's verified API observation establishes that `questionHash` includes the pinned block window and changes on each run. There is **no immutable questionHash check or constructor parameter**. Forward `message.questionHash` exactly as signed, without substituting keccak256(question text) or a prior day's hash. It remains cryptographically committed by the signature.

The relayer must retrieve the originating request and confirm the frozen ADAM policy, definitions, asset order, intended chain, pinned window and matching request/panel IDs before submitting. Log the request, evidence, exact reason, attestation and submission result for each run. Do not accept an unrelated signed allocation just because it has the correct shape. This policy selection is an offchain trust responsibility: a shared signing domain permits reports from other requests and oracle instances, and onchain replay tracking is per instance. The relayer cannot forge the signer's signature but can choose among valid signed reports. Losing the relayer or signer prevents updates; after expiry/26 hours the last split falls back to equal thirds. Neither address nor the configured domain can be rotated in place; changes require a separately reviewed migration.

Set `consumer.chainId` to the deployment chain and `consumer.verifyingContract` to **`oracle.domainVerifyingContract()`**. The mainnet preset uses the task-supplied website default `0x37bfb8ac7c960e558657871d41ca70e07e7dbfff`. For explicit self-domain requests, pass zero as the oracle constructor's domain argument and set the request consumer to the resulting AdamSplitOracle address. Do not send a self-domain signature to an oracle configured for the website default, or vice versa. Inspect the actual signed domain; do not assume the website honored an override. `eip712Domain()` exposes the effective fields. The default market observations are mainnet. Current production deployment remains gated by the chain mismatch described in README.

## Inputs

- Pinned closing block and its hash, and the block approximately 24 hours before it.
- ETH/IMD: currency0 zero, currency1 `0xD34a99Bc0f67aE1bbd63C660e6d0b0dd03E263B7`, fee 10000, spacing 200, hook zero.
- ETH/PNKSTR: currency1 `0xc50673edb3a7b94e8cad8a7d4e0cd68864e33edf`, fee 0, spacing 60, hook `0xfaaad5b731f52cdc9746f2414c823eca9b06e844`.
- ETH/IMDSTR: currency1 `0x80271ce20184e38f4afe90d4ca134304d197aca2`, fee 0, spacing 60, hook `0x66b05c8eeca9329f7a2332c02ce3855cfab72444`.
- Prices expressed as ETH per token, using token decimals. Use medians of 61 evenly spaced blocks across each one-hour endpoint window, not a single transaction's spot price.
- Active and nearby liquidity, achievable 1 ETH buy output, volume, hook taxes, token transfer restrictions, proxy implementation/owner changes, and failed buy simulations at the closing block. IMDSTR must be simulated using take directly to the recipient.

## Frozen prompt/policy (include these definitions in the request)

> Allocate ADAM holder rewards among IMD, PNKSTR and IMDSTR using the pinned 24-hour market window. Favor assets whose ETH-denominated price fell most, unless liquidity or risk signals make buying them unsuitable. Compare the endpoint median prices described in definitions. Rank assets by ascending 24-hour return; ties use IMD, PNKSTR, IMDSTR order. With all assets healthy assign 5000 bps to the worst performer, 3000 to the middle and 2000 to the best. Flag an asset risky if the 1 ETH buy cannot execute with at most 3% price impact after known fees/tax, liquidity depth fell at least 50%, a proxy/hook changed unexpectedly, or the intended recipient cannot receive tokens. If exactly one asset is risky, give it 1500 bps and give 5500/3000 to the two healthy assets in rank order. If two are risky, give them 1500 each and the healthy asset 7000. If all are risky, or reliable comparable evidence is missing, report unavailable rather than inventing data. No negative or leveraged allocation. Output exactly four bytes32 words: IMD bps, PNKSTR bps, IMDSTR bps (unsigned, zero-padded big-endian), and keccak256 of the exact UTF-8 canonical reason. All bps must sum to 10000. Include the reason text in the report evidence. Do not sign anything yourself; the oracle service signs the consensus attestation.

Choose the canonical reason from a frozen vocabulary to make independent panel agreement reproducible:

- Healthy: `24h rank: IMD,PNKSTR,IMDSTR; all healthy.` (replace order with the six possible permutations).
- One risky: `Risk: IMD; healthy 24h rank: PNKSTR,IMDSTR.` (replace names/order).
- Two risky: `Risk: IMD,PNKSTR; healthy: IMDSTR.` (risky names always in IMD,PNKSTR,IMDSTR order).

Detailed numeric observations and source links belong in the evidence, not in these canonical strings. A short reason is cryptographically committed by the fourth word; the relayer must provide exactly that string to `submit`. Every permitted reason is under 280 UTF-8 bytes.

## Request template and output

```json
{
  "v": 1,
  "question": "<frozen prompt above; never change between runs>",
  "chainId": 1,
  "window": {"hours": 24},
  "answerType": "bytes32[]",
  "evidence": "panel",
  "head": 4,
  "panelSize": 5,
  "quorum": 4,
  "validForSeconds": 93600,
  "consumer": {"chainId": 1, "verifyingContract": "0x37bfb8ac7c960e558657871d41ca70e07e7dbfff"},
  "definitions": {"policy": "<frozen policy>", "prices": "<frozen endpoint sampling>", "risks": "<frozen risk rules>", "reason": "<frozen canonical vocabulary>"}
}
```

The operator supplies actual text and addresses before commissioning; definitions each obey the service's 512-character limit (split into additional named definitions as needed). Review the complete template and intended signing domain before funding; confirm each returned per-run hash against its originating request without expecting equality across runs.

The report sidecar format is:

```json
{
  "imdBps": 5000,
  "pnkstrBps": 3000,
  "imdstrBps": 2000,
  "reason": "24h rank: IMD,PNKSTR,IMDSTR; all healthy.",
  "requestId": "<UUID>",
  "attestation": "<unaltered GET /oracle/requests/:id/attestation response>",
  "evidence": [{"source": "<RPC/archive/source URL>", "closingBlock": 0, "returnBps": 0, "risk": false}]
}
```

Onchain `answer = abi.encode(bytes32[]([bytes32(uint256(imdBps)), bytes32(uint256(pnkstrBps)), bytes32(uint256(imdstrBps)), keccak256(bytes(reason))]))` is exactly 192 bytes. The API's textual answerType `bytes32[]` must be encoded as uint8 **5** in the Solidity tuple. Use requestId/panelJobId from `message` (left-aligned bytes16 padded to bytes32), not a hash of a UUID string.

EIP-712 domain: `IdentityMD Oracle`, version `2`, current deployment chainId, `oracle.domainVerifyingContract()`. The exact type string is in `AdamSplitOracle.TYPEHASH`. Solidity restricts the caller to the relayer and verifies the signer, domain, chain, signed per-run questionHash integrity, answer type/shape/sum, reason, quorum (panelSize >= 5, quorum >= 4, quorum <= agreed <= panelSize), past block range, nonfuture issuedAt, expiration, maximum 26-hour age, and strictly increasing issuance time. A used reportId cannot replay. Signature checks use OpenZeppelin's low-s recovery.

The contract clamps accepted weights to 1500–7000 and adjusts excess across remaining capacity in IMD/PNKSTR/IMDSTR order, preserving sum 10000. `currentSplit()` returns 3333/3333/3334 if no valid report remains. Invalid reports from the authorized relayer return `false`, emit `ReportRejected` and cannot erase a valid report or consume its request ID. Unauthorized callers revert before report validation. Monitor the returned value or event; transaction success alone does not mean a report was accepted. `checkpoint()` emits `SplitUpdated` with the effective weights, reportId, reasonHash and source (0 fallback, 1 signed), and Treasury calls it on every process.

On outage, disagreement, malformed answer, wrong domain or signature, do not fabricate a signature or overwrite the previous report. Alert the operator; after expiry the equal split applies automatically. This service format is verifiable onchain, so no snapshot-price replacement oracle was needed.
