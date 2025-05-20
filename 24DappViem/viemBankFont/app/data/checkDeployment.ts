import { createPublicClient, webSocket } from 'viem';
import { localhost } from 'viem/chains';

// 配置 viem 客户端
const client = createPublicClient({
  chain: localhost,
  transport: webSocket('ws://127.0.0.1:50494')
});

const txHash = '0x68501b5cf1522c1e17bcd9c1ebee578ec982dd3a746f9e14196d0a022096da94';

async function checkDeployment() {
  try {
    // 获取交易详情
    const tx = await client.getTransaction({ hash: txHash });
    console.log('交易详情:', {
      发送方: tx.from,
      接收方: tx.to,
      区块号: tx.blockNumber,
      交易哈希: tx.hash
    });

    // 获取交易收据
    const receipt = await client.getTransactionReceipt({ hash: txHash });
    console.log('交易收据:', {
      状态: receipt.status === 'success' ? '成功' : '失败',
      合约地址: receipt.contractAddress,
      区块号: receipt.blockNumber,
      使用的gas: receipt.gasUsed.toString()
    });

    // 如果合约已部署，检查合约代码
    if (receipt.contractAddress) {
      const code = await client.getBytecode({ address: receipt.contractAddress });
      console.log('合约代码长度:', code ? code.length : 0);
      console.log('合约地址:', receipt.contractAddress);
    }

  } catch (error) {
    console.error('检查部署时出错:', error);
  }
}

checkDeployment(); 