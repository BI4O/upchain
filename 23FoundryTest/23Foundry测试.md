# 23 Foundry测试

还是以ERC20为例

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 { 
    address public deployer;
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        _mint(msg.sender, 1e10*1e18);
        deployer = msg.sender;
    } 
}
```

## Forge test 命令

- 测试文件按照惯例用`xxx.t.sol`来表示
- 需要放在`test/`文件夹下
- 用`forge test`来运行`test`文件夹内所有的测试文件
  - `forge test --match-contract tokenTest`只运行匹配到的合约名
  - `forge test --match-test someFunc`只运行匹配到的测试（函数）名
  - `forge test --match-path someFileKeyWorld`只运行匹配到的文件名

> 注意：在使用`forge test --match-test someFunc`的时候需要，因为测试的函数名必须是`test`开头，比如`test_someFunc`，但是你用这个命令的时候却不能在关键词带这个`test`，你需要忽略这个`test`/`testFuzz`然后用后面的函数名来做搜索
>
> 匹配是模糊匹配，比如Work，`W`/`or`/`rk`都可以匹配到

## 测试合约

以test/MyToken.t.sol为例

```solidity
pragma solidity ^0.8.20;

// 必须导入这个工具包，vm和assert等函数都需要
import "forge-std/Test.sol";
// 导入你要测试的合约
import "../src/MyToken.sol";

contract TokenTest is Test {
		Mytoken internal token;
		address internal tokenOwner;
		address internal man1;
		address internal man2;
		
		// 后面每一个test函数都会先运行一次这个
		function setUp() public {
				token = new Mytoken();
				tokenOwner = token.deployer();
				man1 = vm.addr(1);
				man2 = vm.addr(uint(keccak256("man2")));
		}
		
		// 测试1
		function test_transfer() public {
				uint balanceBeforeTansfer = token.balanceOf(tokenOwner);
				
				// prank表示下一行的交易的calldata：{from: tokenOwner ...}
				vm.prank(tokenOwner);
				token.transfer(man1, 1 ether);
				
				// startPrank表示直到stopPrank都是：{from: tokenOwner ...}
				vm.startPrank(tokenOwner);
				token.transfer(man2, 2 ether);
				vm.stopPrank();
				
				// 等值校验
				assertEq(token.balanceOf(man1), 1 ether);
				
				unit balanceAfterTransfer = token.balanceOf(tokenOwner);
				assertEq(balanceBeforeTransfer, balanceAfterTransfer + 200);
				// emit校验，标准三步走expect + emit + call
        vm.expectEmit(true, true, false, true);
        emit SomeEvent(param1, param2, 100);
        token.somFuncMustEmit();
		}
}
```

- 状态变量只能是internal，写public也没啥关系，不过你生成getter是纯浪费资源，因为没有办法让别人跟你的测试合约做外部交互
- 对于Mytoken合约来说，deployer是合约的**状态变量**，但是在测试合约中，你必须要用`tokenOwner = token.deployer();`这样来获取，不要忘了小括号，本质上他们是getter函数。
- 原合约里面如果有mapping，那也要用`xxx = someMappint(xxx)`来获取，不是用中括号而是用小括号，因为对于外面的合约来说，所有的状态变量都是getter函数。

## 别忘了Approve

对于像market这种的合约，他要向ERC20合约账本和ERC721合约账本来发起记账的请求时候，是必须要先让出钱的人approve这个market合约，market合约才能向ERC合约发起转账的

#### ERC721

###### test contract

```solidity
// seller来做
vm.startPrank(seller);
// seller跟erc721账本说，让market来拿走我这个id=1的NFT去卖吧
nft.approve(address(mkt), 1);

// market向erc721账本说：seller让我帮他卖的id=1的NFT，定价100
mkt.list(1, 100);
vm.stopPrank();
```

###### origin contract

```solidity
function list(uint _NftId, uint _price) public {
    require(nft.ownerOf(_NftId) == msg.sender && _price > 0, "U must owner and price should > 0");

    // 2. 转移
    nft.safeTransferFrom(msg.sender, address(this), _NftId);

    // 3. 记账
    sellerOfNFT[_NftId] = msg.sender;
    priceOfNFT[_NftId] = _price;
}
```

- 因为是seller => mkt.list( nft.transfer() )的逻辑，不是seller => nft.transfer()，只要是经过了一个中介来调用账本，那么这个中介就必须要被授权才可以做转账。

#### ERC20

###### test contract

```solidity
// buyer 来做
vm.startPrank(buyer);
token.approve(address(mkt), 100);

// mkt取钱，如果余额的钱不够买id=1的NFT，则会revert
mkt.buyNFT(1);
vm.stopPrank();
assertEq(nft.ownerOf(1), buyer);
```

###### origin contract

```solidity
function buyNFT(uint _NftId) public {
    address buyer = msg.sender;
    address seller = sellerOfNFT[_NftId];
    uint price = priceOfNFT[_NftId];

    // 1. 确认卖家和买家不是同一个人，作品还在，购买者够钱
    require(seller != buyer, "U already own it");
    require(seller != address(0),"NFT was sold or not exists!");

    // 2. 转移
    token.safeTransferFrom(buyer, seller, price);
    nft.safeTransferFrom(address(this), buyer, _NftId);
  }
```

- 同样的道理，market拿buyer的token来买这个nft，也是需要buyer先授权
- 因为openzepplin的safeTransfer已经会帮你检查，如果
  - from（这里指的是测试里的buyer）的余额不够
  - 或者msg.sender（这里指的是测试里的market）的授权不够
  - 都会导致revert