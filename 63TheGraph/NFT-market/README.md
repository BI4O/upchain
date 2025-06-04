# TheGraph 来查询合约的事件
### Foundry部署合约到sepolia

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
```cmd
== Logs ==
  NFT deployed at: 0xEe02a124D8aF9224C8D9D4a22d4D4f6D11d96a84
  ERC20token deployed at: 0xeECbb63Bf30282048bdDe156F4451948c009AD87
  NFTMarket deployed at: 0x002c28A71e35f273C154399446112aE1c3e8F4e5
```

### 开源地址
[etherscan](https://sepolia.etherscan.io/address/0x002c28A71e35f273C154399446112aE1c3e8F4e5#code)

### 用高版本node
```cmd
bi4o@Macbi4o 63TheGraph % nvm install 22
bi4o@Macbi4o 63TheGraph % nvm use 22
Now using node v22.16.0 (npm v10.9.2)
```

### 初始化本地文件
```cmd
bi4o@Macbi4o 63TheGraph % graph init nft-market
✔ Network · Ethereum Sepolia Testnet · sepolia · https://sepolia.etherscan.io
✔ Directory to create the subgraph in · theGraph-NFTmarket
✔ Contract address · 0x002c28A71e35f273C154399446112aE1c3e8F4e5
✔ Contract name · NFTMarket
✔ Index contract events as entities (Y/n) · true
✔ Add another contract? (y/N) · false
```

### 进入文件夹

`cd nftmarket-test`

### 链下验证一下

`graph auth 3f99aa5e592caf94c1caf23ff593d9e6`

### 编译

`graph codegen && graph build`

### 部署

`graph deploy nftmarket-test`

然后你回到页面（注意用0x62B7bA3Ec9cAa1985d63f20651E1167ae8aDbb84钱包登陆theGraph）
https://thegraph.com/studio/subgraph/nftmarket-test/
就显示已经部署了0.0.1版本了

## 测试一下

- 可以用playground

  ```ts
  {
    nftListeds(first: 5) {
      id
      seller
      _NftId
      price
    }
    nftSolds(first: 5) {
      id
      buyer
      _NftId
      price
    }
  }
  ```

  ##### paly

  ```json
  {
    "data": {
      "nftListeds": [
        {
          "id": "0x3f4f34c0e6d026080d9bd642442b775f7b85f397fe2cf0feb0ab273c58fa63a74d000000",
          "seller": "0x802f71cbf691d4623374e8ec37e32e26d5f74d87",
          "_NftId": "3",
          "price": "3999"
        },
        {
          "id": "0x838a6a383e9eb162ca1890989337f637e14a9cc17471d455bd8bdeaace907b1c41010000",
          "seller": "0x802f71cbf691d4623374e8ec37e32e26d5f74d87",
          "_NftId": "4",
          "price": "4999"
        }
      ],
      "nftSolds": [
        {
          "id": "0x9d02d3b30d4a0a3efb70cf679299d3af66ec0eafbd750e5882f729087769c23b2b000000",
          "buyer": "0x62b7ba3ec9caa1985d63f20651e1167ae8adbb84",
          "_NftId": "4",
          "price": "4999"
        },
        {
          "id": "0xb12eac7527e9bc2472b67eff4dba748409fca8cf8998a19cdf61ab9e3921b17827000000",
          "buyer": "0x62b7ba3ec9caa1985d63f20651e1167ae8adbb84",
          "_NftId": "3",
          "price": "3999"
        }
      ]
    }
  }
  ```

  