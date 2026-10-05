// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ExtensionFixture} from "../utils/ExtensionFixture.sol";
import {AdamDistributorV2} from "../../src/AdamDistributorV2.sol";

/// @notice Independent audit checks of V2 cross-mode reserves and delegated staking.
contract AuditDistributorTest is ExtensionFixture {
    function testFuzzSwitchPreservesBothEmptyStakeBacklogs(uint64 beforeSwitch, uint64 afterSwitch) public {
        uint256 ethReserve = bound(beforeSwitch, 1 gwei, 1 ether);
        uint256 directBudget = bound(afterSwitch, 1 gwei, 1 ether);
        d2.notifyIMDSTR{value: ethReserve}(0);
        imdstr.setDistributor(address(d2), true);
        d2.enableDirectDistribution();
        uint256 tokenReserve = d2.notifyIMDSTR{value: directBudget}(1);
        assertEq(d2.unallocated(address(0)), ethReserve);
        assertEq(d2.unallocated(address(imdstr)), tokenReserve);

        stakeAlice(10_000_000e18);
        vm.warp(vm.getBlockTimestamp() + 7 days);
        uint256 ethDue = d2.earned(alice, address(0));
        uint256 tokenDue = d2.earned(alice, address(imdstr));
        assertApproxEqAbs(ethDue, ethReserve, 1);
        assertApproxEqAbs(tokenDue, tokenReserve, 1);

        vm.startPrank(alice);
        d2.claimReward(address(imdstr));
        assertEq(imdstr.balanceOf(alice), tokenDue);
        uint256 bought = d2.claimIMDSTR(ethDue, 1, block.timestamp);
        d2.unstake(10_000_000e18);
        vm.stopPrank();
        assertEq(imdstr.balanceOf(alice), tokenDue + bought);
        assertEq(address(d2).balance + d2.totalClaimed(address(0)), ethReserve);
        assertEq(imdstr.balanceOf(address(d2)) + d2.totalClaimed(address(imdstr)), tokenReserve);
        assertEq(d2.unallocated(address(0)), 0);
        assertEq(d2.unallocated(address(imdstr)), 0);
        assertEq(d2.totalStaked(), 0);
        assertEq(adam.balanceOf(address(d2)), 0);
    }

    function testFuzzStakeForCannotRedirectBeneficiaryPastRewards(uint96 gift) public {
        uint256 amount = bound(gift, 1, 10_000_000e18);
        stakeAlice(10_000_000e18);
        d2.notifyIMDSTR{value: 0.1 ether}(0);
        uint256 oldDue = d2.earned(alice, address(0));
        adam.approve(address(d2), amount);
        d2.stakeFor(alice, amount);
        assertEq(d2.earned(alice, address(0)), oldDue);
        assertEq(d2.earned(address(this), address(0)), 0);
        assertEq(d2.stakedBalance(address(this)), 0);
        assertEq(d2.stakedBalance(alice), 10_000_000e18 + amount);
        vm.expectRevert(AdamDistributorV2.InvalidSwap.selector);
        d2.claimIMDSTR(oldDue, 1, block.timestamp);
        vm.warp(d2.unlockTime(alice));
        vm.prank(alice);
        d2.unstake(10_000_000e18 + amount);
        assertEq(adam.balanceOf(alice), 100_000_000e18 + amount);
        assertEq(d2.earned(alice, address(0)), oldDue);
    }
}
