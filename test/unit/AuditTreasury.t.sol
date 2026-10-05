// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ExtensionFixture} from "../utils/ExtensionFixture.sol";
import {AdamTreasuryV2} from "../../src/AdamTreasuryV2.sol";
import {IAdamDistributor} from "../../src/interfaces/IAdamDistributor.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";

contract AuditDeferredKeeper {
    function process(AdamTreasuryV2 treasury) external {
        treasury.process();
    }

    function claim(AdamTreasuryV2 treasury, address payable recipient) external {
        treasury.claimKeeper(recipient);
    }
}

/// @notice Independent review regressions for atomic leg execution and repeated liability reservation.
contract AuditTreasuryTest is ExtensionFixture {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    function testRewardCreditFailureRollsBackBuyAndPreservesOtherLegs() public {
        stakeAlice(100_000_000e18);
        (uint160 priceBefore,,,) = IPoolManager(address(poolManager)).getSlot0(imdKey.toId());
        uint256 tokenBefore = imd.balanceOf(address(poolManager));
        vm.mockCallRevert(
            address(d2),
            abi.encodeWithSelector(IAdamDistributor.notifyReward.selector, address(imd)),
            abi.encodeWithSignature("Error(string)", "reward credit unavailable")
        );
        fundTreasury(1 ether);
        t2.process();
        (uint160 priceAfter,,,) = IPoolManager(address(poolManager)).getSlot0(imdKey.toId());
        assertEq(priceAfter, priceBefore, "failed credit must undo price movement");
        assertEq(imd.balanceOf(address(poolManager)), tokenBefore, "failed credit must undo token take");
        assertEq(imd.balanceOf(address(t2)), 0);
        assertEq(imd.allowance(address(t2), address(d2)), 0);
        assertEq(t2.leg(0).pending, 0.8955 ether * 3333 / 10000);
        assertEq(t2.leg(0).failures, 1);
        assertGt(d2.earned(alice, address(pnkstr)), 0);
        assertGt(d2.earned(alice, address(0)), 0);
        assertEq(t2.unsplitEth(), 0);
        vm.clearMockedCalls();
        vm.warp(block.timestamp + t2.cooldown());
        t2.process();
        assertGt(d2.earned(alice, address(imd)), 0);
        assertEq(t2.leg(0).failures, 0);
        assertEq(imd.allowance(address(t2), address(d2)), 0);
    }

    function testFuzzDeferredKeeperDebtSurvivesRepeatedFailuresAndRecovery(uint96 funding) public {
        uint256 value = bound(funding, 1 gwei, 1 ether);
        stakeAlice(100_000_000e18);
        AuditDeferredKeeper keeper = new AuditDeferredKeeper();
        uint256 managerBefore = address(poolManager).balance;
        pnkstrHook.setRevertSwaps(true);
        uint256 totalFunded;
        for (uint256 i; i < 3; ++i) {
            fundTreasury(value);
            totalFunded += value;
            keeper.process(t2);
            assertEq(t2.totalKeeperOwed(), (i + 1) * (value * 50 / 10000));
            assertEq(t2.keeperOwed(address(keeper)), t2.totalKeeperOwed());
            assertEq(t2.unsplitEth(), 0);
            _assertLiabilities();
            vm.warp(block.timestamp + t2.cooldown());
        }
        pnkstrHook.setRevertSwaps(false);
        uint256 debt = t2.totalKeeperOwed();
        // No new ETH: a recovery attempt must not pay another keeper bounty.
        if (t2.leg(0).pending + t2.leg(1).pending + t2.leg(2).pending != 0) keeper.process(t2);
        assertEq(t2.totalKeeperOwed(), debt);
        uint256 recipientBefore = bob.balance;
        keeper.claim(t2, payable(bob));
        assertEq(bob.balance - recipientBefore, debt);
        assertEq(t2.totalKeeperOwed(), 0);
        _assertLiabilities();
        assertEq(
            address(t2).balance + address(d2).balance + address(poolManager).balance - managerBefore + debt,
            totalFunded,
            "all funded ETH remains accounted for through failure and recovery"
        );
    }

    function _assertLiabilities() private view {
        assertEq(
            address(t2).balance,
            t2.unsplitEth() + t2.teamOwed() + t2.totalKeeperOwed() + t2.leg(0).pending + t2.leg(1).pending
                + t2.leg(2).pending
        );
    }
}
