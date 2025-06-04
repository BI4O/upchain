# NFT 市场
部署代码
```cmd
forge script script/NFTmarkst.s.sol:NFTMarketDeployScript \
  --private-key $DEPLOYER \
  --rpc-url $SEPOLIA_RPC_URL \
  --etherscan-api-key $ETHERSCAN_APIKEY \
  --chain-id $SEPOLIA_CHAINID \
  --broadcast \
  --verify
```

### 得到部署地址
== Logs ==
  NFT deployed at: 0xEe02a124D8aF9224C8D9D4a22d4D4f6D11d96a84
  ERC20token deployed at: 0xeECbb63Bf30282048bdDe156F4451948c009AD87
  NFTMarket deployed at: 0x002c28A71e35f273C154399446112aE1c3e8F4e5

### 开源地址
https://sepolia.etherscan.io/address/0x002c28A71e35f273C154399446112aE1c3e8F4e5#code

### 用高版本node
bi4o@Macbi4o 63TheGraph % nvm install 22
bi4o@Macbi4o 63TheGraph % nvm use 22
Now using node v22.16.0 (npm v10.9.2)

### 初始化本地文件
bi4o@Macbi4o 63TheGraph % graph init nft-market
✔ Network · Ethereum Sepolia Testnet · sepolia · https://sepolia.etherscan.io
✔ Directory to create the subgraph in · theGraph-NFTmarket
✔ Contract address · 0x002c28A71e35f273C154399446112aE1c3e8F4e5
✔ Contract name · NFTMarket
✔ Index contract events as entities (Y/n) · true
✔ Add another contract? (y/N) · false

进入文件夹
cdtheGraph-NFTmarket

链下验证一下
graph auth 3f99aa5e592caf94c1caf23ff593d9e6

编译
graph codegen && graph build

部署
graph deploy nft-market

然后你回到页面
https://thegraph.com/studio/subgraph/nft-market/
就显示已经部署了0.0.1版本了