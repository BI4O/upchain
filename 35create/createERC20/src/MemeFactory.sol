// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./MemeToken.sol";

contract MemeFactory {
    address public immutable implementation;
    address public owner;
    uint256 public constant PLATFORM_FEE_PERCENTAGE = 1; // 1% 平台费用
    
    // 记录已部署的代币
    struct MemeInfo {
        string symbol;
        uint256 totalSupply;
        uint256 perMint;
        uint256 price;
        uint256 mintedAmount;
        address creator;
    }
    
    mapping(address => MemeInfo) public memeTokens;
    
    event MemeDeployed(address indexed tokenAddress, string symbol, uint256 totalSupply, uint256 perMint, uint256 price, address creator);
    event MemeMinted(address indexed tokenAddress, address indexed to, uint256 amount, uint256 paid);
    
    constructor() {
        implementation = address(new MemeToken());
        owner = msg.sender;
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
            creator: msg.sender
        });
        
        emit MemeDeployed(tokenAddress, symbol, totalSupply, perMint, price, msg.sender);
        return tokenAddress;
    }
    
    // 铸造Meme代币
    function mintInscription(address tokenAddress) external payable {
        MemeInfo storage memeInfo = memeTokens[tokenAddress];
        require(memeInfo.creator != address(0), "Token not found");
        require(memeInfo.mintedAmount < memeInfo.totalSupply, "All tokens minted");
        require(msg.value == memeInfo.price * memeInfo.perMint / 10**18, "Incorrect payment amount");
        
        // 计算平台费用和创建者收益
        uint256 platformFee = (msg.value * PLATFORM_FEE_PERCENTAGE) / 100;
        uint256 creatorFee = msg.value - platformFee;
        
        // 铸造代币
        MemeToken(tokenAddress).mint(msg.sender, memeInfo.perMint);
        memeInfo.mintedAmount += memeInfo.perMint;
        
        // 分配费用
        (bool sentToOwner, ) = owner.call{value: platformFee}("");
        require(sentToOwner, "Failed to send platform fee");
        
        (bool sentToCreator, ) = memeInfo.creator.call{value: creatorFee}("");
        require(sentToCreator, "Failed to send creator fee");
        
        emit MemeMinted(tokenAddress, msg.sender, memeInfo.perMint, msg.value);
    }
    
    // 使用最小代理模式创建克隆
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
} 