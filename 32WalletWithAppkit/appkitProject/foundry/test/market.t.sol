// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {NFTMarket, NFT, ERC20token} from "../src/NFTMarketBuyWithERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MarketTest is Test {
    NFT public nft;
    ERC20token public token;
    NFTMarket public market;

    address public seller = address(0x1);
    address public buyer = address(0x2);
    uint public price = 100 ether;

    event NftListed(address indexed seller, uint indexed _NftId, uint price);
    event NftSold(address indexed buyer, uint indexed _NftId, uint price);

    function setUp() public {
        // 部署合约
        nft = new NFT();
        token = new ERC20token();
        market = new NFTMarket(address(token), address(nft));

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
} 