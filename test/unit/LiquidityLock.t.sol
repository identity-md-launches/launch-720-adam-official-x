// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {DeployAdam} from "../../script/DeployAdam.s.sol";
import {LaunchToken} from "../../src/LaunchToken.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";

/// @notice Offline checks of the script's exact mint payload and allocation limits; real periphery is tested on fork.
contract LiquidityLockTest is Test {
    DeployAdam internal script;
    DeployAdam.Config internal cfg;
    DeployAdam.Deployment internal d;

    function setUp() public {
        script = DeployAdam(deployCode("DeployAdam.s.sol:DeployAdam"));
        d.token = new LaunchToken();
        cfg = script.mainnetConfig(address(script), address(0x1234), address(script), address(d.token));
        cfg.treasury = address(0x5678);
        d.key = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(d.token)), 0, 60, IHooks(address(0)));
        d.token.transfer(address(script), 890_000_000e18);
    }

    function testDefaultReservesElevenPercentForNFTClaim() public view {
        assertEq(cfg.liquidityAdam, 890_000_000e18);
        assertEq(script.LP_RECIPIENT(), 0x000000000000000000000000000000000000dEaD);
    }

    function testFuzzHookOnlyMintsDirectlyToDead(uint96 allocation) public {
        cfg.liquidityAdam = bound(allocation, 1e18, 890_000_000e18);
        uint160 price = TickMath.getSqrtPriceAtTick(cfg.initialTick);
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmount1(
            TickMath.getSqrtPriceAtTick(cfg.lowerTick), price, cfg.liquidityAdam
        );
        bytes memory actions = abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(
            d.key,
            cfg.lowerTick,
            cfg.initialTick,
            uint256(liquidity),
            uint128(0),
            uint128(cfg.liquidityAdam),
            address(0xdead),
            ""
        );
        params[1] = abi.encode(d.key.currency0, d.key.currency1);
        bytes memory mint = abi.encodeCall(
            IPositionManager.modifyLiquidities, (abi.encode(actions, params), block.timestamp + 1 hours)
        );
        vm.mockCall(
            cfg.poolManager, abi.encodeCall(IPoolManager.initialize, (d.key, price)), abi.encode(cfg.initialTick)
        );
        vm.mockCall(cfg.permit2, abi.encodeWithSelector(IAllowanceTransfer.approve.selector), "");
        vm.mockCall(cfg.positionManager, mint, "");
        vm.expectCall(cfg.positionManager, mint, 1);
        (uint160 actualPrice, uint128 actualLiquidity) = script.launchPool(cfg, d);
        assertEq(actualPrice, price);
        assertEq(actualLiquidity, liquidity);
    }

    function testFuzzCannotIncreaseHookOnlyAllocation(uint128 excess) public {
        cfg.liquidityAdam = 890_000_000e18 + bound(excess, 1, type(uint128).max - 890_000_000e18);
        bytes memory reason = abi.encodeWithSelector(DeployAdam.InvalidLiquidityAmount.selector, cfg.liquidityAdam);
        vm.expectRevert(reason);
        script.deployContracts(cfg);
        vm.expectRevert(reason);
        script.launchPool(cfg, d);
    }

    function testZeroAndInsufficientAllocationRevert() public {
        cfg.liquidityAdam = 0;
        vm.expectRevert(abi.encodeWithSelector(DeployAdam.InvalidLiquidityAmount.selector, 0));
        script.deployContracts(cfg);
        vm.expectRevert(abi.encodeWithSelector(DeployAdam.InvalidLiquidityAmount.selector, 0));
        script.launchPool(cfg, d);
        cfg.liquidityAdam = 890_000_000e18;
        vm.prank(address(script));
        d.token.transfer(address(this), 1);
        vm.expectRevert(
            abi.encodeWithSelector(
                DeployAdam.InsufficientAdamForLiquidity.selector, cfg.liquidityAdam - 1, cfg.liquidityAdam
            )
        );
        script.launchPool(cfg, d);
    }
}
