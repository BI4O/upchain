// import { abi, contractAddress } from './contract'; // 包含 approveAndDeposit 的 ABI 和地址
import abi from '../contracts/simpleDelegateContract.json';
import tokenAbi from '../contracts/token.json';
import { createWalletClient, createPublicClient, http } from 'viem';
import { anvil, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { encodeFunctionData, parseEther, parseUnits } from 'viem';
import 'dotenv/config';

// 一、准备delegate合约的abi和地址
const contractAddress = process.env.DELEGATE_CONTRACT_ADDRESS as `0x${string}`;
const tokenAddress = process.env.TOKEN_CONTRACT_ADDRESS as `0x${string}`;
const tokenBankAddress = process.env.TOKEN_BANK_CONTRACT_ADDRESS as `0x${string}`;
console.log('contractAddress:', contractAddress);
console.log('tokenAddress:', tokenAddress);
console.log('tokenBankAddress:', tokenBankAddress);

// 二、创建账户和walletClient
const account = privateKeyToAccount(process.env.SEPOLIA_PRIVATE_KEY as `0x${string}`); 

const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL),
})
// 不需要.extend(eip7702Actions());了，因为viem已经支持了
const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL),
});

// 检查账户 token 余额
console.log('=== 检查账户状态 ===');
const tokenBalance = await publicClient.readContract({
    address: tokenAddress,
    abi: tokenAbi,
    functionName: 'balanceOf',
    args: [account.address],
});
console.log('Account token balance:', tokenBalance.toString());

// 三、签署授权，根据7702标准，需要指定执行者为自身
const authorization = await walletClient.signAuthorization({
    account: account,
    contractAddress,
});

// const hash1 = await walletClient.writeContract({ 
//     abi, 
//     address: account.address, 
//     authorizationList: [authorization], 
//     functionName: 'initialize', 
// }) 
// console.log('hash1:', hash1);
// console.log('=== 等待确认 ===');
// const receipt1 = await publicClient.waitForTransactionReceipt({ 
//     hash: hash1,
//     timeout: 120000, // 120 秒超时
// });

const hash2 = await walletClient.writeContract({
    abi,
    address: account.address,
    authorizationList: [authorization], 
    functionName: 'approveAndDeposit',
    args: [
        tokenAddress,     // 替换为您的 Token 合约地址
        tokenBankAddress, // 替换为您的 TokenBank 合约地址
        100, //  替换为您希望存入的金额
    ],
})
console.log('hash2:', hash2);

// 6. 等待确认
console.log('=== 等待确认 ===');
const receipt2 = await publicClient.waitForTransactionReceipt({ 
    hash: hash2,
    timeout: 120000, // 120 秒超时
});

console.log('Transaction status:', receipt2.status);
console.log('Gas used:', receipt2.gasUsed.toString());
console.log('Block number:', receipt2.blockNumber.toString());

// 8. 检查执行后状态
console.log('=== 检查执行后状态 ===');

// 检查 token 授权
const allowance = await publicClient.readContract({
    address: tokenAddress,
    abi: tokenAbi,
    functionName: 'allowance',
    args: [account.address, tokenBankAddress],
});
console.log('Token allowance to TokenBank:', allowance.toString());

// 再次检查 token 余额
const newTokenBalance = await publicClient.readContract({
    address: tokenAddress,
    abi: tokenAbi,
    functionName: 'balanceOf',
    args: [account.address],
});
console.log('New token balance:', newTokenBalance.toString());
console.log('Token used:', (tokenBalance - newTokenBalance).toString());

  
// // 四、执行函数
// const data = encodeFunctionData({
//   abi,
//   functionName: 'approveAndDeposit',
//   args: [
//     tokenAddress,     // 替换为您的 Token 合约地址
//     tokenBankAddress, // 替换为您的 TokenBank 合约地址
//     parseUnits('0.000000000001', 18), //  替换为您希望存入的金额
//   ],
// });


// // 五、发送交易
// // 注意这里是发送到EOA
// const hash = await walletClient.sendTransaction({
//     authorizationList: [authorization],
//     data,
//     to: walletClient.account.address,
// });

// // 六、等待交易确认
// console.log('Transaction hash:', hash);

