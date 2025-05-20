import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as fs from 'fs';

// 合约地址信息
const MYTOKEN_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const TOKENBANK_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

// 部署者账户 - 用于铸造代币
const DEPLOYER = {
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const,
  privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const
};

// 测试账户 - 10个账户
const TEST_ACCOUNTS = [
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
  },
  {
    address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc' as const,
    privateKey: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba' as const
  },
  {
    address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9' as const,
    privateKey: '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e' as const
  },
  {
    address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955' as const,
    privateKey: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356' as const
  },
  {
    address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f' as const,
    privateKey: '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97' as const
  },
  {
    address: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720' as const,
    privateKey: '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6' as const
  }
];

// 读取合约ABI
const myTokenAbi = JSON.parse(fs.readFileSync('./MyToken.json', 'utf8'));

// 创建客户端
const publicClient = createPublicClient({
  chain: foundry,
  transport: http()
});

// 初始化代币数量 - 每个用户10000个代币
const MINT_AMOUNT = parseEther('10000');

// 铸造代币给所有测试账户
async function mintTokens() {
  console.log("===== 开始给所有用户铸造代币 =====");
  
  // 创建部署者钱包客户端（有mint权限）
  const deployerAccount = privateKeyToAccount(DEPLOYER.privateKey);
  const deployerWallet = createWalletClient({
    account: deployerAccount,
    chain: foundry,
    transport: http()
  });
  
  // 为每个账户铸造代币
  for (const account of TEST_ACCOUNTS) {
    try {
      console.log(`\n铸造代币给账户 ${account.address}...`);
      
      // 检查当前余额
      const currentBalance = await publicClient.readContract({
        address: MYTOKEN_ADDRESS,
        abi: myTokenAbi,
        functionName: 'balanceOf',
        args: [account.address]
      });
      
      console.log(`账户 ${account.address} 当前余额: ${currentBalance}`);
      
      // 如果余额已足够，就跳过
      if (currentBalance >= MINT_AMOUNT) {
        console.log(`账户 ${account.address} 余额已足够，跳过铸造`);
        continue;
      }
      
      // 铸造代币
      const mintTx = await deployerWallet.writeContract({
        address: MYTOKEN_ADDRESS,
        abi: myTokenAbi,
        functionName: 'mint',
        args: [account.address, MINT_AMOUNT]
      });
      
      console.log(`铸造交易成功: ${mintTx}`);
      
      // 确认新余额
      const newBalance = await publicClient.readContract({
        address: MYTOKEN_ADDRESS,
        abi: myTokenAbi,
        functionName: 'balanceOf',
        args: [account.address]
      });
      
      console.log(`铸造后账户 ${account.address} 的余额: ${newBalance}`);
    } catch (error) {
      console.error(`铸造代币给账户 ${account.address} 时发生错误:`, error);
    }
  }
  
  console.log("\n===== 所有账户铸造代币完成 =====");
}

// 所有账户授权银行合约使用代币
async function approveTokenBank() {
  console.log("\n===== 开始授权银行合约使用代币 =====");
  
  for (const account of TEST_ACCOUNTS) {
    try {
      console.log(`\n账户 ${account.address} 授权银行合约...`);
      
      // 创建用户钱包客户端
      const userAccount = privateKeyToAccount(account.privateKey);
      const userWallet = createWalletClient({
        account: userAccount,
        chain: foundry,
        transport: http()
      });
      
      // 检查当前授权额度
      const currentAllowance = await publicClient.readContract({
        address: MYTOKEN_ADDRESS,
        abi: myTokenAbi,
        functionName: 'allowance',
        args: [account.address, TOKENBANK_ADDRESS]
      });
      
      console.log(`账户 ${account.address} 当前授权额度: ${currentAllowance}`);
      
      // 如果授权额度已足够，就跳过
      if (currentAllowance >= MINT_AMOUNT) {
        console.log(`账户 ${account.address} 授权额度已足够，跳过授权`);
        continue;
      }
      
      // 授权最大值
      const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      const approveTx = await userWallet.writeContract({
        address: MYTOKEN_ADDRESS,
        abi: myTokenAbi,
        functionName: 'approve',
        args: [TOKENBANK_ADDRESS, MAX_UINT256]
      });
      
      console.log(`授权交易成功: ${approveTx}`);
      
      // 确认新授权额度
      const newAllowance = await publicClient.readContract({
        address: MYTOKEN_ADDRESS,
        abi: myTokenAbi,
        functionName: 'allowance',
        args: [account.address, TOKENBANK_ADDRESS]
      });
      
      console.log(`授权后账户 ${account.address} 的授权额度: ${newAllowance}`);
    } catch (error) {
      console.error(`授权银行合约使用账户 ${account.address} 的代币时发生错误:`, error);
    }
  }
  
  console.log("\n===== 所有账户授权完成 =====");
}

// 运行初始化
async function main() {
  try {
    await mintTokens();
    await approveTokenBank();
    console.log("\n===== 初始化完成，现在可以运行测试脚本 =====");
  } catch (error) {
    console.error("初始化过程中发生错误:", error);
  }
}

main(); 