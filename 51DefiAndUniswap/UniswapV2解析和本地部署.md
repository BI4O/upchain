# Uniswap解析+本地部署

主要的项目结构

- ### Core

  - UniswapV2ERC20
  - UniswapV2Pair
  - UniswapV2Facotry

- ### Periphery

  - UniswapV2Router02

# UniswapV2ERC20

类似于基本的ERC20Permit

- permit()
- transfer()
- transferFrom()

# UniswapV2Pair

继承了UniswapV2ERC20，表示LP token代币，由Factory作为msg.sender创建并初始化

- factory：创建的Factory的地址
- token0：token0的地址
- token1：token1的地址
- reserver0：token0的数量
- reserver1：token1的数量
- price0CumulativeLast：token0在这个timestamp下的加权价格
- price1CumulativeLast：token1在这个timestamp下的加权价格
- blockTimestampLast：记录这些数量、价格的时间，一般保持最接近最新block.timestamp
- kLast：reserver0 * reserver1的值
- totalSupply：是继承自ERC20的，代表此时LP token的发行量

---

- ##### function initialize(address, address) external;

  - 输入两个ERC20的地址，只能由factory调用

  - 左边的记录为token0，右边的记录为token1

- ##### function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);

  - 返回两个token的数量、时间

- ###### function _update(uint balance0, uint balance1, uint112 _reserve0, uint112 _reserve1)

  - 私有函数，用来给mint/burn/swap调用，更新池子里的token数量
  - reserve0 = balance0
  - reserve1 = balance1

- ##### function mint(address to) external returns (uint liquidity);

  - 输入流动性提供者地址，接受token0和token1后返回给他的 LP token的数量
  - 马上计算此时合约内的token0/token1的数量，用来对比一下此前的数字（getReserve）
  - 算出你为池子贡献了多少**新增**的token0和token1（amount0/amount1）
  - 如果此时发行量=0，你是第一个流动性提供者，就奖励你sqrt(amount0 * amount1) - 1000个LP token，这1000个给0地址，相当于低池
  - 如果此时发行量>0，计算一下你的amount对现在reserve的提升比例，比如1%，就奖励你totalSupply*1%个LP token
  - 更新totalSupply，因为mint了新的LPtoken，又变大了1%
  - 确认成交，调用_update()来更新一下池子里的两个代币数量

- ##### function burn(address to) external returns (uint amount0, uint amount1);

  - 输入流动性提供者地址，返回应该给他返还的token0和token1数量
  - 算出你给池子**新增**了多少LPtoken，对比totalSupply比例
  - 比如你给合约转了100个LP，然后最新的LP totalSupply是10000，那么你就能拿走1%的两种代币
  - 转账token0和token1各1%给到流动性提供者，把收到的LPtoken销毁，totalSupply减去100，本合约里的LP余额减去100
  - 确认成交，调用_update()来更新一下池子里的两个代币数量

- ##### function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;

  - 指定要取那种币多少个，amount必须有一个为正，但是两个都不能穿池子
  - 先给你转amount0个token0和amount1个token1
  - 如果有data：执行一个回调函数**IUniswapV2Callee(to).uniswapV2Call(msg.sender, amount0Out, amount1Out, data);**
  - 计算你转进了池子多少个token0或token1(amountIn0/amountIn1)，两者必须有一个为正
  - 确认成交，调用_update()来更新一下池子里的两个代币数量

# UniswapV2Factory

- feeToSetter：合约创建时候指定的，池子的收益地址的指定人（uniswapV2官方）
- feeTo：池子的收益地址
- allPairs[addr]：所有已经创建的池子的地址（LP token的地址）
- getPair mapping(addr=>mapping(addr=>addr))：根据这个方法
  - getPair[tokenA]\[tokenB] 和 getPair[tokenB]\[tokenA]都是一样的pair合约地址 

---

- ##### function createPair(address tokenA, address tokenB) external returns (address pair)

  - 输入两个token合约的地址，返回一个ABpair合约的地址
  - 创建pair合约的时候需要用到已经部署的uniswapV2pair合约的bytecode
  - keccak256(abi.encode(tokenA,tokenB))作为salt
  - 拿着bytecode和salt去用create2来创建pair合约，也就是说只要uniswapV2pair合约部署了，tokenA/B的地址确定了，那么ABpair合约地址就确定了（tokenA的地址小于tokenB地址）
  - 初始化这个ABpair：IUniswapV2Pair(ABpair).initialize(tokenA, tokenB)
  - 记录到getPair映射，使得getPair

# UniswapV2Router02

> 如果Factory合约是pair的工厂，那么Router02合约就是Facotry的工厂，但是一个Factory对保存多个pair的信息，而Router合约只保存一个Factory

- factory：factory合约地址，创建时候指定
- WETH：WETH合约地址，创建时候指定

---

```solidity
// 添加流动性
function addLiquidity(
    address tokenA,
    address tokenB,
    uint amountADesired,
    uint amountBDesired,
    uint amountAMin,
    uint amountBMin,
    address to,
    uint deadline
) internal virtual returns (uint amountA, uint amountB,  uint liquidity)
```

- 如果tokenA-tokenB的Pair合约不存在，就新建一个Pair合约
- 获取这个tokenA和B的目前token余额getReserve
- 内部计算可以怎么按比例添加，如果你的min设置的比例不对，revert
- 最后告诉你实际添加了amount个A和amount个B并mint了liquidity个LPtoken给你

```solidity
// 兑换
function swapExactTokensForTokens(
    uint amountIn,             // 输入 Token 的确切数量（你要花的）
    uint amountOutMin,         // 你期望的最少输出 Token 数（滑点保护）
    address[] calldata path,   // 交换路径（例如 [DAI, WETH, USDC]）
    address to,                // 最终 Token 接收者地址
    uint deadline              // 超时时间戳
) external virtual override ensure(deadline) returns (uint[] memory amounts)
```

- 需要自己提供兑换的路径（oken合约
- 计算根据路径来说，计算每一步需要交换的amounts，已经扣掉0.3%手续费
  - 假设 path = [DAI, WETH, USDC]
  - amounts = [100 DAI, 0.05 WETH, 98 USDC]
- 检查最后的98是不是大于期望的最小输出量，如果可以，执行交换
- 把100DAI发向Pair(DAI-WETH)，然后执行多跳，最后把USDC发给to地址

# 闪电兑FlashSwap

## 一、初始化项目

```cmd
forge init
```

安装官方包

```cmd
forge install https://github.com/Uniswap/v2-core.git --no-git
forge install https://github.com/Uniswap/v2-periphery.git --no-git
forge install https://github.com/Uniswap/solidity-lib.git --no-git
forge install https://github.com/transmissions11/solmate.git --no-git
```

写好remapping到`foundry.toml`，以及关闭多版本检查

```toml
remappings = [
    "@uniswap/v2-core/contracts/=lib/v2-core/contracts/",
    "@uniswap/v2-periphery/contracts/=lib/v2-periphery/contracts/",
    "@uniswap/lib/contracts/=lib/solidity-lib/contracts/"
]

unchecked_cheatcode_artifacts = true
```

# 二、部署Uniswap

因为v2-core和v2-perihery非常坑，一个是0.5.16一个是0.6.6，然后这俩的代码中core的bytescode又是很关键的事情，于是需要分开build

##### script/import-factory.s.sol

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity =0.5.16;

//Do not remove this file otherwise you will not have the required artifacts.

import {UniswapV2Factory} from "@uniswap/v2-core/contracts/UniswapV2Factory.sol";
//import {UniswapV2Router02} from "@uniswap/v2-periphery/contracts/UniswapV2Router02.sol";
```

`forge build `

然后注释另一行，改成这样，或者你不改了直接拎新起一个文件

##### script/import-router.s.sol

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity =0.6.6;

//Do not remove this file otherwise you will not have the required artifacts.

// import {UniswapV2Factory} from "@uniswap/v2-core/contracts/UniswapV2Factory.sol";
import {UniswapV2Router02} from "@uniswap/v2-periphery/contracts/UniswapV2Router02.sol";
```

然后再一次`forge build`，这样应该就可以了，如果你先写好两个文件然后build，其实是两个文件对两个版本都build，但是我们又需要src/import-factory.s.sol编译文件里面的bytecode，所以尽量按照顺序来分两次build，

> [!note]
>
> 这里有一个关键的步骤，要去修改一下
>
> **lib/v2-periphery/contracts/libraries/UniswapV2Library.sol**
>
> ```solidity
>     // calculates the CREATE2 address for a pair without making any external calls
>     function pairFor(address factory, address tokenA, address tokenB) internal pure returns (address pair) {
>         (address token0, address token1) = sortTokens(tokenA, tokenB);
>         pair = address(uint(keccak256(abi.encodePacked(
>                 hex'ff',
>                 factory,
>                 keccak256(abi.encodePacked(token0, token1)),
>                 hex'e04b7751126569d9acca26c11cf961d1326a9998f49cab691625a1ac5324cbab' // init code hash
>             ))));
>     }
> ```
>
> 这里有一个`hex`的值，需要去`out/UniswapV2Pair.sol/UniswapV2Pair.json`的`bytecode`的`object`的一大串值去掉开头的`0x`，拿去keccak256tools里面，hex->hash，得到哈希值之后替代上图的`hex`的对应值

另外还有一个要import的文件，但是不需要考虑版本冲突

##### script/import-weth.s.sol

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.8.5;

import {WETH} from "../lib/solmate/src/tokens/WETH.sol";
```

最后执行一次`forge build`

### 部署脚本

##### script/uniswapDeployer.s.sol

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.8.5;

import {Script} from "../lib/forge-std/src/Script.sol";
import {StdCheats} from "../lib/forge-std/src/StdCheats.sol";

contract UniswapDeployer is Script, StdCheats {
    function run() public {
        // setFeeto，就是能指定谁来收1/6的手续的那个地址，实际上uniswap官方执行的
        // eth mainnet下的uniswap-factory的真实地址
        deployCodeTo(
            "UniswapV2Factory.sol:UniswapV2Factory",
            abi.encode(address(5555555555555555555555)),
            0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f
        );

        // 中间媒介ERC20
        deployCodeTo(
            "WETH.sol:WETH",
            0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
        );

        deployCodeTo(
            "UniswapV2Router02.sol:UniswapV2Router02",
            // factory的地址和weth的地址
            abi.encode(
                0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f,
                0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
            ),
            0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
        );
    }
}
```

需要有一个Token来和WETH作为测试对

##### src/Token.sol

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.8.20;
import {ERC20} from "solmate/tokens/ERC20.sol";

contract Token is ERC20("TokenA", "TKA", 18) {
    constructor() {
        _mint(msg.sender, 1_000_000 * 10 ** 18);
    }
}
```

## 三、测试模拟DEX部署和添加Pair

因为是foundry，这里直接以测试代提部署

##### test/uniswapDeployer.t.sol

```solidity
// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.8.5;

// 注意import接口的时候，是不会触发检查solidity版本的，所以不担心老代码的接口
// 以后也要注意用老代码测试模拟部署的时候尽量用接口+地址
import {Test} from "forge-std/Test.sol";
import {UniswapDeployer} from "../script/UniswapDeployer.s.sol";
import {IUniswapV2Factory} from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {IUniswapV2Router01} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import {WETH} from "solmate/tokens/WETH.sol";

import {Token} from "../src/Token.sol";

contract UniswapTests is Test {
    // eth mainnet下的uniswap-factory的真实地址
    IUniswapV2Factory factory =
        IUniswapV2Factory(0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f);

    // eth mainnet下的uniswap-weth的真实地址
    WETH deployedWeth =
        WETH(payable(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2));

    // eth mainnet下的uniswap-router的真实地址
    IUniswapV2Router02 router =
        IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);

    /*
    因为上面使用的是eth主网的真实地址，所以如果使用
    forge test 本地一次性模拟时候，setUp时必须的
    forge test --fork-url http://localhost:8545 的anvil模拟时候（sepolia同理），setUp看情况，如果你已经部署了就不用
    forge test --fork-url <Alchemy 主网的rpc> 的时候，setUp是会冲突的，因为主网已经部署过了uniswapV2
    */
    function setUp() public {
        // 用在script写好的部署脚本，那边的部署脚本指定了各个合约部署地址
        UniswapDeployer deployer = new UniswapDeployer();
        deployer.run();
    }

    function test_uniswapFactory() public view {
        assert(factory.feeToSetter() != address(0));
    }

    function test_wrappedEther() public view {
        // 这里应该是返回WETH这个名称，所以不为零长
        assert(abi.encode(deployedWeth.name()).length > 0);
    }

    function test_deployedRouter() public view {
        // 因为router在script里面部署的时候（上面的deployer.run）
        // router部署时候需要注意一下
        assert(router.WETH() != address(0));
    }

    function test_addLiqToken() public {
        Token token = new Token();
        // 因为是permit，先授权无限大给到uniswap，这样他就可以直接调用
        token.approve(address(router), type(uint).max);

        // 
        IUniswapV2Router01(router).addLiquidityETH{value: 10 ether}(
            address(token),
            token.balanceOf(address(this)),
            0,
            0,
            address(this),
            block.timestamp + 1000
        );
    }
}
```

##### 最后运行测试代码模拟sepolia部署

`forge test --fork-url https://eth-sepolia.g.alchemy.com/v2/aCJ6h5b6OSIffC681c9fLBq0LlUqT1gr`

会得到如下的信息

```cmd
Ran 4 tests for test/uniswapDeployer.t.sol:UniswapTests
[PASS] test_addLiqToken() (gas: 4628508)
[PASS] test_deployedRouter() (gas: 5683)
[PASS] test_uniswapFactory() (gas: 7847)
[PASS] test_wrappedEther() (gas: 9665)
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 7.76s (3.26s CPU time)
```

> 注意因为用的是mainnet的地址，所以你如果fork mainnet来部署的话会报错，因为那个地址已经被真的UniswapV2占用了