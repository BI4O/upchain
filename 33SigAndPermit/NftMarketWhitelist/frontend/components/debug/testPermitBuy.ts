import { publicActions, http, createWalletClient, parseEther, getContract, Hex, Address, keccak256, concat, encodeFunctionData, toBytes, bytesToHex, toHex, numberToHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import NFTMarketABI from '../../app/contract/NFTMarket_abi.json';
import NFTABI from '../../app/contract/NFT_abi.json';
import ERC20ABI from '../../app/contract/ERC20token_abi.json';

// 合约地址
const NFT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const ERC20_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
const MARKET_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
const SIGNER_ADDRESS = '0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38';

// 使用本地测试私钥（这些私钥只用于测试环境）
// Anvil节点默认账户的私钥
const DEFAULT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const BUYER_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

// 这个是特殊签名者的私钥 - 与SIGNER_ADDRESS对应
// 这是anvil 脚本中使用的第6个私钥
const SIGNER_PRIVATE_KEY = '0xed580fffea45726b2a1d568709dfe54cdb1999eac9f8a419d262841173f33329';

// 创建账户
const signerAccount = privateKeyToAccount(SIGNER_PRIVATE_KEY as `0x${string}`);
const buyerAccount = privateKeyToAccount(BUYER_PRIVATE_KEY);
const defaultAccount = privateKeyToAccount(DEFAULT_PRIVATE_KEY);

// 交易工具账户
const walletClient = createWalletClient({
  chain: foundry,
  transport: http('http://localhost:8545')
});

// 创建客户端
const client = createWalletClient({
  chain: foundry,
  transport: http('http://localhost:8545')
}).extend(publicActions);

// 初始化合约实例
const nftContract = getContract({
  address: NFT_ADDRESS as Address,
  abi: NFTABI,
  client,
});

const erc20Contract = getContract({
  address: ERC20_ADDRESS as Address, 
  abi: ERC20ABI,
  client,
});

const marketContract = getContract({
  address: MARKET_ADDRESS as Address,
  abi: NFTMarketABI,
  client,
});

// 帮助函数，处理BigInt序列化
function replacer(_key: string, value: any) {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

// 创建签名函数
async function createSignature(buyer: Address, tokenId: bigint) {
  console.log(`为买家 ${buyer} 创建NFT #${tokenId}的购买签名`);
  
  try {
    // 1. 创建原始消息 (abi.encodePacked(buyer, tokenId))
    // 将tokenId转换为32字节的hex字符串
    const encodedTokenId = numberToHex(tokenId, { size: 32 });
    
    console.log(`买家地址: ${buyer}`);
    console.log(`编码后的tokenId: ${encodedTokenId}`);
    
    // 拼接地址和tokenId - 与Solidity中的abi.encodePacked(buyer, tokenId)一致
    const packedMessage = concat([buyer, encodedTokenId]);
    console.log(`拼接后的消息: ${packedMessage}`);
    
    // 计算消息哈希
    const messageHash = keccak256(packedMessage);
    console.log(`消息哈希: ${messageHash}`);
    
    // 2. 使用签名者私钥签名消息哈希 - 这里使用不同的签名方式尝试
    console.log(`签名者账户地址: ${signerAccount.address}`);
    console.log(`合约中的签名者地址: ${SIGNER_ADDRESS}`);
    console.log(`签名者地址匹配: ${signerAccount.address.toLowerCase() === SIGNER_ADDRESS.toLowerCase() ? '✅ 匹配' : '❌ 不匹配'}`);
    
    console.log(`使用签名者账户 ${signerAccount.address} 进行签名...`);
    
    // 直接调用底层signMessage方法，不应用以太坊签名前缀（因为合约可能会自己做）
    const signature = await client.signMessage({
      account: signerAccount,
      message: { raw: toBytes(messageHash) }
    });
    
    console.log(`生成的签名: ${signature}`);
    
    // 解析签名组件
    const r = `0x${signature.slice(2, 66)}`;
    const s = `0x${signature.slice(66, 130)}`;
    const v = parseInt(signature.slice(130, 132), 16);
    
    console.log(`签名组件 - v: ${v}`);
    console.log(`签名组件 - r: ${r}`);
    console.log(`签名组件 - s: ${s}`);
    
    return signature;
  } catch (error) {
    console.error('签名创建失败:', error);
    throw error;
  }
}

// 主测试函数
async function testPermitBuy() {
  try {
    console.log("===== NFT白名单购买测试 =====");
    console.log(`买家地址: ${buyerAccount.address}`);
    console.log(`签名者地址: ${signerAccount.address}，期望: ${SIGNER_ADDRESS}`);
    console.log(`市场合约地址: ${MARKET_ADDRESS}`);
    
    // 步骤1: 检查合约状态
    console.log("\n1. 检查合约部署状态...");
    const contractSigner = await marketContract.read.signer() as Address;
    console.log(`合约中的签名者地址: ${contractSigner}`);
    console.log(`签名者地址检查: ${contractSigner.toLowerCase() === signerAccount.address.toLowerCase() ? '✅ 匹配' : '❌ 不匹配'}`);
    
    if (contractSigner.toLowerCase() !== signerAccount.address.toLowerCase()) {
      console.log(`⚠️ 警告: 签名者地址不匹配，可能会导致签名验证失败!`);
      console.log(`确认此私钥(${SIGNER_PRIVATE_KEY})对应的地址是否与合约中设置的签名者地址(${contractSigner})一致`);
    }

    // 步骤1.5: 为买家提供代币
    console.log("\n1.5 为买家提供ERC20代币...");
    try {
      // 直接使用transfer代替mint
      const transferAmount = parseEther('10');
      const transferTx = await erc20Contract.write.transfer([buyerAccount.address, transferAmount], {
        account: defaultAccount
      });
      console.log(`代币转账交易哈希: ${transferTx}`);
    } catch (error) {
      console.error(`代币转账失败:`, error);
    }
    
    // 步骤2: 上架一个NFT (假设NFT #1已铸造但尚未上架)
    console.log("\n2. 铸造和上架NFT...");
    const tokenId = BigInt(1);
    
    try {
      // 先确认是否需要铸造
      let nftOwner;
      try {
        nftOwner = await nftContract.read.ownerOf([tokenId]);
        console.log(`NFT #${tokenId} 已存在，所有者: ${nftOwner}`);
      } catch (error) {
        console.log(`NFT #${tokenId} 尚未铸造，现在铸造...`);
        const mintTx = await nftContract.write.mint([buyerAccount.address], {
          account: buyerAccount
        });
        console.log(`铸造交易哈希: ${mintTx}`);
        nftOwner = buyerAccount.address;
      }
      
      // 检查NFT是否已经在市场上架
      const seller = await marketContract.read.sellerOfNFT([tokenId]);
      const price = await marketContract.read.priceOfNFT([tokenId]);
      
      if (seller === '0x0000000000000000000000000000000000000000' || price === BigInt(0)) {
        console.log(`NFT #${tokenId} 尚未上架，现在准备上架...`);
        
        // 授权NFT给市场合约
        if (nftOwner === buyerAccount.address) {
          const approveTx = await nftContract.write.approve([MARKET_ADDRESS, tokenId], {
            account: buyerAccount
          });
          console.log(`NFT授权交易哈希: ${approveTx}`);
          
          // 上架NFT
          const listPrice = parseEther('1'); // 上架价格为1个代币
          const listTx = await marketContract.write.list([tokenId, listPrice], {
            account: buyerAccount
          });
          console.log(`NFT上架交易哈希: ${listTx}`);
          console.log(`NFT #${tokenId} 已上架，价格: ${listPrice}`);
        } else {
          console.log(`无法上架NFT，当前账户不是所有者`);
        }
      } else {
        console.log(`NFT #${tokenId} 已经上架，卖家: ${seller}, 价格: ${price}`);
      }
    } catch (error) {
      console.error(`NFT准备阶段出错:`, error);
      return "测试失败: NFT准备阶段出错";
    }
    
    // 步骤3: 检查代币余额
    console.log("\n3. 检查买家代币余额...");
    const balance = await erc20Contract.read.balanceOf([buyerAccount.address]) as bigint;
    console.log(`买家代币余额: ${balance}`);
    
    // 获取NFT价格
    const price = await marketContract.read.priceOfNFT([tokenId]) as bigint;
    console.log(`NFT #${tokenId} 价格: ${price}`);
    
    if (balance < price) {
      console.log(`⚠️ 代币余额不足，需要获取更多代币`);
      // 这里可以添加获取更多代币的逻辑，例如从主账户转账等
    } else {
      console.log(`✅ 代币余额充足`);
    }
    
    // 步骤4: 授权代币
    console.log("\n4. 授权代币给市场合约...");
    const approveTx = await erc20Contract.write.approve([MARKET_ADDRESS, price], {
      account: buyerAccount
    });
    console.log(`代币授权交易哈希: ${approveTx}`);
    
    // 步骤5: 创建白名单签名
    console.log("\n5. 创建白名单购买签名...");
    const signature = await createSignature(buyerAccount.address as Address, tokenId);
    
    // 步骤6: 检查签名是否已被使用
    console.log("\n6. 检查签名使用状态...");
    const isUsed = await marketContract.read.usedSignatures([signature]);
    console.log(`签名使用状态: ${isUsed ? '已使用' : '未使用'}`);
    
    if (isUsed) {
      console.log(`❌ 签名已被使用，无法继续`);
      return "测试失败: 签名已被使用";
    }
    
    // 步骤7: 执行permitBuy购买
    console.log("\n7. 执行白名单购买...");
    try {
      const permitBuyTx = await marketContract.write.permitBuy([tokenId, signature], {
        account: buyerAccount
      });
      console.log(`白名单购买交易哈希: ${permitBuyTx}`);
      console.log(`✅ 白名单购买成功!`);
    } catch (error: any) {
      console.error(`❌ 白名单购买失败:`, error);
      return `测试失败: ${error.message || '未知错误'}`;
    }
    
    // 步骤8: 验证购买结果
    console.log("\n8. 验证购买结果...");
    
    // 检查NFT新所有者
    try {
      const newOwner = await nftContract.read.ownerOf([tokenId]);
      console.log(`NFT #${tokenId} 新所有者: ${newOwner}`);
      console.log(`所有权验证: ${newOwner === buyerAccount.address ? '✅ 已转移给买家' : '❌ 未成功转移'}`);
    } catch (error) {
      console.error(`检查NFT所有权失败:`, error);
    }
    
    // 检查签名使用状态
    const isUsedAfter = await marketContract.read.usedSignatures([signature]);
    console.log(`签名使用状态: ${isUsedAfter ? '已使用' : '未使用'}`);
    console.log(`签名状态验证: ${isUsedAfter ? '✅ 已正确标记为已使用' : '❌ 未正确标记'}`);
    
    console.log("\n===== 测试完成 =====");
    return "测试成功完成！";
  } catch (error: any) {
    console.error("测试过程中发生未捕获的错误:", error);
    return `测试失败: ${error.message || '未知错误'}`;
  }
}

export default testPermitBuy;

// 直接执行测试函数（当通过命令行运行时）
if (require.main === module) {
  console.log('脚本开始执行...');
  testPermitBuy()
    .then(result => console.log(`\n最终结果: ${result}`))
    .catch(error => console.error(`\n执行出错: ${error}`));
} 