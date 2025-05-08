# 22 Foundry入门

## 快速开始

## 一、安装Foundry框架

1. 下载安装包`curl -L https://foundry.paradigm.xyz | bash`

2. 启动安装`foundryup`

结束后检查是否安装成功：`forge --version` 得到：

```cmd
forge Version: 1.1.0-stable
Commit SHA: d484a00089d789a19e2e43e63bbb3f1500eb2cbf
Build Timestamp: 2025-04-30T13:50:49.971365000Z (1746021049)
Build Profile: maxperf
```

其实安装了好几个命令行工具（排名由常用到不常用）：

- forge：管理依赖、编译（构建）、运行、测试、部署
- cast：瑞士军刀，管理除了合约以外的所有元素，钱包，地址等
- anvil：启动一个本地的区块链网络，预设10个节点
- chisel：运行solidity的片段代码，类似ipython

## 二、初始化项目

`forge init hello_foundry`

会在当前目录新建一个叫**hello_foundry**的文件夹，进去看

<pre style="background-color: whitesmoke">$ cd hello_foundry
$ tree . -d -L 1
.
├── lib
├── script
├── src
└── test
</pre>

是个文件夹

- lib：放第三方库（node_modules）
- script：放所有的部署脚本
- src：放所有的合约
- test：放所有的测试脚本（命令用forge test就会运行全部的测试文件）

## 三、ERC20合约

以一个ERC20代码为例：src/myToken.sol

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

##### （一）安装三方库齐柏林：

- `forge install OpenZeppelin/openzeppelin-contracts`

##### （二）写简写映射：

- `./remapping.txt`中添加下面两行

```txt
@std=lib/forge-std/src/ 
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
```

##### （三）import

- 然后就可以用`"@openzeppelin/contracts/..."`来引入标准token代码

> 后续想要更新三方库：forge update openzeppelin-contracts
>
> 想要删除：forge remove openzeppelin-contracts

##### （四）写测试脚本

script/myToken.s.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;
import {Script, console} from "forge-std/Script.sol";
import {MyToken} from "../src/erc20token.sol";

contract DeployMyToken is Script {
    function run() external {
        // 1. 开始广播
        vm.startBroadcast();
        // 2. 部署
        MyToken token = new MyToken("MyToken", "MTK");
        // 3. 停止广播
        vm.stopBroadcast(); 
        // 4. 打印成功信息
        console.log("Deployed on chain ID:", block.chainid);
        console.log("Deployed succsee at:", address(token));
    }
}
```

## 四、部署合约

> 命令：forge create / forge script
>
> 参数：
>
> 1. --broadcast（比需要带的）
> 2. --rpc-url
> 3. --private-key / --account

离开Remix，没有配置好的模拟网络了，需要注意以下的问题

#### 部署在什么网络？

- ##### Option1：不指定

  - 默认不部署在什么网络，如果直接运行不指定就会**“假部署”**，仅仅帮你运行一次，无法交互；

- ##### Option2：本地的虚拟区块链网络：

  - 用一个命令行窗口运行：`anvil`，会显示10个虚拟的账号
  - 部署时候指定`--rpc-url http://localhost:8545`

- ##### Option3：指定具体RPC链接

  - 部署时候指定`--rpc-url https://eth-sepolia.g.alchemy.com/v2/..` 

- ##### Option4：指定RPC变量

  - 在`.env`中写下环境变量

    - `LC_RPC_URL=http://localhost:8545`
    - `SEP_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/..`

  - 命令行应用环境变量`source .env`，可以用`echo $LC_RPC_URL`试一下

  - 在`foundry.toml`框架设置中添加`[rpc_endpoints]`下两行

    ```toml
    [rpc_endpoints]
    local = "${LC_RPC_URL}"
    sepolia = "${RPC_URL_REMOTE}"
    ```

  - 部署时候指定`--rpc-url local`或者`--rpc-url local`

#### 用什么钱包部署？

- ##### Option1：指定具体私钥

  - 在部署时候指定`--private-key`来输入私钥

- ##### Option2：指定wallet变量

  - 在项目里存私钥，并命名为一个变量，后续`cast wallet list`可以看
  - `cast wallet import localWallet --private-key 实际私钥`
  - 这个私钥可以拿`anvil`里面给的10个之一，用来做本地节点部署
  - 在部署时候指定`--account localWallet`

#### 是否要验证？

- ##### Option1：部署的时候顺便验证

  - `forge script/forge create`时候添加`--verify`
  - 设置`.env`环境变量`ETHERSCAN_API_KEY=...`（推荐方式）
  - 部署命令指定`--etherscan-api-key`
  - 如果你两个地方都指定，那么环境变量优先

- ##### Option2：部署了之后再验证

#### 想清楚三个问题后，就可以部署

示例：

```cmd
forge script ./script/erc20token.s.sol \
--rpc-url $RPC_URL_REMOTE \
--broadcast \
--account myAccount \
--etherscan-api-key= $ETHRTSCAN_API_KEY \
--verify
```

## 五、合约交互

##### cast call可以调用合约

- 调用erc20的name
  - `cast call <contractAddr> "name()(string)"`
  - 后面的`(string)`表示用什么类型在命令行展示，如果不加则是16进制的编码，需要自己decode
- 调用