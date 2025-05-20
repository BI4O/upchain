// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {NFTMarket, NFT, ERC20token} from "../src/NFTMarketBuyWithERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract MarketTest is Test {
    NFT public nft;
    ERC20token public token;
    NFTMarket public market;
    
    // 使用固定的私钥和对应的地址
    uint256 private signerPrivateKey = 0x01;
    address public signer;

    address public seller = address(0x1);
    address public buyer = address(0x2);
    uint public price = 100 ether;

    event NftListed(address indexed seller, uint indexed _NftId, uint price);
    event NftSold(address indexed buyer, uint indexed _NftId, uint price);

    function setUp() public {
        // 计算私钥对应的地址
        signer = vm.addr(signerPrivateKey);
        
        // 部署合约
        nft = new NFT();
        token = new ERC20token();
        // 修改构造函数，添加signer参数
        market = new NFTMarket(address(token), address(nft), signer);

        // 为卖家铸造NFT
        vm.startPrank(seller);
        nft.mint(seller);
        vm.stopPrank();

        // 为买家提供ERC20代币
        vm.prank(token.owner());
        token.transfer(buyer, 1000 ether);
    }

    function test_list() public {
        // 准备数据
        uint tokenId = 1;

        // 调用上架方法前需要先授权
        vm.startPrank(seller);
        nft.approve(address(market), tokenId);
        
        // 验证事件发出
        vm.expectEmit(true, true, false, true);
        emit NftListed(seller, tokenId, price);
        
        // 执行上架
        market.list(tokenId, price);
        vm.stopPrank();

        // 验证状态变更
        assertEq(nft.ownerOf(tokenId), address(market), "NFT should be transferred to market");
        assertEq(market.sellerOfNFT(tokenId), seller, "Seller should be recorded");
        assertEq(market.priceOfNFT(tokenId), price, "Price should be recorded");
    }

    function test_buyNFT() public {
        // 准备数据：先上架NFT
        uint tokenId = 1;
        vm.startPrank(seller);
        nft.approve(address(market), tokenId);
        market.list(tokenId, price);
        vm.stopPrank();

        // 买家授权并购买
        vm.startPrank(buyer);
        token.approve(address(market), price);
        
        // 验证事件发出
        vm.expectEmit(true, true, false, true);
        emit NftSold(buyer, tokenId, price);
        
        // 执行购买
        market.buyNFT(tokenId);
        vm.stopPrank();

        // 验证状态变更
        assertEq(nft.ownerOf(tokenId), buyer, "NFT should be transferred to buyer");
        assertEq(token.balanceOf(seller), price, "Seller should receive tokens");
        assertEq(market.sellerOfNFT(tokenId), address(0), "Seller record should be cleared");
        assertEq(market.priceOfNFT(tokenId), 0, "Price record should be cleared");
    }

    function test_RevertWhen_ListWithoutOwnership() public {
        // 非NFT拥有者尝试上架
        vm.prank(buyer);
        vm.expectRevert("U must owner and price should > 0");
        market.list(1, price);
    }

    function test_RevertWhen_ListWithZeroPrice() public {
        // NFT拥有者尝试以0价格上架
        vm.prank(seller);
        vm.expectRevert("U must owner and price should > 0");
        market.list(1, 0);
    }

    function test_RevertWhen_BuyNonExistentNFT() public {
        // 尝试购买不存在的NFT
        vm.prank(buyer);
        vm.expectRevert("NFT was sold or not exists!");
        market.buyNFT(999);
    }

    function test_RevertWhen_BuyWithInsufficientFunds() public {
        // 准备数据：先上架NFT
        uint tokenId = 1;
        vm.startPrank(seller);
        nft.approve(address(market), tokenId);
        market.list(tokenId, price);
        vm.stopPrank();

        // 创建没有足够代币的买家
        address poorBuyer = address(0x3);
        vm.prank(token.owner());
        token.transfer(poorBuyer, price - 1);

        // 尝试购买但资金不足
        vm.startPrank(poorBuyer);
        token.approve(address(market), price);
        vm.expectRevert("You need more ERC20token!");
        market.buyNFT(tokenId);
        vm.stopPrank();
    }

    function test_RevertWhen_BuySelfOwnedNFT() public {
        // 准备数据：先上架NFT
        uint tokenId = 1;
        vm.startPrank(seller);
        nft.approve(address(market), tokenId);
        market.list(tokenId, price);
        
        // 卖家尝试购买自己的NFT
        token.approve(address(market), price);
        vm.expectRevert("U already own it");
        market.buyNFT(tokenId);
        vm.stopPrank();
    }

    function test_permitBuy() public {
        // 准备数据：先上架NFT
        uint tokenId = 1;
        vm.startPrank(seller);
        nft.approve(address(market), tokenId);
        market.list(tokenId, price);
        vm.stopPrank();

        // 创建签名（在实际场景中这会由项目方离线完成）
        bytes32 messageHash = keccak256(abi.encodePacked(buyer, tokenId));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // 买家授权并通过白名单购买
        vm.startPrank(buyer);
        token.approve(address(market), price);
        
        // 验证事件发出
        vm.expectEmit(true, true, false, true);
        emit NftSold(buyer, tokenId, price);
        
        // 执行白名单购买
        market.permitBuy(tokenId, signature);
        vm.stopPrank();

        // 验证状态变更
        assertEq(nft.ownerOf(tokenId), buyer, "NFT should be transferred to buyer");
        assertEq(token.balanceOf(seller), price, "Seller should receive tokens");
        assertEq(market.sellerOfNFT(tokenId), address(0), "Seller record should be cleared");
        assertEq(market.priceOfNFT(tokenId), 0, "Price record should be cleared");
    }

    function test_RevertWhen_PermitBuyWithInvalidSignature() public {
        // 准备数据：先上架NFT
        uint tokenId = 1;
        vm.startPrank(seller);
        nft.approve(address(market), tokenId);
        market.list(tokenId, price);
        vm.stopPrank();

        // 使用错误的私钥创建无效签名
        uint256 wrongPrivateKey = 0x02; // 不同于signer的私钥
        bytes32 messageHash = keccak256(abi.encodePacked(buyer, tokenId));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPrivateKey, ethSignedMessageHash);
        bytes memory invalidSignature = abi.encodePacked(r, s, v);

        // 买家尝试使用无效签名购买
        vm.startPrank(buyer);
        token.approve(address(market), price);
        vm.expectRevert("Not authorized: Invalid signature");
        market.permitBuy(tokenId, invalidSignature);
        vm.stopPrank();
    }

    function test_RevertWhen_ReusingSignature() public {
        // 准备数据：先上架两个NFT
        uint tokenId1 = 1;
        vm.startPrank(seller);
        nft.approve(address(market), tokenId1);
        market.list(tokenId1, price);
        
        // 铸造第二个NFT
        nft.mint(seller);
        uint tokenId2 = 2;
        nft.approve(address(market), tokenId2);
        market.list(tokenId2, price);
        vm.stopPrank();

        // 创建签名（针对第一个NFT）
        bytes32 messageHash = keccak256(abi.encodePacked(buyer, tokenId1));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // 买家授权并购买第一个NFT
        vm.startPrank(buyer);
        token.approve(address(market), price * 2);
        
        // 第一次使用签名购买成功
        market.permitBuy(tokenId1, signature);
        
        // 尝试重用签名购买第二个NFT（应该失败）
        vm.expectRevert("Signature already used");
        market.permitBuy(tokenId2, signature);
        vm.stopPrank();
    }
} 