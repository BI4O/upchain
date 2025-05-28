// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.20;

import {IUniswapV2Callee} from "../lib/v2-core/contracts/interfaces/IUniswapV2Callee.sol";
import {IUniswapV2Factory} from "../lib/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import {IUniswapV2Pair} from "../lib/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import {IUniswapV2Router02} from "../lib/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {IERC20} from "../lib/v2-periphery/contracts/interfaces/IERC20.sol";
import {UniswapV2Library} from "../src/newLibrary.sol";

import {console} from "forge-std/console.sol";

// 把这个合约当成pair.swap的to的钱包
contract FlashSwap is IUniswapV2Callee {
    address public immutable factoryX;
    address public immutable routerX;
    address public immutable routerY; // 另一个dex的交互
    address public immutable owner;

    constructor(address _factoryX, address _routerX, address _routerY) {
        factoryX = _factoryX; // 用来检查
        routerX = _routerX;   // 
        routerY = _routerY;
        owner = msg.sender;
    }
    

    // 在合约内
    function flashSwap(address pair, address borrowToken, uint borrowAmount) external {
        address token0 = IUniswapV2Pair(pair).token0();
        if(borrowToken == token0) {
            IUniswapV2Pair(pair).swap(borrowAmount, 0, address(this), new bytes(0x01)); // data.length > 0 触发callee
        }else{
            IUniswapV2Pair(pair).swap(0, borrowAmount, address(this), new bytes(0x01)); // data.length > 0 触发callee
        }
    }

    /*
    pair.swap时候会帮忙执行的逻辑:
    IUniSwapV2Pair(pairAddr).swap()
    function swap(
        uint amount0Out, 
        uint amount1Out, 
        address to, 
        bytes calldata data
    ) external;
    这个swap就是看你要这个pair里面的0或者1的token
    1. pair先给to转amount0Out个token0或amount1Out个token1
    2. 然后内部参数直接调用
    IUniswapV2Callee(to).uniswapV2Call(msg.sender, amount0out, amount1out, data)
    3. 调用了to的uniswapV2Call之后就开始检查require(amount0In > 0 || amount1In > 0)
    4. 检查通过了才会update确认成交

    所以你在uniswapV2Call里要确认收到token0之后给pair转对应的token1
    */
    function uniswapV2Call(
        address sender,
        uint amount0,
        uint amount1,
        bytes calldata data
    ) external override {
        sender; amount0; amount1; data; // 防止warning
        // 得到两个token的地址
        address token0 = IUniswapV2Pair(msg.sender).token0();
        address token1 = IUniswapV2Pair(msg.sender).token1();
        // 查一下余额，看步骤1中，pair给本合约转了多少token，一般来说就是amoun0或者amount1
        uint balance0 = IERC20(token0).balanceOf(address(this));
        uint balance1 = IERC20(token1).balanceOf(address(this));

        address[] memory path = new address[](2);
        uint amountRequired;

        // 如果收到的是token0，那就去换token1
        if (balance0 > 0) {
            console.log('balance0 > 0', balance0);
            // 交易所一
            // 计算一下本交易所 1 -> 0 用balance0做结果需要几个token1
            path[0] = token1;
            path[1] = token0;      
            // 指定out是balance0个token0，算一下需要token1的数量，已经算了手续费了
            amountRequired = IUniswapV2Router02(routerX).getAmountsIn(balance0, path)[0];
                
            // 交易所二
            // 授权另一个交易所的router无限量拿我的token0
            IERC20(token0).approve(routerY, type(uint256).max);            
            path[0] = token0;
            path[1] = token1;
            // 开始兑换 0 -> 1
            uint[] memory amounts = IUniswapV2Router02(routerY).swapExactTokensForTokens(
                balance0,  /* 给多少 */
                0,         /* 最少得多少 */
                path,      /* 0->1: [token0,token1]*/
                address(this), 
                block.timestamp
            );
            // 收到了多少个
            uint amountReceived = amounts[1];
            console.log('amountRequired', amountRequired);
            console.log('amountReceived', amountReceived);
            // 保证交易所二得到的token1要多于交易所一得到的token1
            require(amountReceived >= amountRequired);
            IERC20(token1).transfer(msg.sender, amountRequired);
            // 结束，获利多余的token1，后面会检查K是否恒定或变大，否则revert
            IERC20(token1).transfer(owner, amountReceived - amountRequired);
        }

        if (balance1 > 0){
            path[0] = token0;
            path[1] = token1;      
            amountRequired = IUniswapV2Router02(routerX).getAmountsIn(balance1, path)[0]; // 要还这么多token0
            
            IERC20(token1).approve(routerY, type(uint256).max);
            path[0] = token1;
            path[1] = token0;
            uint[] memory amounts = IUniswapV2Router02(routerY).swapExactTokensForTokens(
                balance1,  /* 给多少 */
                0,         /* 最少得多少 */
                path,      /* 1->0: [token0,token1]*/
                address(this), 
                block.timestamp
            );
            uint amountReceived = amounts[1];
            console.log('amountRequired', amountRequired);
            console.log('amountReceived', amountReceived);
            require(amountReceived >= amountRequired);
            IERC20(token0).transfer(msg.sender, amountRequired);
            IERC20(token0).transfer(owner, amountReceived - amountRequired);
        }
    }
}