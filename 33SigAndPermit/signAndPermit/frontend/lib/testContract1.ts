import { publicActions, http, createWalletClient, parseEther, getContract, stringToHex, Hex, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import EIP191ABI from '../abis/EIP191.json';
import EIP712ABI from '../abis/EIP712.json';

// 账户
const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const account = privateKeyToAccount(privateKey);

// 创建钱包客户端
export const client = createWalletClient({
  chain: foundry,
  transport: http("http://localhost:8545")
}).extend(publicActions);

// const chainId = await client.getChainId();
// const blockNum = await client.getBlockNumber();
// const balance = await client.getBalance({address: account.address});
// console.log(`------
// 当前链：${chainId}
// 当前区块：${blockNum}
// 钱包余额：${balance}`);


// 712获取domain
// const { domain, extensions, fields } = await client.getEip712Domain({ 
//   address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
// })
// console.log(domain, extensions, fields);

// 191
async function verifyEIP191(
  stringMsg: string, 
  signature: Hex, 
  signer: Address,
  contractAddr: Address, 
){
  const hexMsg = stringToHex(stringMsg);
  const contract191 = getContract({
    address: contractAddr,
    abi: EIP191ABI,
    client: client,
  });

  const signer_ = await contract191.read.recover([hexMsg,signature]);
  const res =  signer_ === signer;
  console.log("EIP191验证结果：", res);
  return res;
}
// 模拟191验证
const msg1 = "hello world";
const sig191 = await account.signMessage({message:msg1});
const contractAddr191 = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const ok = await verifyEIP191(msg1,sig191,account.address,contractAddr191);

// 721
const contractAddr721 = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as `0x${string}`;
const domain = {
  name: 'EIP712Verifier',
  version: '1.0.0',
  chainId: foundry.id,
  verifyingContract: contractAddr721
}
const types = {
  Send: [
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' }
  ]
}
const msg2 = {
  to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`, 
  value: parseEther("0.01")
};
const signature2 = await client.signTypedData({
  account: account,
  domain: domain,
  types: types,
  primaryType: "Send",
  message: msg2,
})

// 验证函数：消息、签名、签名人、合约地址
async function verifyEIP721(
  objMsg:object,
  signature:Hex,
  signer:Address,
  contractAddr:Address,
){
  const contract721 = getContract({
    address:  contractAddr,
    abi: EIP712ABI,
    client: client,
  });
  
  const res = await contract721.read.verify([
    signer,
    objMsg,
    signature
  ])

  console.log("EIP721验证结果：",res);
  return res;
}
const ok2 = await verifyEIP721(msg2,signature2,account.address,contractAddr721);





