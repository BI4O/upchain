// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.8.5;

import {Test} from "forge-std/Test.sol";
import {UniswapDeployer} from "../script/UniswapDeployer.s.sol";
import {IUniswapV2Factory} from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {IUniswapV2Router01} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import {WETH} from "solmate/tokens/WETH.sol";

import {Token} from "../src/Token.sol";

contract UniswapTests is Test {
    // eth mainnet下的uniswap-factory的真实地址
    IUniswapV2Factory factory =
        IUniswapV2Factory(0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f);

    // eth mainnet下的uniswap-weth的真实地址
    WETH deployedWeth =
        WETH(payable(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2));

    // eth mainnet下的uniswap-router的真实地址
    IUniswapV2Router02 router =
        IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);

    /*
    因为上面使用的是eth主网的真实地址，所以如果使用
    forge test 本地一次性模拟时候，setUp时必须的
    forge test --fork-url http://localhost:8545 的anvil模拟时候（sepolia同理），setUp看情况，如果你已经部署了就不用
    forge test --fork-url <Alchemy 主网的rpc> 的时候，setUp是会冲突的，因为主网已经部署过了uniswapV2
    */
    function setUp() public {
        // 用在script写好的部署脚本，那边的部署脚本指定了各个合约部署地址
        UniswapDeployer deployer = new UniswapDeployer();
        deployer.run();
    }

    function test_uniswapFactory() public view {
        assert(factory.feeToSetter() != address(0));
    }

    function test_wrappedEther() public view {
        // 这里应该是返回WETH这个名称，所以不为零长
        assert(abi.encode(deployedWeth.name()).length > 0);
    }

    function test_deployedRouter() public view {
        // 因为router在script里面部署的时候（上面的deployer.run）
        // router部署时候需要注意一下
        assert(router.WETH() != address(0));
    }

    function test_addLiqToken() public {
        Token token = new Token();
        // 因为是permit，先授权无限大给到uniswap，这样他就可以直接调用
        token.approve(address(router), type(uint).max);

        // 
        IUniswapV2Router01(router).addLiquidityETH{value: 10 ether}(
            address(token),
            token.balanceOf(address(this)),
            0,
            0,
            address(this),
            block.timestamp + 1000
        );
    }
}