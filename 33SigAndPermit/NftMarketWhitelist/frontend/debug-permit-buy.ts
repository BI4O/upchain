#!/usr/bin/env ts-node

const viem = require('viem');
const { createWalletClient, createPublicClient, http, parseEther, formatEther, formatUnits } = viem;
const { privateKeyToAccount } = require('viem/accounts');
const { foundry } = require('viem/chains');
const { keccak256, concat, numberToHex, toBytes } = viem;

// 合约地址
const MARKET_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
const NFT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const ERC20_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

// 在Forge/Foundry中，0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38是默认的发送者地址
// 这是由DEFAULT_SENDER常量计算得出的: address(uint160(uint256(keccak256("foundry default caller"))))
// 由于我们在测试环境中，我们需要工作在这个特定的约束下
// 我们将直接使用来自TestPermitBuy.ts的已知私钥

// Anvil节点的第一个预设账户私钥（买家）
const BUYER_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// 直接从前端查看模式更改为更简单的方法：
// 我们将使用测试页面创建签名，然后重用这个签名

// 创建买家账户
const buyerAccount = privateKeyToAccount(BUYER_PRIVATE_KEY as `0x${string}`);

// 创建可以使用签名的工具
const buyerClient = createWalletClient({
  chain: foundry,
  transport: http('http://127.0.0.1:8545'),
  account: buyerAccount
});

console.log(`买家账户地址: ${buyerAccount.address}`);

// 创建公共客户端
const publicClient = createPublicClient({
  chain: foundry,
  transport: http('http://127.0.0.1:8545')
});

// NFT和ERC20合约ABI
const NFT_ABI = [
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view'
  }
];

const MARKET_ABI = [
  {
    type: 'function',
    name: 'permitBuy',
    inputs: [
      { name: '_NftId', type: 'uint256' },
      { name: 'signature', type: 'bytes' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'sellerOfNFT',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'priceOfNFT',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'usedSignatures',
    inputs: [{ name: '', type: 'bytes' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'signer',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view'
  }
];

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable'
  }
];

// 主函数
async function main() {
  try {
    console.log('===== NFT白名单购买调试工具 =====');
    
    // 使用手动输入的签名
    console.log('\n===== 使用手动输入的签名 =====');
    // 这里使用您从测试页面生成并复制的签名
    const userSignature = process.argv[2] || ''; // 从命令行参数获取签名
    
    if (!userSignature) {
      console.error('❌ 请提供签名作为命令行参数');
      console.log('用法: npx ts-node debug-permit-buy.ts <签名>');
      console.log('您可以从测试页面生成签名，并复制到此处');
      return;
    }
    
    console.log(`使用签名: ${userSignature}`);
    
    // 检查合约状态
    const tokenId = BigInt(1); // 使用NFT #1作为示例
    console.log(`\n===== 检查NFT #${tokenId}状态 =====`);
    
    // 获取市场合约中的签名者地址
    const contractSigner = await publicClient.readContract({
      address: MARKET_ADDRESS as `0x${string}`,
      abi: MARKET_ABI,
      functionName: 'signer'
    }) as `0x${string}`;
    
    console.log(`合约中的签名者地址: ${contractSigner}`);
    
    // 检查NFT上架状态
    let seller = await publicClient.readContract({
      address: MARKET_ADDRESS as `0x${string}`,
      abi: MARKET_ABI,
      functionName: 'sellerOfNFT',
      args: [tokenId]
    }) as `0x${string}`;
    
    // 如果NFT未上架，显示错误并退出
    if (seller === '0x0000000000000000000000000000000000000000') {
      console.error(`❌ NFT #${tokenId}未上架或不存在`);
      console.log('请先使用市场页面上架NFT');
      return;
    }
    
    console.log(`NFT #${tokenId}卖家: ${seller}`);
    
    // 获取NFT价格
    const price = await publicClient.readContract({
      address: MARKET_ADDRESS as `0x${string}`,
      abi: MARKET_ABI,
      functionName: 'priceOfNFT',
      args: [tokenId]
    }) as bigint;
    
    console.log(`NFT #${tokenId}价格: ${formatUnits(price, 18)} TK (${price} wei)`);
    
    // 检查买家代币余额
    const balance = await publicClient.readContract({
      address: ERC20_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [buyerAccount.address]
    }) as bigint;
    
    console.log(`买家代币余额: ${formatUnits(balance, 18)} TK (${balance} wei)`);
    
    if (balance < price) {
      console.error(`❌ 代币余额不足，需要 ${formatUnits(price, 18)} TK`);
      return;
    }
    
    // 检查代币授权
    const allowance = await publicClient.readContract({
      address: ERC20_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [buyerAccount.address, MARKET_ADDRESS as `0x${string}`]
    }) as bigint;
    
    console.log(`代币授权额度: ${formatUnits(allowance, 18)} TK (${allowance} wei)`);
    
    if (allowance < price) {
      console.log('\n===== 授权代币 =====');
      console.log(`需要授权 ${formatUnits(price, 18)} TK`);
      
      const approveTx = await buyerClient.writeContract({
        address: ERC20_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [MARKET_ADDRESS as `0x${string}`, price]
      });
      
      console.log(`授权交易哈希: ${approveTx}`);
      
      // 检查新的授权额度
      const newAllowance = await publicClient.readContract({
        address: ERC20_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [buyerAccount.address, MARKET_ADDRESS as `0x${string}`]
      }) as bigint;
      
      console.log(`新的授权额度: ${formatUnits(newAllowance, 18)} TK (${newAllowance} wei)`);
      
      if (newAllowance < price) {
        console.error('❌ 授权失败');
        return;
      }
    }
    
    // 检查签名是否已使用
    try {
      const isUsed = await publicClient.readContract({
        address: MARKET_ADDRESS as `0x${string}`,
        abi: MARKET_ABI,
        functionName: 'usedSignatures',
        args: [userSignature as `0x${string}`]
      }) as boolean;
      
      if (isUsed) {
        console.error('❌ 此签名已被使用，无法继续');
        return;
      }
      
      console.log('✅ 签名未被使用，可以继续');
    } catch (error) {
      console.warn('⚠️ 检查签名状态失败，将继续尝试');
    }
    
    // 检查买家是否为卖家
    if (seller.toLowerCase() === buyerAccount.address.toLowerCase()) {
      console.error('❌ 买家不能购买自己的NFT');
      return;
    }
    
    // 一切检查通过，准备执行白名单购买
    console.log('\n===== 执行白名单购买 =====');
    console.log(`买家: ${buyerAccount.address}`);
    console.log(`NFT ID: ${tokenId}`);
    console.log(`价格: ${formatUnits(price, 18)} TK (${price} wei)`);
    console.log(`签名: ${userSignature}`);
    
    try {
      const permitBuyTx = await buyerClient.writeContract({
        address: MARKET_ADDRESS as `0x${string}`,
        abi: MARKET_ABI,
        functionName: 'permitBuy',
        args: [tokenId, userSignature as `0x${string}`]
      });
      
      console.log(`\n✅ 白名单购买交易发送成功!`);
      console.log(`交易哈希: ${permitBuyTx}`);
      
      // 等待交易确认并获取结果
      console.log(`\n正在等待交易确认...`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: permitBuyTx });
      
      console.log(`交易状态: ${receipt.status === 'success' ? '成功' : '失败'}`);
      console.log(`Gas消耗: ${receipt.gasUsed}`);
      
      if (receipt.status === 'success') {
        // 验证NFT所有权是否已转移给买家
        try {
          const newOwner = await publicClient.readContract({
            address: NFT_ADDRESS as `0x${string}`,
            abi: NFT_ABI,
            functionName: 'ownerOf',
            args: [tokenId]
          }) as `0x${string}`;
          
          console.log(`NFT #${tokenId}的新所有者: ${newOwner}`);
          
          if (newOwner.toLowerCase() === buyerAccount.address.toLowerCase()) {
            console.log(`✅ NFT所有权已成功转移给买家!`);
          } else {
            console.log(`❌ NFT所有权未转移给买家，当前所有者: ${newOwner}`);
          }
        } catch (error) {
          console.error('检查NFT所有权失败:', error);
        }
      }
    } catch (error) {
      console.error(`\n❌ 白名单购买失败:`, error);
      
      // 尝试分析错误原因
      const errorMessage = String(error);
      console.log('\n===== 错误分析 =====');
      
      if (errorMessage.includes('Signature already used')) {
        console.log('错误原因: 签名已被使用');
      } else if (errorMessage.includes('Not authorized: Invalid signature')) {
        console.log('错误原因: 签名无效或不是由授权签名者创建');
      } else if (errorMessage.includes('U already own it')) {
        console.log('错误原因: 买家已经是NFT的所有者');
      } else if (errorMessage.includes('NFT was sold or not exists')) {
        console.log('错误原因: NFT未上架或已售出');
      } else if (errorMessage.includes('You need more ERC20token')) {
        console.log('错误原因: 代币余额不足');
      } else {
        console.log(`错误原因: 未知 - ${errorMessage}`);
      }
    }
  } catch (error) {
    console.error('脚本执行失败:', error);
  }
}

// 运行主函数
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('程序执行失败:', error);
    process.exit(1);
  }); 