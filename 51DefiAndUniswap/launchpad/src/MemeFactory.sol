// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./MemeToken.sol";
import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {console} from "forge-std/console.sol";

/*
修改之前最小代理工厂 1% 费用修改为 5%， 
然后 5% 的 ETH 与相应的 Token 调用 Uniswap V2Router AddLiquidity 
添加MyToken与 ETH 的流动性（如果是第一次添加流动性按mint 价格作为流动性价格）。

除了之前的 mintMeme() 可以购买 meme 外，添加一个方法: buyMeme()， 
以便在 Unswap 的价格优于设定的起始价格时，用户可调用该函数来购买 Meme.
*/

contract MemeFactory {
    address public immutable implementation;
    address public owner;
    uint256 public constant PLATFORM_FEE_PERCENTAGE = 5; // 5% 平台费用
    IUniswapV2Router02 public uniswapRouter; // 用来把一部分代币注入uniswap
    
    // 记录已部署的代币
    struct MemeInfo {
        string symbol;
        uint256 totalSupply;
        uint256 perMint;
        uint256 price;
        uint256 mintedAmount;
        address creator;
        bool liquidityAdded; // 新增：是否已添加过流动性
    }
    
    mapping(address => MemeInfo) public memeTokens;
    
    event MemeDeployed(address indexed tokenAddress, string symbol, uint256 totalSupply, uint256 perMint, uint256 price, address creator);
    event MemeMinted(address indexed tokenAddress, address indexed to, uint256 amount, uint256 paid);
    
    constructor(address _uniswapRouterAddr) {
        implementation = address(new MemeToken());
        owner = msg.sender;
        // 把注入抽取的5%将要放进的流动性池子
        uniswapRouter = IUniswapV2Router02(_uniswapRouterAddr);
    }
    
    // 部署新的Meme代币
    function deployInscription(
        string memory symbol,
        uint256 totalSupply,
        uint256 perMint,
        uint256 price
    ) external returns (address) {
        require(perMint > 0, "Mint amount must be greater than 0");
        require(totalSupply >= perMint, "Total supply must be greater than or equal to perMint");
        require(totalSupply % perMint == 0, "Total supply must be divisible by perMint");
        
        // 创建代理合约
        address tokenAddress = _createClone(implementation);
        
        // 初始化代币 - 注意传入工厂地址
        MemeToken(tokenAddress).initialize(symbol, totalSupply, perMint, price, msg.sender, address(this));
        
        // 存储代币信息
        memeTokens[tokenAddress] = MemeInfo({
            symbol: symbol,
            totalSupply: totalSupply,
            perMint: perMint,
            price: price,
            mintedAmount: 0,
            creator: msg.sender,
            liquidityAdded: false
        });
        
        emit MemeDeployed(tokenAddress, symbol, totalSupply, perMint, price, msg.sender);
        return tokenAddress;
    }
    
    // 铸造Meme代币
    function mintInscription(address tokenAddress) external payable {
        MemeInfo storage memeInfo = memeTokens[tokenAddress];
        require(memeInfo.creator != address(0), "Token not found");
        require(memeInfo.mintedAmount < memeInfo.totalSupply, "All tokens minted");
        console.log("need:", memeInfo.price * memeInfo.perMint / 1e18);
        console.log("get :", msg.value );
        require(msg.value == memeInfo.price * memeInfo.perMint / 1e18, "Incorrect payment amount");

        // 计算平台费用和创建者收益
        uint256 platformFee = (msg.value * PLATFORM_FEE_PERCENTAGE) / 100; // 抽成5%
        uint256 creatorFee = msg.value - platformFee; // 95%
        console.log("platformFee: ", platformFee);

        // 先 mint 给用户
        MemeToken(tokenAddress).mint(msg.sender, memeInfo.perMint);
        memeInfo.mintedAmount += memeInfo.perMint;

        // 处理流动性：首次mint时自动加池
        if (!memeInfo.liquidityAdded) {
            // 计算要给池子的 MemeToken 数量（按 mint 价格）
            // tokenAmount = (platformFee * perMint) / msg.value
            uint256 tokenAmount = (platformFee * memeInfo.perMint) / msg.value;
            console.log("plan to mint meme amount",tokenAmount);
            // mint给工厂合约
            MemeToken(tokenAddress).mint(address(this), tokenAmount);
            // approve给router
            MemeToken(tokenAddress).approve(address(uniswapRouter), tokenAmount);
            // 添加流动性
            console.log("addLiqETH",platformFee,"Amount",tokenAmount);
            uniswapRouter.addLiquidityETH{value: platformFee}(
                tokenAddress,
                tokenAmount,
                0,
                0,
                address(this),
                block.timestamp + 1000
            );
            console.log("add done.");
            memeInfo.liquidityAdded = true;
            // emit事件可选
        } else {
            // 后续平台费直接转owner
            (bool sentToOwner, ) = owner.call{value: platformFee}("");
            require(sentToOwner, "Failed to send platform fee");
        }

        // 剩余95%转creator
        (bool sentToCreator, ) = memeInfo.creator.call{value: creatorFee}("");
        require(sentToCreator, "Failed to send creator fee");

        emit MemeMinted(tokenAddress, msg.sender, memeInfo.perMint, msg.value);
    }
    
    // 使用最小代理模式创建克隆，给定一个合约地址，返回一个跟合约地址逻辑一样的部署好的合约
    function _createClone(address target) internal returns (address result) {
        bytes20 targetBytes = bytes20(target);
        assembly {
            let clone := mload(0x40)
            mstore(clone, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(clone, 0x14), targetBytes)
            mstore(add(clone, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            result := create(0, clone, 0x37)
        }
    }

    function buyMeme(address tokenAddress, uint256 minTokensOut) external payable {
        MemeInfo storage memeInfo = memeTokens[tokenAddress];
        require(memeInfo.creator != address(0), "Token not found");
        require(memeInfo.liquidityAdded, "Liquidity not added yet");
        require(msg.value > 0, "No ETH sent");

        address[] memory path = new address[](2);
        path[0] = uniswapRouter.WETH();
        path[1] = tokenAddress;

        uniswapRouter.swapExactETHForTokens{value: msg.value}(
            minTokensOut,
            path,
            msg.sender,
            block.timestamp + 1000
        );
    }
} 