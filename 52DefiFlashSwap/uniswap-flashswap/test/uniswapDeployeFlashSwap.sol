// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.20;

import "forge-std/Test.sol";
import {IUniswapV2Router02} from "../lib/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {IUniswapV2Factory} from "../lib/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import {IUniswapV2Pair} from "../lib/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import {IERC20} from "../lib/v2-periphery/contracts/interfaces/IERC20.sol";
import {DeployDexAndPools} from "../script/deployDexAndPools.s.sol";
import {FlashSwap} from "../src/flashSwap.sol";
import {TokenA} from "../src/TokenA.sol";
import {TokenB} from "../src/TokenB.sol";

contract DeployDexAndPoolsTest is Test {
    DeployDexAndPools public deployer;
    IUniswapV2Factory public factoryX;
    IUniswapV2Router02 public routerX;
    IUniswapV2Factory public factoryY;
    IUniswapV2Router02 public routerY;
    address public tokenA;
    address public tokenB;
    address public wethX;
    address public wethY;

    // 虚拟用户
    address public bob;
    address public alice;

    function setUp() public {
        deployer = new DeployDexAndPools();
        deployer.run();
        factoryX = IUniswapV2Factory(deployer.factoryX());
        routerX  = IUniswapV2Router02(deployer.routerX());
        factoryY = IUniswapV2Factory(deployer.factoryY());
        routerY  = IUniswapV2Router02(deployer.routerY());
        tokenA = deployer.tokenA();
        tokenB = deployer.tokenB();
        wethX = deployer.wethX();
        wethY = deployer.wethY();

        // 虚拟用户
        bob = deployer.name("bob");
        alice = deployer.name("alice");
        // 给他们一点token
        TokenA(tokenA).mint(bob, 100 ether);
        TokenA(tokenA).mint(alice, 100 ether);
    }

    function check() internal view {
        address pairX = IUniswapV2Factory(factoryX).getPair(tokenA, tokenB);
        address pairY = IUniswapV2Factory(factoryY).getPair(tokenA, tokenB);
        (uint rxA, uint rxB, ) = IUniswapV2Pair(pairX).getReserves();
        (uint ryA, uint ryB, ) = IUniswapV2Pair(pairY).getReserves();
        console.log("dexX reserves: A=", rxA, ", B=", rxB);
        console.log("dexY reserves: A=", ryA, ", B=", ryB);
    }

    function test_factoryXDeployed() public view {
        assert(factoryX.feeToSetter() != address(0));
    }

    function test_routerXDeployed() public view {
        assert(routerX.WETH() != address(0));
    }

    function test_factoryYDeployed() public view {
        assert(factoryY.feeToSetter() != address(0));
    }

    function test_routerYDeployed() public view {
        assert(routerY.WETH() != address(0));
    }

    function test_swapDexXReserveChange() public {
        // 1. 获取Pair地址
        address pairX = factoryX.getPair(tokenA, tokenB);

        // 2. 记录初始储备
        (uint reserveA_before, uint reserveB_before, ) = IUniswapV2Pair(pairX).getReserves();

        // 3. 用bob账户给池子授权
        vm.startPrank(bob);
        IERC20(tokenA).approve(address(routerX), type(uint256).max);

        // 4. bob用10 TokenA换TokenB
        uint amountIn = 10 ether;
        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;
        uint[] memory amounts = routerX.swapExactTokensForTokens(
            amountIn,
            0, // 最小接收
            path,
            bob,
            block.timestamp
        );
        vm.stopPrank();

        // 5. 记录兑换后储备
        (uint reserveA_after, uint reserveB_after, ) = IUniswapV2Pair(pairX).getReserves();

        // 6. 打印关键数据
        console.log("swapDexX: amountIn =", amountIn);
        console.log("swapDexX: amountOut =", amounts[1]);
        console.log("swapDexX: reserveA before =", reserveA_before, ", after =", reserveA_after);
        console.log("swapDexX: reserveB before =", reserveB_before, ", after =", reserveB_after);

        // 7. 检查储备变化
        assertEq(reserveA_after, reserveA_before + amountIn);
        assertEq(reserveB_after, reserveB_before - amounts[1]);

        // 打印池子变化
        check();
    }

    function test_swapDexYReserveChange() public {
        // 1. 获取Pair地址
        address pairY = factoryY.getPair(tokenA, tokenB);

        // 2. 记录初始储备
        (uint reserveA_before, uint reserveB_before, ) = IUniswapV2Pair(pairY).getReserves();

        // 3. 用alice账户给池子授权
        vm.startPrank(alice);
        IERC20(tokenA).approve(address(routerY), type(uint256).max);

        // 4. alice用1000 TokenA换TokenB
        uint amountIn = 10 ether;
        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;
        uint[] memory amounts = routerY.swapExactTokensForTokens(
            amountIn,
            0, // 最小接收
            path,
            alice,
            block.timestamp
        );
        vm.stopPrank();

        // 5. 记录兑换后储备
        (uint reserveA_after, uint reserveB_after, ) = IUniswapV2Pair(pairY).getReserves();

        // 6. 打印关键数据
        console.log("swapDexY: amountIn =", amountIn);
        console.log("swapDexY: amountOut =", amounts[1]);
        console.log("swapDexY: reserveA before =", reserveA_before, ", after =", reserveA_after);
        console.log("swapDexY: reserveB before =", reserveB_before, ", after =", reserveB_after);

        // 7. 检查储备变化
        assert(reserveA_after == reserveA_before + amountIn);
        assert(reserveB_after == reserveB_before - amounts[1]);

        // 打印池子变化
        check();
    }

    /*
    dexX添加流动性 10000A:1500B
    dexY添加流动性 10000A:1000B
    */
    function test_flashSwap_arbitrage() public {
        vm.startPrank(bob);
        // uniswapV2Call(address sender, uint amount0, uint amount1, bytes calldata data)
        // 1. 部署FlashSwap合约，套利方向：在factoryY借TokenA，在routerX卖TokenA换TokenB
        FlashSwap flash = new FlashSwap(address(factoryY), address(routerY), address(routerX));

        // 2. 获取Pair地址（factoryY的TokenA-TokenB池）
        address pairY = factoryY.getPair(tokenA, tokenB);

        // 3. 记录套利前TokenB余额
        uint before = IERC20(tokenB).balanceOf(bob);
        check();

        // 4. 执行闪电兑换，借1 ether
        flash.flashSwap(pairY, tokenA, 1 ether);
        check();
        
        // 5. 记录套利后TokenB余额
        uint after_ = IERC20(tokenB).balanceOf(bob);
        
        // 6. 断言套利成功
        assert(after_ > before);

        vm.stopPrank();
    }

} 