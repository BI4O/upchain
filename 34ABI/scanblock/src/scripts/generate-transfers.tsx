/**
 * 这个脚本用于在 Anvil 测试链上生成 Transfer 事件
 * 在本地链上发送一些测试交易
 * 
 * 使用方法：
 * npx tsx src/scripts/generate-transfers.tsx
 */

import { createWalletClient, http, parseAbi, parseEther } from 'viem';
import { foundry } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// 默认的 Anvil 开发账户私钥
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

// ERC20 合约地址
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const RPC_URL = process.env.NEXT_PUBLIC_ANVIL_RPC_URL || 'http://localhost:8545';

// ERC20 ABI
const erc20Abi = parseAbi([
  'function transfer(address to, uint256 value) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

// 创建钱包客户端
const walletClient = createWalletClient({
  chain: foundry,
  transport: http(RPC_URL),
  account,
});

// 随机地址生成
function randomAddress(): `0x${string}` {
  return `0x${[...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}` as `0x${string}`;
}

// 主函数：生成测试交易
async function generateTransfers(count: number) {
  console.log(`准备生成 ${count} 笔测试转账交易`);
  console.log(`使用账户: ${account.address}`);
  console.log(`合约地址: ${CONTRACT_ADDRESS}`);
  console.log(`RPC URL: ${RPC_URL}`);

  try {
    for (let i = 0; i < count; i++) {
      const to = randomAddress();
      const value = parseEther('0.01'); // 0.01 ETH
      
      console.log(`- 第 ${i + 1}/${count} 笔交易：发送 ${value} wei 到 ${to}`);
      
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [to, value],
      });
      
      console.log(`  交易已发送，哈希: ${hash}`);
      
      // 避免过快发送交易
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('所有测试交易已生成！');
  } catch (error) {
    console.error('生成测试交易失败:', error);
  }
}

// 解析命令行参数，默认生成 5 笔交易
const count = process.argv[2] ? parseInt(process.argv[2]) : 5;
generateTransfers(count)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  }); 