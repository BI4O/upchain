'use client';

import { useState } from 'react';
import { usePublicClient } from 'wagmi';
import BaseCard from '../BaseCard';

interface ContractDebugProps {
  contractAddress: `0x${string}`;
  contractAbi: any[];
}

interface FunctionInfo {
  name: string;
  type: string;
  inputs: number;
  signature: string;
}

export default function ContractDebug({ contractAddress, contractAbi }: ContractDebugProps) {
  const publicClient = usePublicClient();
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // 获取合约中的函数名称
  const functionNames: FunctionInfo[] = contractAbi
    .filter(item => item.type === 'function')
    .map(item => {
      const inputTypes = item.inputs?.map((input: any) => input.type).join(',') || '';
      const signature = `${item.name}(${inputTypes})`;
      
      return {
        name: item.name,
        type: item.stateMutability || 'unknown',
        inputs: item.inputs?.length || 0,
        signature
      };
    });

  // 尝试调用指定函数
  const callFunction = async (functionName: string) => {
    setLoading(true);
    try {
      const result = await publicClient?.readContract({
        address: contractAddress,
        abi: contractAbi,
        functionName,
        args: [],
      });
      
      setLogs(prev => [...prev, `调用函数 "${functionName}" 成功: ${JSON.stringify(result)}`]);
    } catch (error) {
      setLogs(prev => [...prev, `调用函数 "${functionName}" 失败: ${(error as Error).message}`]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseCard title="合约调试">
      <div className="space-y-4">
        <div className="text-white mb-2">合约地址: {contractAddress}</div>
        
        <div className="space-y-2">
          <div className="text-sm text-gray-400">可用函数:</div>
          <div className="grid grid-cols-2 gap-2">
            {functionNames.map(fn => (
              <button
                key={fn.signature}
                onClick={() => callFunction(fn.name)}
                disabled={loading || fn.inputs > 0 || fn.type !== 'view'}
                className={`
                  text-left px-3 py-2 rounded-lg text-sm 
                  ${fn.type === 'view' && fn.inputs === 0 
                    ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' 
                    : 'bg-gray-500/10 text-gray-400'
                  }
                  transition-colors
                `}
              >
                {fn.name} ({fn.type})
                {fn.inputs > 0 && ' [需要参数]'}
              </button>
            ))}
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="text-sm text-gray-400">调试日志:</div>
          <div className="bg-black/30 rounded-lg p-4 max-h-80 overflow-auto text-sm">
            {logs.length > 0 ? (
              logs.map((log, index) => (
                <div key={index} className="mb-2 text-gray-300">{log}</div>
              ))
            ) : (
              <div className="text-gray-500">暂无日志</div>
            )}
          </div>
        </div>
      </div>
    </BaseCard>
  );
} 