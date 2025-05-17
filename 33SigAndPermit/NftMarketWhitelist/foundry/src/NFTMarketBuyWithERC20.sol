// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract NFT is ERC721 {
    using Strings for uint;
    // 我想要Id从0开始
    uint public _nextTokenId = 0;

    constructor() ERC721("NFT","T") {}

    // 一、需要定义baseURI
    function _baseURI() internal pure override returns(string memory) {
        return "ipfs://base/";
    }

    // ** 可选，因为原本的就只是baseURI+tokenId，但是一般来说是baseURI+tokenId+".json"
    function tokenURI(uint _tokenId) public view override returns(string memory){
        require(_tokenId <= _nextTokenId, "tokenId not exists !");
        return string.concat(_baseURI(), _tokenId.toString(), ".json");
    }

    // 二、然后需要自己拼接(这个函数必须要自己实现，标准里只有_mint)
    function mint(address _to) public {
        _nextTokenId += 1;
        _safeMint(_to, _nextTokenId);
    }
}


contract ERC20token is ERC20 {
    address public owner;
    constructor() ERC20("Token","TK"){
        _mint(msg.sender, 100 ether);
        owner = msg.sender;
    }
}


/*
编写 NFTMarket 合约：

支持设定任意ERC20价格来上架NFT
支持支付ERC20购买指定的NFT
*/
contract NFTMarket is IERC721Receiver {
    using SafeERC20 for ERC20;
    using ECDSA for bytes32;
    
    ERC20 public token;
    ERC721 public nft;
    
    // 添加项目方签名者地址
    address public signer;

    // 账本1: 价格表
    mapping(uint => uint) public priceOfNFT;
    // 账本2: 作者
    mapping(uint => address) public sellerOfNFT;
    // 添加已使用的签名记录，防止重放攻击
    mapping(bytes => bool) public usedSignatures;

    constructor(address _ERC20, address _NFT, address _signer) {
        token = ERC20token(_ERC20);
        nft = ERC721(_NFT);
        signer = _signer;
    }

    // 实现IERC721Receiver接口
    function onERC721Received(
        address _operator,
        address _from,
        uint256 _tokenId,
        bytes calldata _data
    ) external override pure returns (bytes4) {
        _operator;
        _from;
        _tokenId;
        _data;
        return IERC721Receiver.onERC721Received.selector;
    }

    // 支持nft主人上架自己的nft，委托给市场方{from: owner}
    event NftListed(address indexed seller, uint indexed _NftId, uint price);
    function list(uint _NftId, uint _price) public {
        // 1. 确认：售卖人是作者，售价大于0
        require(nft.ownerOf(_NftId) == msg.sender && _price > 0, "U must owner and price should > 0");

        // 2. 转移
        nft.safeTransferFrom(msg.sender, address(this), _NftId);

        // 3. 记账
        sellerOfNFT[_NftId] = msg.sender;
        priceOfNFT[_NftId] = _price;

        // 广播
        emit NftListed(msg.sender, _NftId, _price);
    }

    event NftSold(address indexed buyer, uint indexed _NftId, uint price);
    function buyNFT(uint _NftId) public {
        address buyer = msg.sender;
        address seller = sellerOfNFT[_NftId];
        uint price = priceOfNFT[_NftId];

        // 1. 确认卖家和买家不是同一个人，作品还在，购买者够钱
        require(seller != buyer, "U already own it");
        require(seller != address(0),"NFT was sold or not exists!");
        require(token.balanceOf(buyer) >= price, "You need more ERC20token!");

        // 2. 转移
        token.safeTransferFrom(buyer, seller, price);
        nft.safeTransferFrom(address(this), buyer, _NftId);

        // 3. 记账
        delete sellerOfNFT[_NftId];
        delete priceOfNFT[_NftId];

        // 广播
        emit NftSold(buyer, _NftId, price);
    }
    
    // 新增白名单验证购买函数
    function permitBuy(uint _NftId, bytes memory signature) public {
        address buyer = msg.sender;
        address seller = sellerOfNFT[_NftId];
        uint price = priceOfNFT[_NftId];
        
        // 检查签名是否已被使用
        require(!usedSignatures[signature], "Signature already used");
        
        // 验证白名单签名
        bytes32 messageHash = keccak256(abi.encodePacked(buyer, _NftId));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address recoveredSigner = ECDSA.recover(ethSignedMessageHash, signature);
        
        // 验证签名者是否为项目方
        require(recoveredSigner == signer, "Not authorized: Invalid signature");
        
        // 标记签名已使用
        usedSignatures[signature] = true;
        
        // 执行购买逻辑（与buyNFT相同）
        require(seller != buyer, "U already own it");
        require(seller != address(0), "NFT was sold or not exists!");
        require(token.balanceOf(buyer) >= price, "You need more ERC20token!");
        
        // 转移资产
        token.safeTransferFrom(buyer, seller, price);
        nft.safeTransferFrom(address(this), buyer, _NftId);
        
        // 更新记录
        delete sellerOfNFT[_NftId];
        delete priceOfNFT[_NftId];
        
        // 广播
        emit NftSold(buyer, _NftId, price);
    }
}
