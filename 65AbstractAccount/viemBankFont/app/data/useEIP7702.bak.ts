import { createPublicClient, createWalletClient, http, encodeFunctionData, getContract, formatEther, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains'
import type { TransactionReceipt, parseUnits } from 'viem';

import SimpleDelegateAbi from '../contracts/simpleDelegateContract.json' with { type: 'json' };
import ERC20Abi from '../contracts/token.json' with { type: 'json' };
import TokenBankAbi from '../contracts/bank.json' with { type: 'json' };
import 'dotenv/config';

// ====== 配置 ======

const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY as `0x${string}`;
const SIMPLE_DELEGATE_ADDRESS = process.env.DELEGATE_CONTRACT_ADDRESS as `0x${string}`;
const ERC20_ADDRESS = process.env.TOKEN_CONTRACT_ADDRESS as `0x${string}`;
const TOKENBANK_ADDRESS = process.env.TOKEN_BANK_CONTRACT_ADDRESS as `0x${string}`;

// deposit 参数
const DEPOSIT_AMOUNT = 1e4; // 10000 token


// 查询指定地址的链上代码
async function getCodeAtAddress(address: string, publicClient:any) {
  const code = await publicClient.getBytecode({ address: address as `0x${string}` });
  console.log(`地址 ${address} 的链上代码:`, code);
  return code;
}

async function getTokenBalance(userAddress: string, publicClient:any, walletClient:any) {
    const eoaTokenBalance = await publicClient.readContract({
        address: ERC20_ADDRESS,
        abi: ERC20Abi,
        functionName: 'balanceOf',
        args: [userAddress],
    });
    console.log(userAddress, ' ERC20余额:', formatEther(eoaTokenBalance));
    return eoaTokenBalance;
}

async function main() {

    const eoa = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(process.env.SEPOLIA_RPC_URL!),
    });

    const walletClient = createWalletClient({
        account: eoa,
        chain: sepolia,
        transport: http(process.env.SEPOLIA_RPC_URL!),
    } )   
  
  // 1. 构造 calldata
  const approveCalldata = encodeFunctionData({
    abi: ERC20Abi,
    functionName: 'approve',
    args: [TOKENBANK_ADDRESS, DEPOSIT_AMOUNT],
  });
  const depositCalldata = encodeFunctionData({
    abi: TokenBankAbi,
    functionName: 'deposit',
    args: [DEPOSIT_AMOUNT],
  });

  // 2. 构造批量 calls
  const calls = [
    {
      to: ERC20_ADDRESS,
      data: approveCalldata,
      value: 0n,
    },
    {
      to: TOKENBANK_ADDRESS,
      data: depositCalldata,
      value: 0n,
    },
  ];

  // 3. 构造 execute calldata
  const executeCalldata = encodeFunctionData({
    abi: SimpleDelegateAbi,
    functionName: 'execute',
    args: [calls],
  });


  await getTokenBalance(eoa.address, publicClient, walletClient);

  // 0. 查询eoa的链上代码
  const code = await getCodeAtAddress(eoa.address, publicClient);
  console.log('eoa的链上代码:', code);
  
  if (typeof code === 'string' && code.length > 0) {
    console.log('eoa的链上代码不为空');

    const hash = await walletClient.sendTransaction({
      to: eoa.address,
      data: executeCalldata,
    });
    console.log('直接向eoa发送交易, tx hash:', hash);
    const receipt: TransactionReceipt = await publicClient.waitForTransactionReceipt({ hash: hash })
    console.log('交易状态:', receipt.status === 'success' ? '成功' : '失败')

  } else {
      // 自己执行授权时，nonce +1 
    const authorization = await walletClient.signAuthorization({
      contractAddress: SIMPLE_DELEGATE_ADDRESS,
      executor: 'self', 
      account: eoa.address
    });


    // 发送 EIP-7702 交易
    try {
      const hash = await walletClient.writeContract({
        abi: SimpleDelegateAbi,
        address: eoa.address,
        functionName: 'execute',
        args: [calls],
        authorizationList: [authorization],
      });
      console.log('EIP-7702 批量交易已发送，tx hash:', hash);

      const receipt: TransactionReceipt = await publicClient.waitForTransactionReceipt({ hash: hash })
      console.log('交易状态:', receipt.status === 'success' ? '成功' : '失败')

    } catch (err) {
      console.error('发送 EIP-7702 交易失败:', err);
    }
  }

  // 检查bank下用户的存款数量
  await getTokenBalance(TOKENBANK_ADDRESS, publicClient, walletClient);
  await getTokenBalance(eoa.address, publicClient, walletClient);




  const cancelAuthorization = await walletClient.signAuthorization({
    contractAddress: zeroAddress,
    executor: 'self', 
  });

  const cancelHash = await walletClient.sendTransaction({ 
    authorizationList: [cancelAuthorization], 
    to: zeroAddress, 
  }) 

  const cancelReceipt: TransactionReceipt = await publicClient.waitForTransactionReceipt({ hash: cancelHash })
  console.log('取消 delegate 交易状态:', cancelReceipt.status === 'success' ? '成功' : '失败')

  await getCodeAtAddress(eoa.address, publicClient);

}

await main();