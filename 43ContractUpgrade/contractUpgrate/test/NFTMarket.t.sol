// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/NFT.sol";
import "../src/NFTMarket.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract NFTMarketTest is Test {
    // 合约实例
    MyToken token;
    MyNFT_V1 nftImpl;
    MyNFT_Proxy nftProxy;
    IERC721 nft;
    NFTMarket_V1 marketV1Impl;
    NFTMarket_Proxy marketV1Proxy;
    NFTMarket_V1 marketV1;
    NFTMarket_V2 marketV2Impl;
    NFTMarket_Proxy marketV2Proxy;
    NFTMarket_V2 marketV2;

    // 测试地址
    address deployer = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address user = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address buyer = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    uint256 userPrivateKey = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    uint256 buyerPrivateKey = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;

    function setUp() public {
        vm.startPrank(deployer);
        // 部署ERC20
        token = new MyToken();
        // 部署NFT逻辑合约和代理
        nftImpl = new MyNFT_V1();
        bytes memory nftInit = abi.encodeWithSelector(MyNFT_V1.initialize.selector, "TestNFT", "TNFT");
        nftProxy = new MyNFT_Proxy(address(nftImpl), nftInit);
        nft = IERC721(address(nftProxy));
        // 部署MarketV1逻辑合约和代理
        marketV1Impl = new NFTMarket_V1();
        bytes memory marketV1Init = abi.encodeWithSelector(NFTMarket_V1.initialize.selector, address(token), address(nft));
        marketV1Proxy = new NFTMarket_Proxy(address(marketV1Impl), marketV1Init);
        marketV1 = NFTMarket_V1(address(marketV1Proxy));
        // 部署MarketV2逻辑合约和代理
        marketV2Impl = new NFTMarket_V2();
        bytes memory marketV2Init = abi.encodeWithSelector(NFTMarket_V2.initialize.selector, address(token), address(nft));
        marketV2Proxy = new NFTMarket_Proxy(address(marketV2Impl), marketV2Init);
        marketV2 = NFTMarket_V2(address(marketV2Proxy));
        vm.stopPrank();
        // 用户和买家领取token
        token.mint(user, 1000 ether);
        token.mint(buyer, 1000 ether);
        // 用户mint NFT
        vm.startPrank(deployer);
        MyNFT_V1(address(nftProxy)).mint(user, 1);
        vm.stopPrank();
        // 标记
        vm.label(user, "user");
        vm.label(buyer, "buyer");
    }

    function testMarketV1ListAndBuy() public {
        // user授权marketV1
        vm.startPrank(user);
        nft.approve(address(marketV1), 1);
        // user上架
        marketV1.list(1, 100 ether);
        vm.stopPrank();
        // buyer购买
        vm.startPrank(buyer);
        token.approve(address(marketV1), 100 ether);
        marketV1.buyNFT(1);
        vm.stopPrank();
        // 断言
        assertEq(nft.ownerOf(1), buyer, "NFT owner should be buyer");
        uint256 userBal = uint256(token.balanceOf(user));
        uint256 buyerBal = uint256(token.balanceOf(buyer));
        assertEq(userBal, 1100 ether, "User should receive payment");
        assertEq(buyerBal, 900 ether, "Buyer should pay");
    }

    function testMarketV2PermitListAndBuy() public {
        // user setApprovalForAll给marketV2
        vm.startPrank(user);
        nft.setApprovalForAll(address(marketV2), true);
        vm.stopPrank();
        // user链下签名
        uint256 tokenId = 1;
        uint256 price = 200 ether;
        NFTMarket_V2.List memory listing = NFTMarket_V2.List({tokenId: tokenId, price: price});
        bytes32 structHash = keccak256(abi.encode(marketV2.LIST_TYPEHASH(), tokenId, price));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", marketV2.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        // 任何人都可以调用permitList
        marketV2.permitList(user, listing, signature);
        // buyer购买
        vm.startPrank(buyer);
        token.approve(address(marketV2), price);
        marketV2.buyNFT(tokenId);
        vm.stopPrank();
        // 断言
        assertEq(nft.ownerOf(tokenId), buyer, "NFT owner should be buyer");
        uint256 userBal = uint256(token.balanceOf(user));
        uint256 buyerBal = uint256(token.balanceOf(buyer));
        assertEq(userBal, 1200 ether, "User should receive payment");
        assertEq(buyerBal, 800 ether, "Buyer should pay");
    }

    // 补充：未授权时上架应失败
    function testMarketV1ListFailWithoutApprove() public {
        vm.startPrank(user);
        vm.expectRevert();
        marketV1.list(1, 100 ether);
        vm.stopPrank();
    }
    function testMarketV2PermitListFailWithoutApproval() public {
        uint256 tokenId = 1;
        uint256 price = 200 ether;
        NFTMarket_V2.List memory listing = NFTMarket_V2.List({tokenId: tokenId, price: price});
        bytes32 structHash = keccak256(abi.encode(marketV2.LIST_TYPEHASH(), tokenId, price));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", marketV2.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        vm.expectRevert();
        marketV2.permitList(user, listing, signature);
    }
    // 签名不合法时应失败
    function testMarketV2PermitListFailWithWrongSig() public {
        uint256 tokenId = 1;
        uint256 price = 200 ether;
        NFTMarket_V2.List memory listing = NFTMarket_V2.List({tokenId: tokenId, price: price});
        // 用buyer的私钥签名
        bytes32 structHash = keccak256(abi.encode(marketV2.LIST_TYPEHASH(), tokenId, price));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", marketV2.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(buyerPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        vm.expectRevert();
        marketV2.permitList(user, listing, signature);
    }

    function testUpgradeFromV1ToV2() public {
        // 1. user授权marketV1并上架
        vm.startPrank(user);
        nft.approve(address(marketV1), 1);
        marketV1.list(1, 100 ether);
        vm.stopPrank();

        // 2. 升级代理到V2实现（通过UUPS逻辑合约的upgradeToAndCall）
        vm.startPrank(deployer);
        (bool success, ) = address(marketV1Proxy).call(abi.encodeWithSignature("upgradeToAndCall(address,bytes)", address(marketV2Impl), ""));
        require(success, "upgradeToAndCall failed");
        marketV2 = NFTMarket_V2(address(marketV1Proxy));
        vm.stopPrank();

        // 3. buyer用V2接口购买
        vm.startPrank(buyer);
        token.approve(address(marketV2), 100 ether);
        marketV2.buyNFT(1);
        vm.stopPrank();

        // 4. 断言
        assertEq(nft.ownerOf(1), buyer, "NFT owner should be buyer after upgrade");
        uint256 userBal = uint256(token.balanceOf(user));
        uint256 buyerBal = uint256(token.balanceOf(buyer));
        assertEq(userBal, 1100 ether, "User should receive payment after upgrade");
        assertEq(buyerBal, 900 ether, "Buyer should pay after upgrade");
    }
} 