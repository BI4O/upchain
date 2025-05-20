import { publicActions, http, createWalletClient, parseEther, getContract, Hex, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import MyTokenABI from '../abis/MyToken.json';
import TokenBankABI from '../abis/tokenBank.json';

// 账户
const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const account = privateKeyToAccount(privateKey);

// 创建钱包客户端
export const client = createWalletClient({
  chain: foundry,
  transport: http("http://localhost:8545")
}).extend(publicActions);

// 合约地址
const tokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as Address;
const bankAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9" as Address;

// 初始化合约实例
const token = getContract({
  address: tokenAddress,
  abi: MyTokenABI,
  client: client,
});

const bank = getContract({
  address: bankAddress,
  abi: TokenBankABI,
  client: client,
});

// 帮助函数，用于处理BigInt序列化
function replacer(_key: string, value: any) {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

async function main() {
  console.log("------测试开始------");
  console.log(`账户地址: ${account.address}`);

  // 检查当前余额
  const balance = await token.read.balanceOf([account.address]);
  console.log(`当前代币余额: ${balance}`);

  // 检查银行中的余额
  const bankBalance = await bank.read.balanceOf([account.address]);
  console.log(`当前银行余额: ${bankBalance}`);

  // 使用普通deposit方法存款
  const depositAmount = parseEther("10");
  
  // 首先需要approve
  console.log(`\n------普通存款流程------`);
  console.log(`准备存入 ${depositAmount} 代币`);
  
  const approveTx = await token.write.approve([
    bankAddress,
    depositAmount
  ], {
    account: account
  });
  console.log(`授权交易哈希: ${approveTx}`);
  
  const depositTx = await bank.write.deposit([depositAmount], {
    account: account
  });
  console.log(`存款交易哈希: ${depositTx}`);
  
  // 检查存款后余额
  const balanceAfterDeposit = await token.read.balanceOf([account.address]);
  const bankBalanceAfterDeposit = await bank.read.balanceOf([account.address]);
  
  console.log(`存款后代币余额: ${balanceAfterDeposit}`);
  console.log(`存款后银行余额: ${bankBalanceAfterDeposit}`);

  // 使用permit方法存款
  console.log(`\n------使用permit存款流程------`);
  
  // 获取当前nonce
  const nonce = await token.read.nonces([account.address]);
  console.log(`当前nonce: ${nonce}`);

  // 获取chainId
  const chainId = await client.getChainId();
  
  // 获取域分隔符
  const domainSeparator = await token.read.DOMAIN_SEPARATOR();
  console.log(`合约域分隔符: ${domainSeparator}`);
  
  // 获取代币名称和版本
  const tokenName = await token.read.name() as string;
  console.log(`代币名称: ${tokenName}`);
  
  // 设置permit参数
  const permitAmount = parseEther("5");
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1小时后过期
  
  // EIP2612 permit格式
  const domain = {
    name: tokenName,  // 使用实际的代币名称
    version: '1',     // 这里版本可能需要调整
    chainId: chainId,
    verifyingContract: tokenAddress
  };
  
  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ]
  };
  
  const message = {
    owner: account.address,
    spender: bankAddress,
    value: permitAmount,
    nonce: nonce,
    deadline: deadline
  };
  
  console.log(`准备使用permit存入 ${permitAmount} 代币`);
  console.log(`Permit参数: `, JSON.stringify(message, replacer, 2));
  console.log(`Permit域: `, JSON.stringify(domain, replacer, 2));
  
  // 签名permit消息
  const signature = await client.signTypedData({
    account: account,
    domain: domain,
    types: types,
    primaryType: 'Permit',
    message: message
  });
  
  console.log(`已签名permit消息: ${signature}`);
  
  // 从签名中提取v, r, s
  const r = `0x${signature.substring(2, 66)}` as Hex;
  const s = `0x${signature.substring(66, 130)}` as Hex;
  const v = parseInt(signature.substring(130, 132), 16);
  
  console.log(`签名组件 - v: ${v}, r: ${r}, s: ${s}`);
  
  // 使用depositWithPermit方法
  try {
    const depositWithPermitTx = await bank.write.depositWithPermit([
      account.address,
      permitAmount,
      deadline,
      v,
      r,
      s
    ], {
      account: account
    });
    console.log(`Permit存款交易哈希: ${depositWithPermitTx}`);
  } catch (error) {
    console.error(`Permit存款失败，尝试其他方式...`);
    
    // 检查token是否正确授权给bank
    const allowance = await token.read.allowance([account.address, bankAddress]);
    console.log(`授权额度检查: ${allowance}`);
    
    // 尝试直接调用permit函数
    try {
      console.log(`尝试直接调用permit函数...`);
      const permitTx = await token.write.permit([
        account.address,
        bankAddress,
        permitAmount,
        deadline,
        v,
        r,
        s
      ], {
        account: account
      });
      console.log(`Permit交易哈希: ${permitTx}`);
      
      // 再次尝试存款
      const depositAgainTx = await bank.write.deposit([permitAmount], {
        account: account
      });
      console.log(`再次存款交易哈希: ${depositAgainTx}`);
    } catch (permitError) {
      console.log(`直接调用permit也失败，看起来签名可能有问题`);
    }
  }
  
  // 检查permit存款后余额
  const balanceAfterPermit = await token.read.balanceOf([account.address]);
  const bankBalanceAfterPermit = await bank.read.balanceOf([account.address]);
  
  console.log(`Permit存款后代币余额: ${balanceAfterPermit}`);
  console.log(`Permit存款后银行余额: ${bankBalanceAfterPermit}`);
  
  // 从银行中提取代币
  console.log(`\n------提取代币------`);
  
  try {
    const withdrawTx = await bank.write.withdraw([], {
      account: account
    });
    console.log(`提款交易哈希: ${withdrawTx}`);
  } catch (error) {
    console.error(`提款失败:`, error);
  }
  
  // 检查提款后余额
  const balanceAfterWithdraw = await token.read.balanceOf([account.address]);
  const bankBalanceAfterWithdraw = await bank.read.balanceOf([account.address]);
  
  console.log(`提款后代币余额: ${balanceAfterWithdraw}`);
  console.log(`提款后银行余额: ${bankBalanceAfterWithdraw}`);
  
  console.log("------测试完成------");
}

main().catch(console.error);
