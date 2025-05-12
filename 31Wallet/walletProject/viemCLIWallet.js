import bip39 from 'bip39';
import { HDKey } from '@scure/bip32';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { createPublicClient, createWalletClient, http, parseEther, parseGwei, formatEther, formatUnits } from 'viem';
import { sepolia } from 'viem/chains';
import fs from 'fs';
import path from 'path';

// 钱包配置
const WALLET_CONFIG = {
  // 设置为true使用固定助记词，设置为false每次生成新助记词
  USE_FIXED_MNEMONIC: true,
  // 固定助记词，如果USE_FIXED_MNEMONIC=true，将使用这个值
  FIXED_MNEMONIC: "utility dinner again engine parade coil casual original cost tomorrow gentle journey", // 请替换为您的助记词
};

// LINK代币合约地址 (Sepolia测试网)
const LINK_CONTRACT_ADDRESS = "0x779877A7B0D9E8603169DdbD7836e478b4624789";
// 默认接收方地址
const DEFAULT_RECEIVER = "0x802f71cBf691D4623374E8ec37e32e26d5f74d87";

// 帮助函数 - 创建公共客户端
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://eth-sepolia.g.alchemy.com/v2/aCJ6h5b6OSIffC681c9fLBq0LlUqT1gr')
});

// 1. 生成账号
// 1.1 用随机生成私钥
function genAccRandom(){
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  console.log("随机生成私钥：", privateKey);
  console.log("对应地址:", account.address);
  return { account, privateKey };
}

// 读取助记词从文件
function readMnemonicFromFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8').trim();
    }
  } catch (error) {
    console.error("读取助记词文件失败:", error);
  }
  return null;
}

// 保存助记词到文件
function saveMnemonicToFile(mnemonic, filePath) {
  try {
    fs.writeFileSync(filePath, mnemonic);
    console.log(`助记词已保存到文件: ${filePath}`);
  } catch (error) {
    console.error("保存助记词文件失败:", error);
  }
}

// 1.2 用助记词
async function genAccByMnemonic(wordCount=12){
    let mnemonic;
    
    // 使用固定助记词
    if (WALLET_CONFIG.USE_FIXED_MNEMONIC) {
      mnemonic = WALLET_CONFIG.FIXED_MNEMONIC;
      console.log("使用固定助记词");
    } else {
      // 生成新助记词
      const strength = (wordCount / 3) * 32;
      mnemonic = bip39.generateMnemonic(strength);
      console.log("生成新助记词");
    }
    
    console.log("助记词: ", mnemonic);
    
    // 从助记词生成种子
    const seed = await bip39.mnemonicToSeed(mnemonic);
    // bip32 确定性分层
    const hdkey = HDKey.fromMasterSeed(seed);
    // bip44 路径定义
    const path = "m/44'/60'/0'/0/0";
    const childKey = hdkey.derive(path);
    
    // 确定0号账号  
    const privateKey = '0x' + Buffer.from(childKey.privateKey).toString('hex');
    const account = privateKeyToAccount(privateKey);
    console.log("私钥：", privateKey);
    return { account, privateKey};
}

// 1.3 连接区块链查一下ETH余额
async function getEthBalance(address){
    const balance = await publicClient.getBalance({address: address});
    return balance;
}

// 1.4 查询LINK代币余额
async function getLinkBalance(address) {
  try {
    // transfer(address,uint256)的ABI
    const balanceOfAbi = {
      inputs: [{ name: 'account', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    };
    
    const balance = await publicClient.readContract({
      address: LINK_CONTRACT_ADDRESS,
      abi: [balanceOfAbi],
      functionName: 'balanceOf',
      args: [address],
    });
    
    return balance;
  } catch (error) {
    console.error("获取LINK余额失败:", error);
    return BigInt(0);
  }
}

// 2. 构造ERC20转账交易对象
async function createTransaction(tokenAddress, from, to, tokenAmount, decimals = 18) {
  try {
    // 1. 使用ABI编码构建data字段 - 使用更可靠的方法
    // transfer(address,uint256)的函数签名
    const functionSignature = 'a9059cbb'; // 移除0x前缀
    
    // 接收地址，需要补齐到32字节(64个16进制字符)
    const toAddress = to.toLowerCase().replace(/^0x/, '').padStart(64, '0');
    
    // 代币数量，需要考虑decimals并转为16进制，然后补齐到32字节
    const valueInTokenUnits = BigInt(parseFloat(tokenAmount) * 10**decimals);
    const paddedValue = valueInTokenUnits.toString(16).padStart(64, '0');
    
    // 完整的data字段 - 确保只有一个0x前缀
    const data = `0x${functionSignature}${toAddress}${paddedValue}`;
    
    console.log("构造的data字段:", data);
    
    // 2. 获取nonce
    const nonce = await publicClient.getTransactionCount({
      address: from
    });
    
    // 3. 创建交易参数
    const txParams = {
      to: tokenAddress,
      data: data,
      value: BigInt(0),
      chainId: sepolia.id,
      // EIP-1559 交易
      maxFeePerGas: parseGwei('30'), // 从100降低到30
      maxPriorityFeePerGas: parseGwei('1.5'), // 从5降低到1.5
      gas: 100000n, // 从500000降低到100000
      nonce: nonce
    };
    
    console.log("交易参数:", txParams);
    return txParams;
  } catch (error) {
    console.error("创建交易对象失败:", error);
    throw error;
  }
}

// 创建ETH转账交易
async function createEthTransaction(from, to, valueInEther) {
  try {
    // 1. 获取nonce
    const nonce = await publicClient.getTransactionCount({
      address: from
    });
    
    // 2. 创建交易参数
    const txParams = {
      to: to,
      value: parseEther(valueInEther),
      chainId: sepolia.id,
      // EIP-1559 交易
      maxFeePerGas: parseGwei('40'), // 最大总费用
      maxPriorityFeePerGas: parseGwei('2'), // 最大小费
      gas: 30000n, // 普通ETH转账的gas限制
      nonce: nonce
    };
    
    console.log("ETH转账交易参数:", txParams);
    return txParams;
  } catch (error) {
    console.error("创建ETH转账交易失败:", error);
    throw error;
  }
}

// 发送LINK代币
async function transferLink(amount) {
  try {
    // 创建默认账户
    const {account, privateKey} = await genAccByMnemonic();
    const balance = await getEthBalance(account.address);
    
    console.log("钱包地址:", account.address);
    
    // 检查ETH余额为0的情况
    if (balance === 0n) {
      console.log("警告: 您的钱包中没有ETH来支付gas费用。在Sepolia测试网上，您需要从水龙头获取一些ETH。");
      console.log("您可以访问 https://sepoliafaucet.com/ 获取测试ETH");
      return; // 如果没有ETH则终止
    }
    
    // 创建钱包客户端
    const walletClient = createWalletClient({
      account, // 使用已生成的账户
      chain: sepolia,
      transport: http('https://eth-sepolia.g.alchemy.com/v2/aCJ6h5b6OSIffC681c9fLBq0LlUqT1gr')
    });
    
    console.log("\n准备构建LINK代币转账交易...");
    console.log(`准备发送 ${amount} LINK 到 ${DEFAULT_RECEIVER}`);
    
    // 构建交易对象
    const txParams = await createTransaction(
      LINK_CONTRACT_ADDRESS,  // 代币合约地址
      account.address,        // 发送方
      DEFAULT_RECEIVER,       // 接收方
      amount.toString(),      // 发送代币数量
      18                      // 精度
    );
    
    // 签名交易
    console.log("\n准备签名交易...");
    const signedTx = await walletClient.signTransaction(txParams);
    console.log("已签名交易:", signedTx);
    
    // 发送交易
    console.log("\n准备发送交易...");
    const txHash = await publicClient.sendRawTransaction({
      serializedTransaction: signedTx
    });
    
    console.log("\nLINK代币交易成功发送!");
    console.log("交易哈希:", txHash);
    console.log("您可以在以下链接查看交易状态:");
    console.log(`https://sepolia.etherscan.io/tx/${txHash}`);
  } catch (error) {
    console.error("发送LINK代币时发生错误:", error);
  }
}

// 打印ETH余额
async function printEthBalance() {
  try {
    const {account} = await genAccByMnemonic();
    const balance = await getEthBalance(account.address);
    console.log(`地址: ${account.address}`);
    console.log(`ETH余额: ${formatEther(balance)} ETH`);
  } catch (error) {
    console.error("获取ETH余额时发生错误:", error);
  }
}

// 打印LINK余额
async function printLinkBalance() {
  try {
    const {account} = await genAccByMnemonic();
    const balance = await getLinkBalance(account.address);
    console.log(`地址: ${account.address}`);
    console.log(`LINK余额: ${formatUnits(balance, 18)} LINK`);
  } catch (error) {
    console.error("获取LINK余额时发生错误:", error);
  }
}

// 命令行参数解析
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    printHelp();
    return;
  }

  const command = args[0];
  
  switch (command) {
    case '--balance-eth':
      await printEthBalance();
      break;
      
    case '--balance-link':
      await printLinkBalance();
      break;
      
    case '--new-account':
      genAccRandom();
      break;
      
    case '--transfer':
      if (args.length < 2) {
        console.log("错误: 缺少金额参数");
        console.log("用法: node zuoye.js --transfer <金额>");
        return;
      }
      const amount = parseFloat(args[1]);
      if (isNaN(amount)) {
        console.log("错误: 无效的金额参数");
        return;
      }
      await transferLink(amount);
      break;
      
    case '--help':
    default:
      printHelp();
      break;
  }
}

// 打印帮助信息
function printHelp() {
  console.log("\n以太坊钱包CLI工具 - 命令列表:");
  console.log("------------------------------------------");
  console.log("--balance-eth    查询默认账户的ETH余额");
  console.log("--balance-link   查询默认账户的LINK代币余额");
  console.log("--new-account    生成一个新的随机账户");
  console.log("--transfer <数量> 从默认账户发送指定数量的LINK代币");
  console.log("--help           显示帮助信息");
  console.log("------------------------------------------");
  console.log("示例: node viemCLIWallet.js --transfer 1.5");
  console.log("      node viemCLIWallet.js --balance-eth");
}

// 运行主函数
main().catch(console.error);

