/**
 * 这个脚本用于检查 ERC20 Token 的基本信息
 * 包括 decimals, name, symbol 等
 * 
 * 使用方法：
 * npx tsx src/scripts/check-token-info.tsx
 */

import { createPublicClient, http, parseAbi } from 'viem';
import { foundry } from 'viem/chains';

// ERC20 合约地址
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const RPC_URL = process.env.NEXT_PUBLIC_ANVIL_RPC_URL || 'http://localhost:8545';

// ERC20 完整 ABI
const erc20Abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 value) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

// 创建客户端
const client = createPublicClient({
  chain: foundry,
  transport: http(RPC_URL),
});

// 主函数：获取 Token 信息
async function getTokenInfo() {
  console.log(`检查 Token 信息:`);
  console.log(`合约地址: ${CONTRACT_ADDRESS}`);
  console.log(`RPC URL: ${RPC_URL}`);

  try {
    // 尝试获取 Token 的名称
    try {
      const name = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'name',
      });
      console.log(`Token 名称: ${name}`);
    } catch (error) {
      console.error('获取 Token 名称失败:', error);
    }

    // 尝试获取 Token 的符号
    try {
      const symbol = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'symbol',
      });
      console.log(`Token 符号: ${symbol}`);
    } catch (error) {
      console.error('获取 Token 符号失败:', error);
    }

    // 尝试获取 Token 的精度
    try {
      const decimals = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals',
      });
      console.log(`Token 精度: ${decimals}`);
    } catch (error) {
      console.error('获取 Token 精度失败:', error);
    }

    // 尝试获取 Token 的总供应量
    try {
      const totalSupply = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'totalSupply',
      });
      console.log(`Token 总供应量: ${totalSupply}`);
      
      // 如果成功获取到 decimals，可以计算实际总供应量
      try {
        const decimals = await client.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: erc20Abi,
          functionName: 'decimals',
        }) as number;
        
        const actualSupply = Number(totalSupply) / (10 ** decimals);
        console.log(`Token 实际总供应量: ${actualSupply}`);
      } catch (error) {
        // 如果没有 decimals 函数，默认使用 18
        const actualSupply = Number(totalSupply) / (10 ** 18);
        console.log(`Token 估计总供应量 (假设精度为18): ${actualSupply}`);
      }
    } catch (error) {
      console.error('获取 Token 总供应量失败:', error);
    }
    
    console.log('Token 信息检查完成！');
  } catch (error) {
    console.error('检查 Token 信息失败:', error);
  }
}

// 执行主函数
getTokenInfo()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  }); 