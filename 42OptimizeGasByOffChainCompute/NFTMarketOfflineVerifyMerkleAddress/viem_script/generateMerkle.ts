import { keccak256, toHex, encodePacked, getAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { MerkleTree } from 'merkletreejs';
import fs from 'fs';

// 定义类型
type Account = {
  privateKey: `0x${string}`;
  address: `0x${string}`;
  amount: string;
};

type AccountWithProof = Account & {
  proof: `0x${string}`[];
};

// 生成10个随机私钥和地址
function generateAccounts(count: number): Account[] {
  const accounts: Account[] = [];
  for (let i = 0; i < count; i++) {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    accounts.push({
      privateKey,
      address: account.address,
      amount: '100000000000000000000' // 100 ether
    });
  }
  return accounts;
}

// 生成10个随机账户（私钥和地址）
const whitelist = generateAccounts(10);

// 生成Merkle树的叶子节点（按照合约中的规则）
const leaves = whitelist.map(account => {
  return Buffer.from(
    keccak256(
      encodePacked(
        ['address', 'uint256'], 
        [account.address, BigInt(account.amount)]
      )
    ).slice(2),
    'hex'
  );
});

// 构建Merkle树
const tree = new MerkleTree(
  leaves,
  (data: Buffer) => Buffer.from(keccak256(data).slice(2), 'hex'),
  { sortPairs: true }
);

// 获取Merkle根
const merkleRoot = tree.getHexRoot();

// 获取每个账户的Merkle证明
const whitelistWithProofs: AccountWithProof[] = whitelist.map((account, idx) => {
  const leaf = leaves[idx];
  const proof = tree.getHexProof(leaf) as `0x${string}`[];
  return {
    ...account,
    proof,
  };
});

// 生成10个随机的非白名单账户
const nonWhitelist = generateAccounts(10);

// 构建输出数据
const output = {
  merkleRoot,
  whitelist: whitelistWithProofs,
  nonWhitelist
};

// 保存到文件
fs.writeFileSync('./merkle_output.json', JSON.stringify(output, null, 2));

// 生成Solidity代码片段，便于复制到测试合约
let solSnippet = `// 将这些数据复制到你的测试合约\n`;
solSnippet += `// 1. Merkle根\nbytes32 merkleRoot = ${merkleRoot};\n\n`;

// 白名单地址
solSnippet += `// 2. 白名单地址\naddress[] whitelist = [\n`;
whitelist.forEach(account => {
  solSnippet += `    ${account.address},\n`;
});
solSnippet += `];\n\n`;

// 非白名单地址
solSnippet += `// 3. 非白名单地址\naddress[] nonWhitelist = [\n`;
nonWhitelist.forEach(account => {
  solSnippet += `    ${account.address},\n`;
});
solSnippet += `];\n\n`;

// 私钥映射
solSnippet += `// 4. 私钥映射（vm.sign中使用）\n// 在setUp中添加:\n`;
whitelist.forEach((account, idx) => {
  solSnippet += `// whitelist[${idx}] 私钥: ${account.privateKey}\n`;
});
nonWhitelist.forEach((account, idx) => {
  solSnippet += `// nonWhitelist[${idx}] 私钥: ${account.privateKey}\n`;
});

// Merkle证明
solSnippet += `\n// 5. 初始化whitelistProofs\n`;
solSnippet += `// 在setUp函数中添加:\n`;
whitelistWithProofs.forEach((account, idx) => {
  solSnippet += `bytes32[] memory proof${idx} = new bytes32[](${account.proof.length});\n`;
  account.proof.forEach((proofElement, proofIdx) => {
    solSnippet += `proof${idx}[${proofIdx}] = ${proofElement};\n`;
  });
  solSnippet += `whitelistProofs.push(proof${idx});\n\n`;
});

// 保存Solidity代码片段
fs.writeFileSync('./solidity_snippet.txt', solSnippet);

console.log('Merkle root:', merkleRoot);
console.log('数据已保存到 merkle_output.json');
console.log('Solidity代码片段已保存到 solidity_snippet.txt'); 