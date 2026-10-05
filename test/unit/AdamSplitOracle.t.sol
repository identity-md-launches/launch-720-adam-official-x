// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {Test} from "forge-std/Test.sol";
import {AdamSplitOracle} from "../../src/AdamSplitOracle.sol";

/// @custom:x https://x.com/IaMaDamIMD
contract AdamSplitOracleTest is Test {
    AdamSplitOracle internal oracle;
    uint256 constant PK = 1234;
    bytes32 constant QUESTION = keccak256("first daily window");
    string constant REASON = "IMD is down 12%, liquid and risk unchanged.";

    function setUp() public virtual {
        vm.warp(1800000000);
        vm.roll(1000);
        oracle = new AdamSplitOracle(vm.addr(PK), address(this), address(0));
        assertEq(oracle.domainVerifyingContract(), address(oracle));
    }

    function report(uint16 x, uint16 y, uint16 z) internal view returns (AdamSplitOracle.Attestation memory a) {
        bytes32[] memory words = new bytes32[](4);
        words[0] = bytes32(uint256(x));
        words[1] = bytes32(uint256(y));
        words[2] = bytes32(uint256(z));
        words[3] = keccak256(bytes(REASON));
        a = AdamSplitOracle.Attestation(
            bytes32(uint256(1)),
            vm.getChainId(),
            QUESTION,
            5,
            abi.encode(words),
            0,
            1,
            999,
            keccak256("block"),
            keccak256("panel"),
            5,
            4,
            4,
            uint64(vm.getBlockTimestamp()),
            uint64(vm.getBlockTimestamp() + 2 days)
        );
    }

    function signature(AdamSplitOracle.Attestation memory a, uint256 pk) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, oracle.digest(a));
        return abi.encodePacked(r, s, v);
    }

    // Build the digest independently of the consumer, as an offchain EIP-712 signer would.
    function externalSignature(
        AdamSplitOracle.Attestation memory a,
        string memory name,
        string memory version,
        uint256 chainId,
        address consumer
    ) internal pure returns (bytes memory) {
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                consumer
            )
        );
        bytes32 message = keccak256(
            abi.encode(
                keccak256(
                    "OracleAttestation(bytes32 requestId,uint256 chainId,bytes32 questionHash,uint8 answerType,bytes answer,uint256 figure,uint64 fromBlock,uint64 toBlock,bytes32 blockHash,bytes32 panelJobId,uint16 panelSize,uint16 quorum,uint16 agreed,uint64 issuedAt,uint64 expiresAt)"
                ),
                a.requestId,
                a.chainId,
                a.questionHash,
                a.answerType,
                keccak256(a.answer),
                a.figure,
                a.fromBlock,
                a.toBlock,
                a.blockHash,
                a.panelJobId,
                a.panelSize,
                a.quorum,
                a.agreed,
                a.issuedAt,
                a.expiresAt
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PK, keccak256(abi.encodePacked(hex"1901", domain, message)));
        return abi.encodePacked(r, s, v);
    }

    function testIndependentSignatureAndDomainMetadata() public {
        (
            bytes1 fields,
            string memory name,
            string memory version,
            uint256 chainId,
            address consumer,
            bytes32 salt,
            uint256[] memory extensions
        ) = oracle.eip712Domain();
        assertEq(fields, hex"0f");
        assertEq(name, "IdentityMD Oracle");
        assertEq(version, "2");
        assertEq(chainId, vm.getChainId());
        assertEq(consumer, oracle.domainVerifyingContract());
        assertEq(salt, 0);
        assertEq(extensions.length, 0);
        assertEq(oracle.relayer(), address(this));
        assertEq(oracle.signer(), vm.addr(PK));
        AdamSplitOracle.Attestation memory a = report(5000, 3000, 2000);
        assertTrue(oracle.submit(a, externalSignature(a, name, version, chainId, consumer), REASON));
        assertEq(oracle.reportId(), a.requestId);
    }

    function testWrongDomainFieldsRejected() public {
        AdamSplitOracle.Attestation memory a = report(5000, 3000, 2000);
        address consumer = oracle.domainVerifyingContract();
        assertFalse(oracle.submit(a, externalSignature(a, "Wrong Oracle", "2", vm.getChainId(), consumer), REASON));
        assertFalse(oracle.submit(a, externalSignature(a, "IdentityMD Oracle", "1", vm.getChainId(), consumer), REASON));
        assertFalse(
            oracle.submit(a, externalSignature(a, "IdentityMD Oracle", "2", vm.getChainId() + 1, consumer), REASON)
        );
        assertFalse(
            oracle.submit(a, externalSignature(a, "IdentityMD Oracle", "2", vm.getChainId(), address(0xBAD)), REASON)
        );
        assertFalse(oracle.used(a.requestId));
        assertFallback();
    }

    function testDomainUsesCurrentChainAfterChainIdChange() public {
        AdamSplitOracle.Attestation memory a = report(5000, 3000, 2000);
        uint256 oldChain = vm.getChainId();
        vm.chainId(oldChain + 1);
        a.chainId = vm.getChainId();
        address consumer = oracle.domainVerifyingContract();
        assertFalse(oracle.submit(a, externalSignature(a, "IdentityMD Oracle", "2", oldChain, consumer), REASON));
        assertTrue(oracle.submit(a, externalSignature(a, "IdentityMD Oracle", "2", vm.getChainId(), consumer), REASON));
        (,,, uint256 domainChain,,,) = oracle.eip712Domain();
        assertEq(domainChain, vm.getChainId());
    }

    function testFuzzNonRelayerCannotReplaceReport(address caller) public {
        vm.assume(caller != address(this));
        AdamSplitOracle.Attestation memory a = report(5000, 3000, 2000);
        bytes memory sig = signature(a, PK);
        vm.prank(caller);
        vm.expectRevert(AdamSplitOracle.OnlyRelayer.selector);
        oracle.submit(a, sig, REASON);
        assertFalse(oracle.used(a.requestId));
        assertFallback();
        assertTrue(oracle.submit(a, sig, REASON));
        uint64 acceptedAt = a.issuedAt;
        uint64 acceptedExpiry = a.expiresAt;
        vm.warp(vm.getBlockTimestamp() + 1);
        a = report(2000, 3000, 5000);
        a.requestId = keccak256("unauthorized replacement");
        sig = signature(a, PK);
        vm.prank(caller);
        vm.expectRevert(AdamSplitOracle.OnlyRelayer.selector);
        oracle.submit(a, sig, REASON);
        assertEq(oracle.issuedAt(), acceptedAt);
        assertEq(oracle.expiresAt(), acceptedExpiry);
        assertFalse(oracle.used(a.requestId));
        (uint16[3] memory w, bytes32 id, bytes32 reason, uint8 source) = oracle.currentSplit();
        assertEq(w[0], 5000);
        assertEq(w[1], 3000);
        assertEq(w[2], 2000);
        assertEq(id, bytes32(uint256(1)));
        assertEq(reason, keccak256(bytes(REASON)));
        assertEq(source, 1);
    }

    function testConfiguredRelayerMayDifferFromDeployerAndSigner() public {
        address relay = makeAddr("daily relayer");
        oracle = new AdamSplitOracle(vm.addr(PK), relay, oracle.domainVerifyingContract());
        AdamSplitOracle.Attestation memory a = report(5000, 3000, 2000);
        bytes memory sig =
            externalSignature(a, "IdentityMD Oracle", "2", vm.getChainId(), oracle.domainVerifyingContract());
        vm.expectRevert(AdamSplitOracle.OnlyRelayer.selector);
        oracle.submit(a, sig, REASON);
        vm.prank(relay);
        assertTrue(oracle.submit(a, sig, REASON));
        assertEq(oracle.reportId(), a.requestId);
    }

    function testUnauthorizedMalformedReportReverts() public {
        AdamSplitOracle.Attestation memory a;
        vm.prank(vm.addr(PK)); // The attester is not the relayer.
        vm.expectRevert(AdamSplitOracle.OnlyRelayer.selector);
        oracle.submit(a, hex"", "");
    }

    function testFuzzDifferentDailyQuestionHashesAccepted(bytes32 first, bytes32 second) public {
        vm.assume(first != second);
        bytes32[3] memory questions = [first, second, bytes32(0)];
        for (uint256 i; i < questions.length; ++i) {
            vm.warp(vm.getBlockTimestamp() + 1 days);
            vm.roll(vm.getBlockNumber() + 7200);
            AdamSplitOracle.Attestation memory a = report(5000, 3000, 2000);
            a.requestId = bytes32(i + 1);
            a.questionHash = questions[i];
            a.fromBlock = uint64(vm.getBlockNumber() - 7200);
            a.toBlock = uint64(vm.getBlockNumber() - 1);
            bytes memory sig =
                externalSignature(a, "IdentityMD Oracle", "2", vm.getChainId(), oracle.domainVerifyingContract());
            assertTrue(oracle.submit(a, sig, REASON));
            assertEq(oracle.reportId(), a.requestId);
            assertEq(oracle.issuedAt(), a.issuedAt);
            assertTrue(oracle.used(a.requestId));
            assertFalse(oracle.submit(a, sig, REASON));
        }
    }

    function testChangingQuestionCannotBypassReplayOrMonotonicTime() public {
        AdamSplitOracle.Attestation memory a = report(5000, 3000, 2000);
        assertTrue(oracle.submit(a, signature(a, PK), REASON));
        uint64 firstIssued = a.issuedAt;
        vm.warp(vm.getBlockTimestamp() + 1 days);
        a.issuedAt = uint64(vm.getBlockTimestamp());
        a.questionHash = keccak256("next window");
        assertFalse(oracle.submit(a, signature(a, PK), REASON)); // Reused requestId, fresh valid signature.
        a.requestId = keccak256("new request");
        a.issuedAt = firstIssued;
        assertFalse(oracle.submit(a, signature(a, PK), REASON));
        a.issuedAt = firstIssued - 1;
        assertFalse(oracle.submit(a, signature(a, PK), REASON));
        a.issuedAt = uint64(vm.getBlockTimestamp());
        assertTrue(oracle.submit(a, signature(a, PK), REASON));
    }

    function testConstructorRejectsZeroSignerOrRelayer() public {
        vm.expectRevert(AdamSplitOracle.InvalidConfiguration.selector);
        new AdamSplitOracle(address(0), address(this), address(0));
        address attester = vm.addr(PK);
        vm.expectRevert(AdamSplitOracle.InvalidConfiguration.selector);
        new AdamSplitOracle(attester, address(0), address(0));
    }

    function testSubmissionAtExactAgeLimitAccepted() public {
        AdamSplitOracle.Attestation memory a = report(5000, 3000, 2000);
        a.issuedAt = uint64(vm.getBlockTimestamp() - 26 hours);
        assertTrue(oracle.submit(a, signature(a, PK), REASON));
        vm.warp(vm.getBlockTimestamp() + 1);
        assertFallback();
    }

    function assertFallback() internal view {
        (uint16[3] memory w, bytes32 id,, uint8 source) = oracle.currentSplit();
        assertEq(w[0], 3333);
        assertEq(w[1], 3333);
        assertEq(w[2], 3334);
        assertEq(id, 0);
        assertEq(source, 0);
    }

    function testSignedClampedReportAndAgeBoundary() public {
        assertFallback();
        AdamSplitOracle.Attestation memory a = report(8500, 1000, 500);
        assertTrue(oracle.submit(a, signature(a, PK), REASON));
        (uint16[3] memory w, bytes32 id, bytes32 reason, uint8 source) = oracle.currentSplit();
        assertEq(w[0], 7000);
        assertEq(w[1], 1500);
        assertEq(w[2], 1500);
        assertEq(id, a.requestId);
        assertEq(reason, keccak256(bytes(REASON)));
        assertEq(source, 1);
        vm.warp(vm.getBlockTimestamp() + 26 hours);
        (,,, source) = oracle.currentSplit();
        assertEq(source, 1);
        vm.warp(vm.getBlockTimestamp() + 1);
        assertFallback();
    }

    function testInvalidSignatureReasonTamperedQuestionAndChain() public {
        AdamSplitOracle.Attestation memory a = report(4000, 3000, 3000);
        assertFalse(oracle.submit(a, signature(a, 4321), REASON));
        assertFalse(oracle.submit(a, hex"1234", REASON));
        assertFalse(oracle.submit(a, signature(a, PK), "forged reason"));
        bytes memory sig = signature(a, PK);
        a.questionHash = keccak256("tampered");
        assertFalse(oracle.submit(a, sig, REASON));
        a.questionHash = QUESTION;
        a.chainId++;
        assertFalse(oracle.submit(a, signature(a, PK), REASON));
        assertFallback();
    }

    function testDomainReplayAndDuplicateCannotReplaceValidReport() public {
        AdamSplitOracle.Attestation memory a = report(4000, 3000, 3000);
        bytes memory sig = signature(a, PK);
        AdamSplitOracle other = new AdamSplitOracle(vm.addr(PK), address(this), address(0));
        assertFalse(other.submit(a, sig, REASON));
        assertTrue(oracle.submit(a, sig, REASON));
        assertFalse(oracle.submit(a, sig, REASON));
        a.requestId = keccak256("different");
        assertFalse(oracle.submit(a, signature(a, PK), REASON));
        (uint16[3] memory w,,, uint8 source) = oracle.currentSplit();
        assertEq(w[0], 4000);
        assertEq(source, 1);
    }

    function testBadTimesQuorumAndSumsFallBack() public {
        AdamSplitOracle.Attestation memory a = report(5000, 3000, 2000);
        a.issuedAt = uint64(vm.getBlockTimestamp() + 1);
        assertFalse(oracle.submit(a, signature(a, PK), REASON));
        a.issuedAt = uint64(vm.getBlockTimestamp() - 26 hours - 1);
        assertFalse(oracle.submit(a, signature(a, PK), REASON));
        a.issuedAt = uint64(vm.getBlockTimestamp());
        a.expiresAt = uint64(vm.getBlockTimestamp() - 1);
        assertFalse(oracle.submit(a, signature(a, PK), REASON));
        a.expiresAt = uint64(vm.getBlockTimestamp() + 1 days);
        a.agreed = 3;
        assertFalse(oracle.submit(a, signature(a, PK), REASON));
        a.agreed = 4;
        a.quorum = 3;
        assertFalse(oracle.submit(a, signature(a, PK), REASON));
        a.quorum = 4;
        a.panelSize = 3;
        assertFalse(oracle.submit(a, signature(a, PK), REASON));
        a = report(5000, 3000, 2001);
        assertFalse(oracle.submit(a, signature(a, PK), REASON));
        a = report(5000, 3000, 2000);
        a.toBlock = uint64(vm.getBlockNumber());
        assertFalse(oracle.submit(a, signature(a, PK), REASON));
        assertFallback();
    }

    function testMalformedAnswerNeverReverts() public {
        AdamSplitOracle.Attestation memory a = report(5000, 3000, 2000);
        a.answer = hex"01";
        assertFalse(oracle.submit(a, signature(a, PK), REASON));
        a.answer = new bytes(192);
        assertFalse(oracle.submit(a, signature(a, PK), REASON));
        a.answerType = 3;
        assertFalse(oracle.submit(a, signature(a, PK), REASON));
    }

    function testFuzzClampedWeightsAlwaysSumAndBound(uint16 x, uint16 y) public view {
        x = uint16(bound(x, 0, 10000));
        y = uint16(bound(y, 0, 10000 - x));
        uint16[3] memory w = oracle.clamp(x, y, 10000 - x - y);
        assertEq(uint256(w[0]) + w[1] + w[2], 10000);
        for (uint256 i; i < 3; ++i) {
            assertGe(w[i], 1500);
            assertLe(w[i], 7000);
        }
    }

    function testFuzzMalformedReport(bytes memory payload) public {
        AdamSplitOracle.Attestation memory a = report(5000, 3000, 2000);
        a.answer = payload;
        assertFalse(oracle.submit(a, hex"deadbeef", REASON));
    }
}

/// @notice Run the same success/failure suite against the website's explicit domain address.
contract AdamSplitOracleConfiguredDomainTest is AdamSplitOracleTest {
    function setUp() public override {
        super.setUp();
        oracle = new AdamSplitOracle(
            vm.addr(PK), address(this), address(uint160(0x0037bfb8ac7c960e558657871d41ca70e07e7dbfff))
        );
        assertTrue(oracle.domainVerifyingContract() != address(oracle));
    }

    function testConfiguredDomainRejectsImplicitSelfDomainSignature() public {
        AdamSplitOracle.Attestation memory a = report(5000, 3000, 2000);
        bytes memory sig = externalSignature(a, "IdentityMD Oracle", "2", vm.getChainId(), address(oracle));
        assertFalse(oracle.submit(a, sig, REASON));
        assertFallback();
    }
}
