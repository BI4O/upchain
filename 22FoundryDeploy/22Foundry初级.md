# 22 Foundry部署合约

### 部署+验证

##### script/erc20token.s.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {MyToken} from "../src/erc20token.sol";

contract DeployMyToken is Script {
    function run() external {
        // 读取私钥
        uint256 deployer = vm.envUint("PRIVATE_KEY");

        // 1. 开始广播
        vm.startBroadcast(deployer);

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

部署命令

`forge script ./script/erc20token.s.sol --rpc-url $RPC_URL_REMOTE --broadcast --etherscan-api-key=B2HGU4WMYQ42DMZWM9DFA3VV7QVAEEP4SK --verify`

- 需要指定rpc
- 需要指定私钥
- 需要指定etherscan api