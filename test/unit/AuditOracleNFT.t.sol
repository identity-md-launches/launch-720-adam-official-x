// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AdamSplitOracleTest} from "./AdamSplitOracle.t.sol";
import {ExtensionFixture} from "../utils/ExtensionFixture.sol";
import {AdamSplitOracle} from "../../src/AdamSplitOracle.sol";
import {NFTClaim} from "../../src/NFTClaim.sol";

/// @notice Independent audit coverage of signed-field integrity and exact expiration semantics.
contract AuditOracleTest is AdamSplitOracleTest {
    function testExpiryBoundaryAndRejectedReportPreserveActiveState() public {
        AdamSplitOracle.Attestation memory a = report(4000, 3000, 3000);
        a.expiresAt = uint64(block.timestamp + 60);
        assertTrue(oracle.submit(a, signature(a, PK), REASON));
        vm.warp(a.expiresAt);
        (,,, uint8 source) = oracle.currentSplit();
        assertEq(source, 1);
        a.requestId = keccak256("replacement");
        a.issuedAt = uint64(block.timestamp);
        a.expiresAt = uint64(block.timestamp + 60);
        assertFalse(oracle.submit(a, signature(a, 4321), REASON));
        (, bytes32 acceptedId,,) = oracle.currentSplit();
        assertEq(acceptedId, bytes32(uint256(1)));
        vm.warp(block.timestamp + 1);
        assertFallback();
    }

    function testSignedPanelAndBlockFieldsCannotBeTampered() public {
        AdamSplitOracle.Attestation memory a = report(4000, 3000, 3000);
        bytes memory sig = signature(a, PK);
        a.panelJobId = keccak256("tampered");
        assertFalse(oracle.submit(a, sig, REASON));
        a = report(4000, 3000, 3000);
        a.blockHash = keccak256("tampered");
        assertFalse(oracle.submit(a, sig, REASON));
        a = report(4000, 3000, 3000);
        a.agreed = 5;
        assertFalse(oracle.submit(a, sig, REASON));
        a = report(4000, 3000, 3000);
        a.figure = 1;
        assertFalse(oracle.submit(a, sig, REASON));
        assertFallback();
    }

    function testChangedChainRejectsPreviouslySignedReport() public {
        AdamSplitOracle.Attestation memory a = report(4000, 3000, 3000);
        bytes memory sig = signature(a, PK);
        vm.chainId(block.chainid + 1);
        a.chainId = block.chainid;
        assertFalse(oracle.submit(a, sig, REASON));
        assertTrue(oracle.submit(a, signature(a, PK), REASON));
    }
}

/// @notice Independent audit coverage: successive owners cannot reset a token's consumed vesting.
contract AuditNFTTest is ExtensionFixture {
    function testFuzzTransferMidVestingConservesAllocation(uint8 firstDay, uint8 secondDay, bool stakeSecond) public {
        uint256 first = bound(firstDay, 0, 8);
        uint256 second = bound(secondDay, first + 1, 9);
        uint256 allocation = nftClaim.share(0, 0);
        vm.warp(nftClaim.launch() + first * 1 days);
        uint256 aliceBefore = adam.balanceOf(alice);
        vm.prank(alice);
        nftClaim.claim(0, ids(0));
        uint256 firstClaim = adam.balanceOf(alice) - aliceBefore;
        assertEq(firstClaim, allocation * (first + 1) / 10);
        vm.prank(alice);
        nft.transferFrom(alice, bob, 0);
        vm.warp(nftClaim.launch() + second * 1 days);
        vm.prank(alice);
        vm.expectRevert(NFTClaim.NotOwner.selector);
        nftClaim.claim(0, ids(0));
        uint256 bobBefore = adam.balanceOf(bob);
        vm.prank(bob);
        if (stakeSecond) nftClaim.claimAndStake(0, ids(0));
        else nftClaim.claim(0, ids(0));
        uint256 secondClaim = stakeSecond ? d2.stakedBalance(bob) : adam.balanceOf(bob) - bobBefore;
        assertEq(firstClaim + secondClaim, allocation * (second + 1) / 10);
        vm.warp(nftClaim.deadline() - 1);
        vm.prank(bob);
        if (second < 9) {
            nftClaim.claim(0, ids(0));
        } else {
            vm.expectRevert(NFTClaim.NothingUnlocked.selector);
            nftClaim.claim(0, ids(0));
        }
        assertEq(nftClaim.claimed(0, 0), allocation);
        assertEq(adam.allowance(address(nftClaim), address(d2)), 0);
    }

    function testAnyoneBurnsOnlyRemainingBalanceAtExactDeadline() public {
        vm.warp(nftClaim.deadline() - 1);
        vm.prank(alice);
        nftClaim.claimAndStake(0, ids(0));
        uint256 staked = d2.stakedBalance(alice);
        uint256 remaining = adam.balanceOf(address(nftClaim));
        vm.warp(nftClaim.deadline());
        assertEq(nftClaim.claimable(0, 1), 0);
        vm.prank(address(0x1234));
        nftClaim.burnUnclaimed();
        assertEq(adam.balanceOf(nftClaim.DEAD()), remaining);
        assertEq(d2.stakedBalance(alice), staked);
        assertEq(adam.balanceOf(address(nftClaim)), 0);
    }
}
