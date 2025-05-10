pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/NFTMarketBuyWithERC20.sol";

/*
上架NFT：测试上架成功和失败情况，要求断言错误信息和上架事件。
购买NFT：测试购买成功、自己购买自己的NFT、NFT被重复购买、支付Token过多或者过少情况，要求断言错误信息和购买事件。
模糊测试：测试随机使用 0.01-10000 Token价格上架NFT，并随机使用任意Address购买NFT
「可选」不可变测试：测试无论如何买卖，NFTMarket合约中都不可能有 Token 持仓
*/

contract MarketTest is Test {
    // 测试要素，三个合约和三个用户
    NFT public nft;
    ERC20token public token;
    NFTMarket public mkt;

    address public artist;
    address public seller;
    address public buyer;

    // event
    event NftListed(address indexed seller, uint indexed _NftId, uint price);
    event NftSold(address indexed buyer, uint indexed _NftId, uint price);

    // 后置断言：保证 market 合约中永远没有 ERC20 余额
    modifier noMarketERC20Token() {
        _;
        // 这里的断言会在每个 test 函数体跑完后执行
        assertEq(token.balanceOf(address(mkt)), 0, "market must not hold any tokens");
    }

    function setUp() public {
        nft = new NFT();
        token = new ERC20token();
        mkt = new NFTMarket(address(token), address(nft));

        artist = vm.addr(uint256(keccak256("artist")));
        seller = vm.addr(uint256(keccak256("seller")));
        buyer = vm.addr(uint256(keccak256("buyer")));

        // 给测试用户一些代币
        vm.startPrank(token.owner());
        token.transfer(seller, 1e10 ether);
        token.transfer(buyer, 1e10 ether);
        vm.stopPrank();

        console.log("setUp: 3 contract deployed.");
    }

    // 辅助函数1
    function _artistMintOnce() internal {
        nft.mint(artist); 
        assertEq(nft.ownerOf(1), artist); // mint完看归属
    }

    // 辅助函数2
    function _artistMintMutiTimes(uint _times) internal {
        for (uint256 i = 1; i <= _times ; i++) {
            nft.mint(artist);
        }
        assertEq(nft.ownerOf(_times), artist); // mint完看归属
    }

    // 一、测试上架成功1
    function test_listOKByArtist() public  noMarketERC20Token {
        // 艺术家mint然后上架
        vm.startPrank(artist);
        _artistMintOnce();
        nft.approve(address(mkt), 1);

        // 2. 预期事件
        vm.expectEmit(true, true, false, false);
        emit NftListed(artist, 1, 100);

        // 3. 上架
        mkt.list(1, 100);
        vm.stopPrank();

        // 4. 上架信息确认
        assertEq(mkt.sellerOfNFT(1), artist);
        assertEq(mkt.priceOfNFT(1), 100);
        console.log("artist list art succeed.");
    }

    // 一、测试上架成功2
    function testFuzz_listOKByseller(uint _price, uint _tokenId) public  noMarketERC20Token {
        uint randomPrice = bound(_price, 1, 1 ether);
        uint randomTokenId = bound(_tokenId, 1, 50);
        // 艺术家卖给卖家，卖家上架作品
        // 1.艺术家mint并转给seller
        vm.startPrank(artist);
        for (uint256 i = 1; i <= randomTokenId ; i++) {
            nft.mint(artist);
        }
        assertEq(nft.ownerOf(1), artist); // mint完看归属
        nft.safeTransferFrom(artist, seller, 1);
        assertEq(nft.ownerOf(1), seller);
        console.log("1. artist mint and transfer to seller");
        vm.stopPrank();

        // 2.seller上架到作品市场
        vm.startPrank(seller);
        nft.approve(address(mkt), 1);

        // 3.预期上架通知
        vm.expectEmit(true, true, false, false);
        emit NftListed(seller, 1, randomPrice);
        mkt.list(1, randomPrice);
        vm.stopPrank();

        // 4.确认，Fuzz中console会失效
        assertEq(mkt.sellerOfNFT(1), seller);
        assertEq(mkt.priceOfNFT(1), randomPrice);
        // console.log("seller list art succeed.");
    }

    // 一、测试上架失败1
    function testFuzz_listFailedByNotOwner(uint _tokenId) public  noMarketERC20Token {  
        // 1. mint 30个作品
        vm.startPrank(artist);
        _artistMintMutiTimes(30);       
        vm.stopPrank();

        // 2. 随机选一个
        uint randomTokenId = bound(_tokenId, 1, 30);  

        // 3.seller没有主权也没有授权直接上架
        vm.startPrank(seller);
        vm.expectRevert("U must owner and price should > 0");
        mkt.list(randomTokenId, 100);
        vm.stopPrank();
    }
    
    // 一、测试上架失败2
    function testFuzz_listFailedByZeroPrice(uint _tokenId) public  noMarketERC20Token {  
        // 1. mint 30个作品
        vm.startPrank(artist);
        _artistMintMutiTimes(30);              

        // 2. 随机选一个，并转给seller
        uint randomTokenId = bound(_tokenId, 1, 30);  
        nft.safeTransferFrom(artist, seller, randomTokenId);
        vm.stopPrank();

        // 3.seller没有主权也没有授权直接上架
        vm.startPrank(seller);
        vm.expectRevert("U must owner and price should > 0");
        mkt.list(randomTokenId, 0);
        vm.stopPrank();
    }

    // 二、测试购买成功
    function test_buyOKbyBuyer() public  noMarketERC20Token {
        // 1.先min一个然后授权给seller
        vm.startPrank(artist);
        _artistMintOnce();
        nft.safeTransferFrom(artist, seller, 1);
        assertEq(nft.ownerOf(1), seller);
        vm.stopPrank();

        // 2. seller上架标价100
        vm.startPrank(seller);
        nft.approve(address(mkt), 1);
        // 期待事件
        vm.expectEmit(true, true, false, true);
        emit NftListed(seller, 1, 100);
        //  触发事件
        mkt.list(1, 100);
        vm.stopPrank();

        // 3. buyer购买
        vm.startPrank(buyer);
        token.approve(address(mkt), 100);
        // 期待事件
        vm.expectEmit(true, true, false, true);
        emit NftSold(buyer, 1, 100);
        // 触发事件
        mkt.buyNFT(1);
        vm.stopPrank();
        assertEq(nft.ownerOf(1), buyer);
    }

    // 二、测试购买失败：自己购买自己的NFT
    function test_buyFailedAlreadyOwn() public  noMarketERC20Token {
        // 1. artist mint 一个 NFT 并转给 seller
        vm.startPrank(artist);
        _artistMintOnce(); // mint 出 id 为 1 的 NFT
        nft.safeTransferFrom(artist, seller, 1);
        vm.stopPrank();

        // 2. seller 上架 NFT
        vm.startPrank(seller);
        nft.approve(address(mkt), 1);
        mkt.list(1, 100);
        vm.stopPrank();

        // 3. seller 自己尝试购买自己的 NFT，预期失败
        vm.startPrank(seller);
        token.approve(address(mkt), 100);
        vm.expectRevert("U already own it");
        mkt.buyNFT(1);
        vm.stopPrank();
    }

    // 二、测试购买失败：NFT被重复购买
    function test_buyFailedNotExists() public  noMarketERC20Token {
        // 1. artist mint 并转给 seller
        vm.startPrank(artist);
        _artistMintOnce(); // 假设 mint 出的 tokenId 是 1
        nft.safeTransferFrom(artist, seller, 1);
        vm.stopPrank();

        // 2. seller 上架 NFT
        uint price = 100;
        vm.startPrank(seller);
        nft.approve(address(mkt), 1);
        mkt.list(1, price);
        vm.stopPrank();

        // 3. buyer 买下 NFT
        vm.startPrank(token.owner()); // 给 buyer 发 token
        token.transfer(buyer, 1e20);
        vm.stopPrank();

        vm.startPrank(buyer);
        token.approve(address(mkt), price);
        mkt.buyNFT(1); // 第一次购买成功
        vm.stopPrank();

        // 4. buyer 或其他人尝试重复购买，应该失败
        vm.startPrank(vm.addr(9999)); // 任意地址尝试购买
        vm.expectRevert("NFT was sold or not exists!");
        mkt.buyNFT(1);
        vm.stopPrank();
    }

    // 二、测试购买失败：token过少
    function test_buyFailedBalanceNotEnough() public  noMarketERC20Token {
        // 1. artist mint 并转给 seller
        vm.startPrank(artist);
        _artistMintOnce(); // 假设 tokenId 是 1
        nft.safeTransferFrom(artist, seller, 1);
        vm.stopPrank();

        // 2. seller 上架 NFT，标价 100
        uint price = 100;
        vm.startPrank(seller);
        nft.approve(address(mkt), 1);
        mkt.list(1, price);
        vm.stopPrank();

        // 3. 给 buyer 很少的余额，例如 10
        // 初始化一个穷人
        address poorBuyer = vm.addr(uint256(keccak256("poorBuyer")));
        vm.startPrank(token.owner());
        token.transfer(poorBuyer, 90);
        assertEq(token.balanceOf(poorBuyer), 90);
        vm.stopPrank();

        // 4. buyer 试图购买（余额不够）
        vm.startPrank(poorBuyer);
        token.approve(address(mkt), 100); // 授权足够，但余额不够

        vm.expectRevert(); // ERC20 会自动 revert，报余额不足
        mkt.buyNFT(1);
        vm.stopPrank();
    }

    // 二、测试购买成功：token过多，并退回
    function test_buyOKReturnExtraMoney() public  noMarketERC20Token {
        // 1. artist mint 并转给 seller
        vm.startPrank(artist);
        _artistMintOnce(); // 假设 tokenId 是 1
        nft.safeTransferFrom(artist, seller, 1);
        vm.stopPrank();

        // 2. seller 上架 NFT，标价 100
        uint price = 100;
        vm.startPrank(seller);
        nft.approve(address(mkt), 1);
        mkt.list(1, price);
        vm.stopPrank();

        // 3. 给 richMan 足够多的钱（比如 1000）
        // 初始化一个富人
        address RichBuyer = vm.addr(uint256(keccak256("RichBuyer")));
        vm.startPrank(token.owner());
        token.transfer(RichBuyer, 1000);
        vm.stopPrank();

        // 4. richBuyer 授权并购买
        vm.startPrank(RichBuyer);
        token.approve(address(mkt), 1000);
        // 记录此时的余额，并购买
        uint256 buyerBalanceBefore = token.balanceOf(RichBuyer);
        uint256 sellerBalanceBefore = token.balanceOf(seller);
        mkt.buyNFT(1);

        // 4. 验证结果，buy尽管授权了1000但是只扣了100
        assertEq(nft.ownerOf(1), RichBuyer, "NFT should belong to buyer");

        uint256 buyerBalanceAfter = token.balanceOf(RichBuyer);
        uint256 sellerBalanceAfter = token.balanceOf(seller);

        assertEq(buyerBalanceBefore - buyerBalanceAfter, 100, "Buyer should only pay exact price");
        assertEq(sellerBalanceAfter - sellerBalanceBefore, 100, "Seller should receive exact price");

        vm.stopPrank();
    }

    // 三、测试随机使用 0.01-10000 Token价格上架NFT，并随机使用任意Address购买NFT
    function testFuzz_buyOKWithRandomPriceAndRandomBuyer(uint _randomPrice, uint _randomAddrSeed) public noMarketERC20Token {
        // 1.先min一个然后授权给seller
        vm.startPrank(artist);
        _artistMintOnce();
        nft.safeTransferFrom(artist, seller, 1);
        assertEq(nft.ownerOf(1), seller);
        vm.stopPrank();

        // 2. seller上架标价任意价格
        uint randomPrice = bound(_randomPrice, 0.01 ether, 10000 ether);
        vm.startPrank(seller);
        nft.approve(address(mkt), 1);
        // 期待事件
        vm.expectEmit(true, true, false, true);
        emit NftListed(seller, 1, randomPrice);
        //  触发事件
        mkt.list(1, randomPrice);
        vm.stopPrank();

        // 3. 随机买家
        uint randomBuyerSeed = bound(_randomAddrSeed, 1, 10000);
        address randomBuyer = vm.addr(randomBuyerSeed);
        vm.prank(token.owner());
        token.transfer(randomBuyer, 1e5 ether);

        // 4. 购买
        vm.startPrank(randomBuyer);
        token.approve(address(mkt), randomPrice);
        // 期待事件
        vm.expectEmit(true, true, false, true);
        emit NftSold(randomBuyer, 1, randomPrice);
        // 触发事件
        mkt.buyNFT(1);
        vm.stopPrank();
        assertEq(nft.ownerOf(1), randomBuyer);
    }
}