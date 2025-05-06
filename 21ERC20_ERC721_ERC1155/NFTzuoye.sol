// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";


contract MyNFT25 is ERC721URIStorage {
    using Strings for uint256;

    uint256 private _nextTokenId = 0;
    string private _baseTokenURI;

    constructor(string memory baseURI) ERC721("NFT25", "N25") {
        _baseTokenURI = baseURI; // 如 ipfs://CID/
    }

    event Mint(address _to, uint _tokenId, string _uri);

    function mintNFT() public returns (uint256) {
        _nextTokenId += 1;
        uint256 tokenId = _nextTokenId;
        _mint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI(tokenId));
        emit Mint(msg.sender, tokenId, tokenURI(tokenId));
        return tokenId;
    }

    // 拼接 baseURI + tokenId + ".json"
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        // require(_exists(tokenId), "Token does not exist");
        return string(abi.encodePacked(_baseTokenURI, tokenId.toString(), ".json"));
    }

    function setBaseURI(string memory newBaseURI) public {
        _baseTokenURI = newBaseURI;
    }

    function showTokenId() public view returns (uint256) {
        return _nextTokenId;
    }
}


contract MyToken25 is ERC20 {
    constructor(uint256 initialSupply) ERC20("Token25", "T25") {
        _mint(msg.sender, initialSupply);
    }
}

/*
编写一个简单的 NFTMarket 合约，使用自己发行的ERC20 扩展 Token 来买卖 NFT， NFTMarket 的函数有：
list() : 实现上架功能，NFT 持有者可以设定一个价格（需要多少个 Token 购买该 NFT）
并上架 NFT 到 NFTMarket，上架之后，其他人才可以购买。
buyNFT() : 普通的购买 NFT 功能，用户转入所定价的 token 数量，获得对应的 NFT。
实现ERC20 扩展 Token 所要求的接收者方法 tokensReceived  ，在 tokensReceived 中实现NFT 购买功能(注意扩展的转账需要添加一个额外数据参数)。
*/
contract NFTMarket is ERC721Holder {
    MyNFT25 public nft;
    MyToken25 public token;
    
    // nftId -> price
    mapping(uint256 => uint256) public priceOfNftId;
    // nftId -> seller
    mapping(uint256 => address) public sellerOfNftId;
    
    // 事件
    event NFTListed(uint256 indexed nftId, address indexed seller, uint256 price);
    event NFTPurchased(uint256 indexed nftId, address indexed buyer, address indexed seller, uint256 price);
    
    constructor(address nftAddr, address tokenAddr) {
        nft = MyNFT25(nftAddr);
        token = MyToken25(tokenAddr);
    }
    
    // 上架 NFT
    function list(uint256 price, uint256 nftId) public {
        // 上架的 NFT 需要是自己的
        require(nft.ownerOf(nftId) == msg.sender, "Can only list your own NFT!");
        require(price > 0, "Price must be greater than zero!");
        
        // 将 NFT 转移到市场合约
        nft.safeTransferFrom(msg.sender, address(this), nftId);
        
        // 记录价格和卖家
        priceOfNftId[nftId] = price;
        sellerOfNftId[nftId] = msg.sender;
        
        emit NFTListed(nftId, msg.sender, price);
    }
    
    // 常规购买方法
    function buyNFT(uint256 nftId) public {
        address buyer = msg.sender;
        address seller = sellerOfNftId[nftId];
        uint256 price = priceOfNftId[nftId];
        
        // 验证 NFT 在售
        require(seller != address(0), "NFT not listed for sale!");
        require(price > 0, "NFT price not set!");
        
        // 验证买家不是卖家
        require(seller != buyer, "You already own it!");
        
        // 验证买家余额足够
        require(token.balanceOf(buyer) >= price, "Insufficient token balance!");
        
        // 清除上架信息
        priceOfNftId[nftId] = 0;
        sellerOfNftId[nftId] = address(0);
        
        // 转移代币给卖家
        require(token.transferFrom(buyer, seller, price), "Token transfer failed!");
        
        // 转移 NFT 给买家
        nft.safeTransferFrom(address(this), buyer, nftId);
        
        emit NFTPurchased(nftId, buyer, seller, price);
    }
    
    // 实现 ERC20 扩展 Token 所要求的接收者方法
    function tokensReceived(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata data
    ) external returns (bool) {
        // 确认调用者是 token 合约
        require(msg.sender == address(token), "Only token contract can call this method");
        
        // 解码数据，提取 nftId
        uint256 nftId = abi.decode(data, (uint256));
        
        // 获取 NFT 信息
        address seller = sellerOfNftId[nftId];
        uint256 price = priceOfNftId[nftId];
        
        // 验证 NFT 在售
        require(seller != address(0), "NFT not listed for sale!");
        require(price > 0, "NFT price not set!");
        
        // 验证转账金额正确
        require(amount >= price, "Insufficient payment amount!");
        
        // 验证接收者是合约自身
        require(to == address(this), "Tokens must be sent to the marketplace!");
        
        // 验证买家不是卖家
        require(seller != from, "You already own it!");
        
        // 清除上架信息
        priceOfNftId[nftId] = 0;
        sellerOfNftId[nftId] = address(0);
        
        // 转移代币到卖家
        require(token.transfer(seller, price), "Token transfer to seller failed!");
        
        // 如果有多余的代币，退还给买家
        if (amount > price) {
            require(token.transfer(from, amount - price), "Refund transfer failed!");
        }
        
        // 转移 NFT 给买家
        nft.safeTransferFrom(address(this), from, nftId);
        
        emit NFTPurchased(nftId, from, seller, price);
        
        return true;
    }
}