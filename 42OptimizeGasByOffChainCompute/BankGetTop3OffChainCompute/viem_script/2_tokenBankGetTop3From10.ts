import { createPublicClient, createWalletClient, http, parseAbi, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as fs from 'fs';

// 合约地址信息
const MYTOKEN_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const TOKENBANK_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

// 测试账户
const ACCOUNTS = [
  { 
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const,
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const 
  },
  { 
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const,
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const 
  },
  { 
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as const,
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' as const 
  },
  { 
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' as const,
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6' as const 
  },
  { 
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65' as const,
    privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a' as const 
  }
];

// 读取合约ABI
const tokenBankAbi = JSON.parse(fs.readFileSync('./TokenBank.json', 'utf8'));
const myTokenAbi = JSON.parse(fs.readFileSync('./MyToken.json', 'utf8'));

// 创建客户端
const publicClient = createPublicClient({
  chain: foundry,
  transport: http()
});

// 链表头常量
const HEAD = '0x0000000000000000000000000000000000000001';
type Address = string;

// 查找插入位置的函数 (线下计算)
async function findInsertPosition(user: Address, newBalance: bigint): Promise<{ fromWhom: Address, toWhom: Address }> {
  console.log(`计算用户 ${user} 存入后余额 ${newBalance} 的插入位置...`);
  
  // 检查用户是否已在链表中
  const nextUser = await publicClient.readContract({
    address: TOKENBANK_ADDRESS,
    abi: tokenBankAbi,
    functionName: 'nextUser',
    args: [user]
  }) as Address;
  
  console.log(`用户 ${user} 的下一个用户是: ${nextUser}`);
  
  // 如果是新用户
  if (nextUser === '0x0000000000000000000000000000000000000000') {
    console.log(`用户 ${user} 是新用户，需要找到合适的插入位置`);
    const fromWhom = '0x0000000000000000000000000000000000000000' as Address;
    
    // 找到合适的插入位置
    let curr: Address = HEAD;
    let next = await publicClient.readContract({
      address: TOKENBANK_ADDRESS,
      abi: tokenBankAbi,
      functionName: 'nextUser',
      args: [curr]
    }) as Address;
    
    while (next !== HEAD) {
      const nextBalance = await publicClient.readContract({
        address: TOKENBANK_ADDRESS,
        abi: tokenBankAbi,
        functionName: 'balanceOf',
        args: [next]
      }) as bigint;
      
      console.log(`检查节点 ${next}，余额: ${nextBalance}`);
      
      if (nextBalance < newBalance) {
        console.log(`找到插入位置: ${next} 的余额 ${nextBalance} < 新余额 ${newBalance}`);
        break;
      }
      
      curr = next;
      next = await publicClient.readContract({
        address: TOKENBANK_ADDRESS,
        abi: tokenBankAbi,
        functionName: 'nextUser',
        args: [curr]
      }) as Address;
    }
    
    const toWhom = curr;
    console.log(`新用户插入位置: fromWhom=${fromWhom}, toWhom=${toWhom}`);
    return { fromWhom, toWhom };
  } 
  // 已存在的用户
  else {
    console.log(`用户 ${user} 是已存在的用户，需要找到当前位置和新位置`);
    
    // 找到用户前一个节点
    let prev: Address = HEAD;
    let curr = await publicClient.readContract({
      address: TOKENBANK_ADDRESS,
      abi: tokenBankAbi,
      functionName: 'nextUser',
      args: [prev]
    }) as Address;
    
    while (curr !== HEAD && curr !== user) {
      console.log(`遍历链表: 当前节点 ${curr}`);
      prev = curr;
      curr = await publicClient.readContract({
        address: TOKENBANK_ADDRESS,
        abi: tokenBankAbi,
        functionName: 'nextUser',
        args: [curr]
      }) as Address;
    }
    
    // 确保找到了用户
    if (curr !== user) {
      throw new Error(`未在链表中找到用户 ${user}`);
    }
    
    const fromWhom = prev;
    console.log(`找到用户在链表中的位置: 前一个节点=${fromWhom}`);
    
    // 如果余额变为0，无需重新插入
    if (newBalance === 0n) {
      console.log(`用户 ${user} 的新余额为0，不需要重新插入`);
      return { fromWhom, toWhom: '0x0000000000000000000000000000000000000000' };
    }
    
    // 找到正确的新位置
    let insertAfter: Address = HEAD;
    let insertNext = await publicClient.readContract({
      address: TOKENBANK_ADDRESS,
      abi: tokenBankAbi,
      functionName: 'nextUser',
      args: [insertAfter]
    }) as Address;
    
    // 遍历链表找到合适的插入点
    while (insertNext !== HEAD) {
      // 跳过用户自己
      if (insertNext === user) {
        insertAfter = insertNext;
        insertNext = await publicClient.readContract({
          address: TOKENBANK_ADDRESS,
          abi: tokenBankAbi,
          functionName: 'nextUser',
          args: [insertNext]
        }) as Address;
        continue;
      }
      
      const insertNextBalance = await publicClient.readContract({
        address: TOKENBANK_ADDRESS,
        abi: tokenBankAbi,
        functionName: 'balanceOf',
        args: [insertNext]
      }) as bigint;
      
      console.log(`检查节点 ${insertNext}，余额: ${insertNextBalance}`);
      
      // 找到第一个余额小于新余额的用户
      if (insertNextBalance < newBalance) {
        console.log(`找到插入位置: ${insertNext} 的余额 ${insertNextBalance} < 新余额 ${newBalance}`);
        break;
      }
      
      insertAfter = insertNext;
      insertNext = await publicClient.readContract({
        address: TOKENBANK_ADDRESS,
        abi: tokenBankAbi,
        functionName: 'nextUser',
        args: [insertAfter]
      }) as Address;
    }
    
    // 如果新位置在旧位置之后，无需移动
    if (fromWhom === insertAfter) {
      console.log(`用户无需移动，保持在原位置`);
      return { fromWhom, toWhom: fromWhom };
    }
    
    // 如果新位置紧接在用户之前，无需移动
    const nextAfterInsert = await publicClient.readContract({
      address: TOKENBANK_ADDRESS,
      abi: tokenBankAbi,
      functionName: 'nextUser',
      args: [insertAfter]
    }) as Address;
    
    if (nextAfterInsert === user) {
      console.log(`用户无需移动，保持在原位置`);
      return { fromWhom, toWhom: fromWhom };
    }
    
    const toWhom = insertAfter;
    console.log(`现有用户新插入位置: fromWhom=${fromWhom}, toWhom=${toWhom}`);
    return { fromWhom, toWhom };
  }
}

// 测试多个用户存款
async function testMultipleDeposits() {
  console.log("===== 开始测试多个用户存款 =====");
  
  // 定义测试用户和存款金额
  const depositAmounts = [
    { user: ACCOUNTS[0], amount: parseEther('1000') },
    { user: ACCOUNTS[1], amount: parseEther('2000') },
    { user: ACCOUNTS[2], amount: parseEther('1500') },
    { user: ACCOUNTS[3], amount: parseEther('3000') },
    { user: ACCOUNTS[4], amount: parseEther('500') }
  ];
  
  // 授权和存款
  for (const { user, amount } of depositAmounts) {
    const account = privateKeyToAccount(user.privateKey);
    
    // 创建用户钱包客户端
    const walletClient = createWalletClient({
      account,
      chain: foundry,
      transport: http()
    });
    
    console.log(`\n用户 ${user.address} 准备存入 ${amount} 代币...`);
    
    // 查询用户代币余额
    const balance = await publicClient.readContract({
      address: MYTOKEN_ADDRESS,
      abi: myTokenAbi,
      functionName: 'balanceOf',
      args: [user.address]
    });
    
    console.log(`用户 ${user.address} 当前余额: ${balance}`);
    
    // 授权代币给银行合约
    console.log(`授权代币给银行合约...`);
    await walletClient.writeContract({
      address: MYTOKEN_ADDRESS,
      abi: myTokenAbi,
      functionName: 'approve',
      args: [TOKENBANK_ADDRESS, amount]
    });
    
    console.log(`授权成功，查询授权额度...`);
    const allowance = await publicClient.readContract({
      address: MYTOKEN_ADDRESS,
      abi: myTokenAbi,
      functionName: 'allowance',
      args: [user.address, TOKENBANK_ADDRESS]
    });
    
    console.log(`银行合约授权额度: ${allowance}`);
    
    // 计算存款位置
    console.log(`计算存款位置...`);
    const currentBalance = await publicClient.readContract({
      address: TOKENBANK_ADDRESS,
      abi: tokenBankAbi,
      functionName: 'balanceOf',
      args: [user.address]
    }) as bigint;
    
    const newBalance = currentBalance + amount;
    const { fromWhom, toWhom } = await findInsertPosition(user.address, newBalance);
    
    // 存款
    console.log(`执行存款交易...`);
    await walletClient.writeContract({
      address: TOKENBANK_ADDRESS,
      abi: tokenBankAbi,
      functionName: 'deposit',
      args: [amount, fromWhom, toWhom]
    });
    
    // 确认存款成功
    const newBalanceAfter = await publicClient.readContract({
      address: TOKENBANK_ADDRESS,
      abi: tokenBankAbi,
      functionName: 'balanceOf',
      args: [user.address]
    });
    
    console.log(`存款后，用户 ${user.address} 在银行的余额: ${newBalanceAfter}`);
  }
  
  // 查询前3名存款用户
  console.log(`\n获取前3名存款用户...`);
  
  const top3 = await publicClient.readContract({
    address: TOKENBANK_ADDRESS,
    abi: tokenBankAbi,
    functionName: 'getTopDepositors',
    args: [3n]
  }) as Address[];
  
  console.log("前3名存款用户:");
  for (let i = 0; i < top3.length; i++) {
    const address = top3[i];
    const balance = await publicClient.readContract({
      address: TOKENBANK_ADDRESS,
      abi: tokenBankAbi,
      functionName: 'balanceOf',
      args: [address]
    });
    console.log(`#${i+1}: ${address} - 余额: ${balance}`);
  }
}

// 测试存款和取款
async function testDepositAndWithdraw() {
  console.log("\n===== 开始测试存款和取款 =====");
  
  const user = ACCOUNTS[3]; // 使用第4个账户
  const account = privateKeyToAccount(user.privateKey);
  
  // 创建用户钱包客户端
  const walletClient = createWalletClient({
    account,
    chain: foundry,
    transport: http()
  });
  
  // 获取当前余额
  const currentBalance = await publicClient.readContract({
    address: TOKENBANK_ADDRESS,
    abi: tokenBankAbi,
    functionName: 'balanceOf',
    args: [user.address]
  }) as bigint;
  
  console.log(`用户 ${user.address} 当前银行余额: ${currentBalance}`);
  
  // 取款金额
  const withdrawAmount = parseEther('1000');
  console.log(`准备取款 ${withdrawAmount} 代币...`);
  
  // 计算取款后的新余额
  const newBalance = currentBalance - withdrawAmount;
  
  // 计算取款的位置
  const { fromWhom, toWhom } = await findInsertPosition(user.address, newBalance);
  
  // 执行取款
  console.log(`执行取款交易...`);
  await walletClient.writeContract({
    address: TOKENBANK_ADDRESS,
    abi: tokenBankAbi,
    functionName: 'withdraw',
    args: [withdrawAmount, fromWhom, toWhom]
  });
  
  // 确认取款成功
  const balanceAfterWithdraw = await publicClient.readContract({
    address: TOKENBANK_ADDRESS,
    abi: tokenBankAbi,
    functionName: 'balanceOf',
    args: [user.address]
  });
  
  console.log(`取款后，用户 ${user.address} 在银行的余额: ${balanceAfterWithdraw}`);
  
  // 再次查询前3名存款用户
  console.log(`\n取款后查询前3名存款用户...`);
  
  const top3 = await publicClient.readContract({
    address: TOKENBANK_ADDRESS,
    abi: tokenBankAbi,
    functionName: 'getTopDepositors',
    args: [3n]
  }) as Address[];
  
  console.log("前3名存款用户:");
  for (let i = 0; i < top3.length; i++) {
    const address = top3[i];
    const balance = await publicClient.readContract({
      address: TOKENBANK_ADDRESS,
      abi: tokenBankAbi,
      functionName: 'balanceOf',
      args: [address]
    });
    console.log(`#${i+1}: ${address} - 余额: ${balance}`);
  }
}

// 运行测试
async function main() {
  try {
    await testMultipleDeposits();
    await testDepositAndWithdraw();
    
    console.log("\n===== 所有测试完成 =====");
  } catch (error) {
    console.error("测试过程中发生错误:", error);
  }
}

main(); 