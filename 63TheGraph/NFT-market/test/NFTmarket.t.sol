// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/NFTmarket.sol";

contract NFTMarketTest is Test {
    NFT public nft;
    ERC20token public token;
    NFTMarket public market;

    address public alice = vm.addr(1);
    address public bob = vm.addr(2);

    function setUp() public {
        // 部署合约
        nft = new NFT();
        token = new ERC20token();
        market = new NFTMarket(address(token), address(nft));

        // 给 Alice 和 Bob 分配 ERC20
        token.mint(alice, 1000 ether);
        token.mint(bob, 1000 ether);

        // Alice 铸造 NFT
        vm.prank(alice);
        nft.mint(alice);

        // Bob 铸造 NFT
        vm.prank(bob);
        nft.mint(bob);
    }

    function testListAndBuyNFT() public {
        // Alice 授权 market 操作她的 NFT
        vm.startPrank(alice);
        nft.approve(address(market), 1);

        // 监听 NftListed 事件
        vm.expectEmit(true, true, false, true);
        emit NFTMarket.NftListed(alice, 1, 100 ether);

        // Alice 上架 NFT，价格 100 MY
        market.list(1, 100 ether);
        assertEq(nft.ownerOf(1), address(market));
        assertEq(market.priceOfNFT(1), 100 ether);
        assertEq(market.sellerOfNFT(1), alice);
        vm.stopPrank();

        // Bob 授权 market 花费他的 ERC20
        vm.startPrank(bob);
        token.approve(address(market), 100 ether);

        // 监听 NftSold 事件
        vm.expectEmit(true, true, false, true);
        emit NFTMarket.NftSold(bob, 1, 100 ether);

        // Bob 购买 NFT
        market.buyNFT(1);

        // 检查 NFT 所有权
        assertEq(nft.ownerOf(1), bob);

        // 检查账本已清除
        assertEq(market.priceOfNFT(1), 0);
        assertEq(market.sellerOfNFT(1), address(0));

        // 检查余额变化
        assertEq(token.balanceOf(alice), 1000 ether + 100 ether); // Alice 收到 100 MY
        assertEq(token.balanceOf(bob), 1000 ether - 100 ether);   // Bob 支付 100 MY
        vm.stopPrank();
    }

    function testListNotOwnerRevert() public {
        // Bob 尝试上架 Alice 的 NFT，应失败
        vm.startPrank(bob);
        vm.expectRevert();
        market.list(1, 100 ether);
        vm.stopPrank();
    }

    function testBuyNFTNotEnoughTokenRevert() public {
        // Alice 上架 NFT
        vm.startPrank(alice);
        nft.approve(address(market), 1);
        market.list(1, 1000 ether);
        vm.stopPrank();

        // Bob 只授权 100 MY，余额不足
        vm.startPrank(bob);
        token.approve(address(market), 100 ether);
        vm.expectRevert();
        market.buyNFT(1);
        vm.stopPrank();
    }

    function testBuyNFTTwiceRevert() public {
        // Alice 上架 NFT
        vm.startPrank(alice);
        nft.approve(address(market), 1);
        market.list(1, 100 ether);
        vm.stopPrank();

        // Bob 购买
        vm.startPrank(bob);
        token.approve(address(market), 100 ether);
        market.buyNFT(1);

        // 再次购买应失败（NFT 已经被卖出）
        vm.expectRevert("NFT was sold or not exists!");
        market.buyNFT(1);
        vm.stopPrank();
    }

    function testEventNftListed() public {
        vm.startPrank(alice);
        nft.approve(address(market), 1);

        vm.expectEmit(true, true, false, true);
        emit NFTMarket.NftListed(alice, 1, 123 ether);

        market.list(1, 123 ether);
        vm.stopPrank();
    }

    function testEventNftSold() public {
        // 上架
        vm.startPrank(alice);
        nft.approve(address(market), 1);
        market.list(1, 456 ether);
        vm.stopPrank();

        // Bob 购买
        vm.startPrank(bob);
        token.approve(address(market), 456 ether);

        vm.expectEmit(true, true, false, true);
        emit NFTMarket.NftSold(bob, 1, 456 ether);

        market.buyNFT(1);
        vm.stopPrank();
    }
}