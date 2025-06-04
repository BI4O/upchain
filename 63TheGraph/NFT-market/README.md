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

得到部署地址
== Logs ==
  NFT deployed at: 0xEe02a124D8aF9224C8D9D4a22d4D4f6D11d96a84
  ERC20token deployed at: 0xeECbb63Bf30282048bdDe156F4451948c009AD87
  NFTMarket deployed at: 0x002c28A71e35f273C154399446112aE1c3e8F4e5

开源地址
https://sepolia.etherscan.io/address/0x002c28A71e35f273C154399446112aE1c3e8F4e5#code
