'use client';

import React, { useState, useEffect } from 'react';
import { keccak256, stringToHex, numberToHex, concat, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// 设置签名者私钥
const SIGNER_PRIVATE_KEY = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';
const SIGNER_ADDRESS = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

interface SignatureGeneratorProps {
  onSignatureGenerated?: (signature: string) => void;
  defaultBuyerAddress?: `0x${string}`;
  defaultTokenId?: string;
}

export default function SignatureGenerator({ 
  onSignatureGenerated,
  defaultBuyerAddress = '' as `0x${string}`,
  defaultTokenId = '1'
}: SignatureGeneratorProps) {
  const [buyerAddress, setBuyerAddress] = useState<string>(defaultBuyerAddress || '');
  const [tokenId, setTokenId] = useState<string>(defaultTokenId);
  const [signature, setSignature] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);

  // 当默认值改变时更新表单
  useEffect(() => {
    if (defaultBuyerAddress) {
      setBuyerAddress(defaultBuyerAddress);
    }
    if (defaultTokenId) {
      setTokenId(defaultTokenId);
    }
  }, [defaultBuyerAddress, defaultTokenId]);

  const generateSignature = async () => {
    setIsGenerating(true);
    setError('');
    setSignature('');
    
    try {
      // 验证输入
      if (!buyerAddress.startsWith('0x') || buyerAddress.length !== 42) {
        throw new Error('请输入有效的买家地址');
      }
      
      if (isNaN(Number(tokenId)) || Number(tokenId) <= 0) {
        throw new Error('请输入有效的代币ID');
      }
      
      // 将tokenId转换为32字节的hex字符串
      const encodedTokenId = numberToHex(BigInt(tokenId), { size: 32 });
      
      // 按照合约逻辑拼接消息 (abi.encodePacked(buyer, tokenId))
      const packedMessage = concat([buyerAddress as `0x${string}`, encodedTokenId]);
      
      // 计算消息哈希
      const messageHash = keccak256(packedMessage);
      
      // 使用私钥签名消息
      const account = privateKeyToAccount(SIGNER_PRIVATE_KEY as `0x${string}`);
      const sig = await account.signMessage({ message: { raw: toBytes(messageHash) } });
      
      setSignature(sig);
      
      // 如果提供了回调函数，则调用它
      if (onSignatureGenerated) {
        onSignatureGenerated(sig);
      }
    } catch (err) {
      setError((err as Error).message || '生成签名时出错');
      console.error('签名生成错误:', err);
    } finally {
      setIsGenerating(false);
    }
  };
  
  const copyToClipboard = () => {
    if (signature) {
      navigator.clipboard.writeText(signature);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 mt-4 border border-yellow-600">
      <h2 className="text-xl font-bold text-white mb-4">白名单签名生成器</h2>
      <p className="text-yellow-400 text-sm mb-4">使用签名者私钥生成白名单购买签名</p>
      
      <div className="space-y-4">
        <div>
          <label className="block text-gray-300 mb-1">买家地址</label>
          <input
            type="text"
            value={buyerAddress}
            onChange={(e) => setBuyerAddress(e.target.value)}
            placeholder="0x..."
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
          />
        </div>
        
        <div>
          <label className="block text-gray-300 mb-1">NFT代币ID</label>
          <input
            type="number"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            min="1"
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
          />
        </div>
        
        <button
          onClick={generateSignature}
          disabled={isGenerating}
          className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          {isGenerating ? '生成中...' : '生成签名'}
        </button>
        
        {error && (
          <div className="bg-red-900 text-red-200 p-3 rounded">
            {error}
          </div>
        )}
        
        {signature && (
          <div className="mt-4">
            <label className="block text-gray-300 mb-1">生成的签名</label>
            <div className="relative">
              <textarea
                readOnly
                value={signature}
                className="w-full h-24 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-green-400 font-mono text-xs"
              />
              <button
                onClick={copyToClipboard}
                className="absolute top-2 right-2 bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded text-xs"
              >
                {isCopied ? '已复制!' : '复制'}
              </button>
            </div>
            <p className="text-gray-400 text-xs mt-2">
              复制此签名并在白名单购买页面中使用它
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 