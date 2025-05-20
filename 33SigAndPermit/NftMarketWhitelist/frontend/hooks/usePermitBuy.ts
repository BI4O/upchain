import { useCallback } from 'react';
import { Address, keccak256, concat, numberToHex, toBytes } from 'viem';
import { usePublicClient, useSignMessage } from 'wagmi';

// 签名者地址 - 需要与合约中的signer一致
const SIGNER_ADDRESS = '0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38';

export function usePermitBuy() {
  const publicClient = usePublicClient();
  const { signMessageAsync } = useSignMessage();

  // 创建白名单购买签名
  const createSignature = useCallback(async (
    buyer: Address,
    tokenId: bigint
  ): Promise<string> => {
    if (!publicClient) {
      throw new Error('网络连接失败');
    }

    try {
      // 将tokenId转换为32字节的hex字符串
      const encodedTokenId = numberToHex(tokenId, { size: 32 });
      
      // 按照合约逻辑拼接消息 (abi.encodePacked(buyer, tokenId))
      const packedMessage = concat([buyer, encodedTokenId]);
      
      // 计算消息哈希
      const messageHash = keccak256(packedMessage);
      
      // 使用钱包签名消息哈希
      const signature = await signMessageAsync({ 
        message: { raw: toBytes(messageHash) }
      });
      
      return signature;
    } catch (error) {
      console.error('创建签名失败:', error);
      throw new Error('创建签名失败');
    }
  }, [publicClient, signMessageAsync]);

  // 验证某个签名是否已被使用
  const isSignatureUsed = useCallback(async (
    marketAddress: Address,
    signature: `0x${string}`
  ): Promise<boolean> => {
    if (!publicClient) {
      throw new Error('网络连接失败');
    }
    
    try {
      const isUsed = await publicClient.readContract({
        address: marketAddress,
        abi: [
          {
            type: 'function',
            name: 'usedSignatures',
            inputs: [{ name: '', type: 'bytes' }],
            outputs: [{ name: '', type: 'bool' }],
            stateMutability: 'view'
          }
        ],
        functionName: 'usedSignatures',
        args: [signature]
      }) as boolean;

      return isUsed;
    } catch (error) {
      console.error('检查签名状态失败:', error);
      return false;
    }
  }, [publicClient]);

  return {
    createSignature,
    isSignatureUsed,
  };
} 