// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.20;

import {Script} from "../lib/forge-std/src/Script.sol";
import {StdCheats} from "../lib/forge-std/src/StdCheats.sol";
import {console} from "forge-std/console.sol";

import {TokenA} from "../src/TokenA.sol";
import {TokenB} from "../src/TokenB.sol";
import {IERC20} from "../lib/v2-periphery/contracts/interfaces/IERC20.sol";
import {IUniswapV2Router02} from "../lib/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {IUniswapV2Factory} from "../lib/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import {IUniswapV2Pair} from "../lib/v2-core/contracts/interfaces/IUniswapV2Pair.sol";


contract DeployDexAndPools is Script, StdCheats {
    address public tokenA;
    address public tokenB;
    address public factoryX;
    address public factoryY;
    address public routerX;
    address public routerY;
    address public wethX;
    address public wethY;
    address public feeToSetterX;
    address public feeToSetterY;

    function name(string memory _in) public pure returns (address) {
        return vm.addr(uint256(keccak256(abi.encodePacked(_in))));
    }

    function run() public {
        vm.startBroadcast();
        // 1. 部署TokenA和TokenB
        tokenA = address(new TokenA());
        tokenB = address(new TokenB());
        // 2. 部署dexX
        feeToSetterX = name("feeToSetterX");
        factoryX = name("factoryX");
        deployCodeTo(
            "UniswapV2Factory.sol:UniswapV2Factory",
            abi.encode(feeToSetterX),
            factoryX
        );
        wethX = name("wethX");
        deployCodeTo(
            "WETH9.sol:WETH9",
            "",
            wethX
        );
        routerX = name("routerX");
        deployCodeTo(
            "UniswapV2Router02.sol:UniswapV2Router02",
            abi.encode(factoryX, wethX),
            routerX
        );
        // 3. 部署dexY
        feeToSetterY = name("feeToSetterY");
        factoryY = name("factoryY");
        deployCodeTo(
            "UniswapV2Factory.sol:UniswapV2Factory",
            abi.encode(feeToSetterY),
            factoryY
        );
        wethY = name("wethY");
        deployCodeTo(
            "WETH9.sol:WETH9",
            "",
            wethY
        );
        routerY = name("routerY");
        deployCodeTo(
            "UniswapV2Router02.sol:UniswapV2Router02",
            abi.encode(factoryY, wethY),
            routerY
        );
        // 4. 给路由授权
        IERC20(tokenA).approve(routerX, type(uint256).max);
        IERC20(tokenB).approve(routerX, type(uint256).max);
        IERC20(tokenA).approve(routerY, type(uint256).max);
        IERC20(tokenB).approve(routerY, type(uint256).max);
        // 5. dexX添加流动性 10000A:2000B
        IUniswapV2Router02(routerX).addLiquidity(
            tokenA,
            tokenB,
            10000 ether,
            2000 ether,
            0,
            0,
            msg.sender,
            block.timestamp + 600
        );
        // 6. dexY添加流动性 10000A:1000B
        IUniswapV2Router02(routerY).addLiquidity(
            tokenA,
            tokenB,
            10000 ether,
            1000 ether,
            0,
            0,
            msg.sender,
            block.timestamp + 600
        );
        vm.stopBroadcast();
        // console.log("TokenA:", tokenA);
        // console.log("TokenB:", tokenB);
        // console.log("dexX Factory:", factoryX);
        // console.log("dexX Router:", routerX);
        // console.log("dexY Factory:", factoryY);
        // console.log("dexY Router:", routerY);
        // 打印池子储备
        // address pairX = IUniswapV2Factory(factoryX).getPair(tokenA, tokenB);
        // address pairY = IUniswapV2Factory(factoryY).getPair(tokenA, tokenB);
        // (uint rxA, uint rxB, ) = IUniswapV2Pair(pairX).getReserves();
        // (uint ryA, uint ryB, ) = IUniswapV2Pair(pairY).getReserves();
        // console.log("dexX reserves: A=", rxA, ", B=", rxB);
        // console.log("dexY reserves: A=", ryA, ", B=", ryB);
    }
} 