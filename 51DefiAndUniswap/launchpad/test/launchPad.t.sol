// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.8.5;

// 注意import接口的时候，是不会触发检查solidity版本的，所以不担心老代码的接口
// 以后也要注意用老代码测试模拟部署的时候尽量用接口+地址
import {Test} from "forge-std/Test.sol";
import {UniswapDeployer} from "../script/deployUniswap.s.sol";
import {IUniswapV2Factory} from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {IUniswapV2Router01} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import {WETH} from "solmate/tokens/WETH.sol";
import {console} from "forge-std/console.sol";

// 用memeFactory而不是直接的MemeToken
import {MemeFactory} from "../src/MemeFactory.sol";
import {MemeToken} from "../src/MemeToken.sol";

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

    // 新增：合约级变量
    MemeFactory memeFactory;
    address pepeAddr;
    MemeToken pepe;

    /*
    因为上面使用的是eth主网的真实地址，所以如果使用
    forge test 本地一次性模拟时候，setUp时必须的
    forge test --fork-url http://localhost:8545 的anvil模拟时候（sepolia同理），setUp看情况，如果你已经部署了就不用
    */
    function setUp() public {
        // 用在script写好的部署脚本，那边的部署脚本指定router、factory、weth
        UniswapDeployer deployer = new UniswapDeployer();
        deployer.run();

        // 初始化memeFactory和pepe
        memeFactory = new MemeFactory(address(router));
        uint256 perMint = 1_000_000 * 1e18;
        uint256 price = 1e12;
        pepeAddr = memeFactory.deployInscription("PEPE", 1e10 ether, perMint, price);
        pepe = MemeToken(pepeAddr);
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

    // 1. 首次mint应该会有流动性注入
    function test_firstMintInjectsLiquidity() public {
        uint256 perMint = 1_000_000 * 1e18;
        uint256 price = 1e12;
        uint256 msgValue = price * perMint / 1e18;
        memeFactory.mintInscription{value: msgValue}(pepeAddr);
        (,,,uint256 priceOut,uint256 mintAmount,,bool liquidityAdded) = memeFactory.memeTokens(pepeAddr);
        console.log("mint Amount", mintAmount);
        assertEq(priceOut, price, "price should match");
        assertEq(mintAmount, perMint, "mintedAmount should match perMint");
        assertTrue(liquidityAdded, "liquidity should be added after first mint");
    }

    // 2. 首次buymeme会失效因为还没有流动性池子
    function test_buyMemeFailsBeforeLiquidity() public {
        vm.expectRevert("Liquidity not added yet");
        memeFactory.buyMeme{value: 1 ether}(pepeAddr, 1);
    }

    // 3. 首次mint过后大家还是可以按照price来mint meme
    function test_mintAfterFirstMint() public {
        uint256 perMint = 1_000_000 * 1e18;
        uint256 price = 1e12;
        uint256 msgValue = price * perMint / 1e18;
        memeFactory.mintInscription{value: msgValue}(pepeAddr);
        memeFactory.mintInscription{value: msgValue}(pepeAddr);
        (
            string memory symbol,
            uint256 totalSupply,
            uint256 perMintOut,
            uint256 priceOut,
            uint256 mintedAmount,
            address creator,
            bool liquidityAdded
        ) = memeFactory.memeTokens(pepeAddr);
        console.log("price:", priceOut);
        console.log("mintedAmount:", mintedAmount);
        console.log("liquidityAdded:", liquidityAdded);
        console.log("balance of this (after mint):", pepe.balanceOf(address(this)));
        assertEq(priceOut, price, "price should match");
        assertEq(mintedAmount, 2 * perMint, "mintedAmount should be 2 * perMint");
        assertTrue(liquidityAdded, "liquidity should be true after first mint");
    }

    // 4. 首次mint过后大家可以除了mint以外，还可以buymeme
    function test_buyMemeAfterLiquidity() public {
        uint256 perMint = 1_000_000 * 1e18;
        uint256 price = 1e12;
        uint256 msgValue = price * perMint / 1e18;
        memeFactory.mintInscription{value: msgValue}(pepeAddr);
        uint256 before = pepe.balanceOf(address(this));
        console.log("before buy, balance:", before);
        memeFactory.buyMeme{value: msgValue}(pepeAddr, 1);
        uint256 afterBuy = pepe.balanceOf(address(this));
        (
            string memory symbol,
            uint256 totalSupply,
            uint256 perMintOut,
            uint256 priceOut,
            uint256 mintedAmount,
            address creator,
            bool liquidityAdded
        ) = memeFactory.memeTokens(pepeAddr);
        console.log("after buy, balance:", afterBuy);
        console.log("mintedAmount:", mintedAmount);
        console.log("liquidityAdded:", liquidityAdded);
        assertTrue(afterBuy > before, "should receive meme token after buyMeme");
        assertTrue(liquidityAdded, "liquidity should be true after first mint");
    }

    // 5. 直接测试addLiquidityETH
    function test_addLiquidityETH_direct() public {
        uint256 tokenAmount = 1_000_000 * 1e18;
        uint256 ethAmount = 1 ether;
        // 先mint足够的token给本合约
        pepe.mint(address(this), tokenAmount);
        // 授权router
        pepe.approve(address(router), tokenAmount);
        // 添加流动性
        router.addLiquidityETH{value: ethAmount}(
            address(pepe),
            tokenAmount,
            0,
            0,
            address(this),
            block.timestamp + 1000
        );
        // 检查LP token余额
        address pair = factory.getPair(address(pepe), router.WETH());
        require(pair != address(0), "pair not created");
        // 只要pair存在即说明流动性添加成功
    }
}