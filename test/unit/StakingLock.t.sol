// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {LaunchToken} from "../../src/LaunchToken.sol";
import {AdamDistributor} from "../../src/AdamDistributor.sol";
import {AdamDistributorV2} from "../../src/AdamDistributorV2.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

abstract contract StakingLockFixture is Test {
    LaunchToken internal adam;
    AdamDistributorV2 internal dist;
    MockERC20 internal reward;
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public virtual {
        vm.warp(1_800_000_000);
        adam = new LaunchToken();
        reward = new MockERC20("IMD", "IMD", 18);
        MockERC20 second = new MockERC20("PNKSTR", "PNKSTR", 18);
        PoolKey memory key =
            PoolKey(Currency.wrap(address(0)), Currency.wrap(address(0x1234)), 0, 60, IHooks(address(0)));
        dist = new AdamDistributorV2(
            address(adam), address(reward), address(second), address(0x5678), address(0), key, 1 ether
        );
        adam.transfer(alice, 100e18);
        vm.prank(alice);
        adam.approve(address(dist), 100e18);
        adam.approve(address(dist), 100e18);
        reward.mint(address(this), 100e18);
        reward.approve(address(dist), 100e18);
    }

    function _stake(uint256 amount) internal {
        vm.prank(alice);
        dist.stake(amount);
    }

    function _locked(bool exitAll, uint256 amount, uint256 until) internal {
        vm.expectRevert(abi.encodeWithSelector(AdamDistributorV2.StakeLocked.selector, alice, until));
        vm.prank(alice);
        if (exitAll) dist.exit();
        else dist.unstake(amount);
    }
}

contract StakingLockTest is StakingLockFixture {
    function testUnstakeAndExitBlockedUntilExactBoundary() public {
        assertEq(dist.unlockTime(alice), 0);
        _stake(50e18);
        uint256 until = vm.getBlockTimestamp() + 24 hours;
        assertEq(dist.unlockTime(alice), until);
        _locked(false, 1, until);
        _locked(true, 0, until);
        vm.warp(until - 1);
        _locked(false, 50e18, until);
        _locked(true, 0, until);
        assertEq(dist.stakedBalance(alice), 50e18);
        assertEq(adam.balanceOf(alice), 50e18);
        vm.warp(until);
        vm.prank(alice);
        dist.unstake(25e18);
        assertEq(dist.unlockTime(alice), until, "partial withdrawal does not relock");
        vm.prank(alice);
        dist.exit();
        assertEq(adam.balanceOf(alice), 100e18);
        assertEq(dist.totalStaked(), 0);
    }

    function testClaimsDuringLockDoNotChangeDeadlineOrPrincipal() public {
        _stake(50e18);
        uint256 until = dist.unlockTime(alice);
        dist.notifyReward(address(reward), 10e18);
        vm.prank(alice);
        dist.claim();
        assertApproxEqAbs(reward.balanceOf(alice), 10e18, 1);
        vm.warp(until - 1);
        dist.notifyReward(address(reward), 10e18);
        vm.prank(alice);
        dist.claimReward(address(reward));
        assertApproxEqAbs(reward.balanceOf(alice), 20e18, 2);
        assertEq(dist.unlockTime(alice), until);
        assertEq(dist.stakedBalance(alice), 50e18);
        _locked(true, 0, until);
    }

    function testRejectedAndZeroStakesDoNotResetLock() public {
        _stake(50e18);
        uint256 until = dist.unlockTime(alice);
        vm.warp(until - 1);
        vm.expectRevert(AdamDistributor.ZeroAmount.selector);
        vm.prank(alice);
        dist.stake(0);
        vm.expectRevert(AdamDistributor.ZeroAmount.selector);
        dist.stakeFor(alice, 0);
        vm.prank(bob);
        vm.expectRevert();
        dist.stakeFor(alice, 1);
        vm.prank(alice);
        adam.approve(address(dist), 0);
        vm.prank(alice);
        vm.expectRevert();
        dist.stake(1);
        assertEq(dist.unlockTime(alice), until);
        assertEq(dist.stakedBalance(alice), 50e18);
    }

    function testNewStakeAfterFullExitLocksAgain() public {
        _stake(50e18);
        vm.warp(dist.unlockTime(alice));
        vm.prank(alice);
        dist.exit();
        _stake(1);
        uint256 until = vm.getBlockTimestamp() + 24 hours;
        assertEq(dist.unlockTime(alice), until);
        _locked(false, 1, until);
        vm.prank(bob);
        dist.exit(); // An account with no principal can still settle rewards.
    }

    function testFuzzTopUpResetsWholeWalletLock(uint32 elapsed, uint96 topUp, bool delegated, bool exitAll) public {
        uint256 amount = bound(topUp, 1, 50e18);
        uint256 delay = bound(elapsed, 1, 3 days);
        _stake(50e18);
        uint256 oldUntil = dist.unlockTime(alice);
        vm.warp(vm.getBlockTimestamp() + delay);
        if (delegated) dist.stakeFor(alice, amount);
        else _stake(amount);
        uint256 until = vm.getBlockTimestamp() + 24 hours;
        assertEq(dist.unlockTime(alice), until);
        assertGt(until, oldUntil);
        assertEq(dist.unlockTime(address(this)), 0, "stakeFor locks beneficiary only");
        assertEq(dist.unlockTime(bob), 0);
        vm.warp(until - 1);
        _locked(exitAll, 50e18 + amount, until);
        vm.warp(until);
        vm.prank(alice);
        if (exitAll) dist.exit();
        else dist.unstake(50e18 + amount);
        assertEq(adam.balanceOf(alice), 100e18 + (delegated ? amount : 0));
        assertEq(dist.totalStaked(), 0);
        assertEq(adam.balanceOf(address(dist)), 0);
    }
}
