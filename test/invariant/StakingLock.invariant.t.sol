// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {StakingLockFixture} from "../unit/StakingLock.t.sol";
import {AdamDistributorV2} from "../../src/AdamDistributorV2.sol";
import {LaunchToken} from "../../src/LaunchToken.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

contract StakingLockHandler is Test {
    AdamDistributorV2 public immutable dist;
    LaunchToken public immutable adam;
    MockERC20 public immutable reward;
    address public immutable actor;
    uint256 public principal;
    uint256 public lastStake;
    uint256 public notified;

    constructor(AdamDistributorV2 d, LaunchToken a, MockERC20 r, address who) {
        dist = d;
        adam = a;
        reward = r;
        actor = who;
        vm.prank(who);
        a.approve(address(d), type(uint256).max);
        a.approve(address(d), type(uint256).max);
        r.approve(address(d), type(uint256).max);
    }

    function stake(uint96 value, bool gift) public {
        address funder = gift ? address(this) : actor;
        uint256 balance = adam.balanceOf(funder);
        if (balance == 0) return;
        uint256 amount = bound(value, 1, balance);
        if (gift) {
            dist.stakeFor(actor, amount);
        } else {
            vm.prank(actor);
            dist.stake(amount);
        }
        principal += amount;
        lastStake = vm.getBlockTimestamp();
    }

    function withdraw(uint96 value, bool exitAll) public {
        if (principal == 0) return;
        uint256 amount = exitAll ? principal : bound(value, 1, principal);
        if (vm.getBlockTimestamp() < lastStake + 24 hours) {
            vm.expectRevert(abi.encodeWithSelector(AdamDistributorV2.StakeLocked.selector, actor, lastStake + 24 hours));
        } else {
            principal -= amount;
        }
        vm.prank(actor);
        if (exitAll) dist.exit();
        else dist.unstake(amount);
    }

    function claimAndFund(uint96 value, bool perAsset) public {
        uint256 amount = bound(value, 1e6, 1e24);
        reward.mint(address(this), amount);
        dist.notifyReward(address(reward), amount);
        notified += amount;
        uint256 due = dist.earned(actor, address(reward));
        if (perAsset && due == 0) return;
        uint256 beforeBalance = reward.balanceOf(actor);
        vm.prank(actor);
        if (perAsset) dist.claimReward(address(reward));
        else dist.claim();
        assertEq(reward.balanceOf(actor) - beforeBalance, due);
    }

    function elapse(uint32 seconds_) public {
        vm.warp(vm.getBlockTimestamp() + bound(seconds_, 0, 2 days));
    }
}

/// forge-config: default.invariant.runs = 256
/// forge-config: default.invariant.depth = 64
/// forge-config: default.invariant.fail-on-revert = true
contract StakingLockInvariantTest is StakingLockFixture {
    StakingLockHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new StakingLockHandler(dist, adam, reward, alice);
        adam.transfer(address(handler), 100e18);
        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = handler.stake.selector;
        selectors[1] = handler.withdraw.selector;
        selectors[2] = handler.claimAndFund.selector;
        selectors[3] = handler.elapse.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector(address(handler), selectors));
    }

    function invariantLockPrincipalAndRewards() public view {
        assertEq(dist.stakedBalance(alice), handler.principal());
        assertEq(dist.totalStaked(), handler.principal());
        assertEq(adam.balanceOf(address(dist)), handler.principal());
        assertEq(adam.balanceOf(alice) + adam.balanceOf(address(handler)) + handler.principal(), 200e18);
        assertEq(dist.unlockTime(alice), handler.lastStake() == 0 ? 0 : handler.lastStake() + 24 hours);
        assertEq(reward.balanceOf(address(dist)) + reward.balanceOf(alice), handler.notified());
        assertLe(dist.earned(alice, address(reward)), reward.balanceOf(address(dist)));
    }

    function afterInvariant() public {
        handler.elapse(2 days);
        handler.withdraw(0, true);
        assertEq(dist.totalStaked(), 0);
        invariantLockPrincipalAndRewards();
    }
}
