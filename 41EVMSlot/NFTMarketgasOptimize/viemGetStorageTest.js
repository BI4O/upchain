import { createPublicClient, http, parseAbi, encodePacked, toHex, keccak256, hexToBigInt } from 'viem';
import { mainnet } from 'viem/chains';

// 本地anvil链配置
const client = createPublicClient({
  chain: mainnet,
  transport: http('http://127.0.0.1:8545'),
});

const contractAddress = '0x610178dA211FEF7D417bC0e6FeD39F05609AD788';

// LockInfo结构体布局
// address user (20字节) + uint64 startTime (8字节) + uint256 amount (32字节) = 60字节
// 但Solidity会将每个struct元素分别占用一个slot（动态数组），每个slot 32字节
// _locks数组的slot为第一个声明的私有变量，slot=0

// 计算数组长度slot
async function getArrayLength() {
  const lenHex = await client.getStorageAt({
    address: contractAddress,
    slot: toHex(0),
  });
  return BigInt(lenHex);
}

// 计算每个元素的起始slot
function getElementSlot(baseSlot, index) {
  // 动态数组元素slot = keccak256(baseSlot) + index
  const slotBytes = toHex(baseSlot, { size: 32 });
  const base = hexToBigInt(keccak256(slotBytes));
  return base + BigInt(index) * 3n; // 每个LockInfo占3个slot
}

// 读取单个LockInfo
async function getLockInfo(slot) {
  // user: slot, startTime: slot+1, amount: slot+2
  const [userHex, startTimeHex, amountHex] = await Promise.all([
    client.getStorageAt({ address: contractAddress, slot: toHex(slot) }),
    client.getStorageAt({ address: contractAddress, slot: toHex(slot + 1n) }),
    client.getStorageAt({ address: contractAddress, slot: toHex(slot + 2n) }),
  ]);
  return {
    user: '0x' + userHex.slice(-40),
    startTime: BigInt(startTimeHex),
    amount: BigInt(amountHex),
  };
}

(async () => {
  const baseSlot = 0n;
  const len = await getArrayLength();
  const slotBytes = toHex(baseSlot, { size: 32 });
  const baseElemSlot = hexToBigInt(keccak256(slotBytes));
  
  for (let i = 0n; i < len; i++) {
    const slot = baseElemSlot + i * 3n;
    const info = await getLockInfo(slot);
    console.log(`locks[${i}]: user:${info.user}, startTime:${info.startTime}, amount:${info.amount}`);
  }
})(); 