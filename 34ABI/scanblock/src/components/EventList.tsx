'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { TransferEvent } from '@/lib/db';
import { formatAddress, formatEther, formatTimestamp } from '@/lib/format';

interface EventListProps {
  initialEvents: TransferEvent[];
}

// API 返回的事件类型
interface APIEvent {
  blockNumber: string;
  from: string;
  to: string;
  value: string;
  transactionHash: string;
  logIndex: number;
  createdAt: string;
}

export function EventList({ initialEvents }: EventListProps) {
  const [events, setEvents] = useState<TransferEvent[]>(initialEvents);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { address, isConnected } = useAccount();

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 根据是否登录获取不同的事件列表
        let url = '/api/events';
        if (isConnected && address) {
          url = `/api/account/${address}`;
        }
        
        console.log(`请求数据: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.error || `HTTP 错误 ${response.status}`);
        }
        
        const data: APIEvent[] = await response.json();
        console.log(`获取到 ${data.length} 条事件数据`);
        
        // 转换数据格式
        const formattedData: TransferEvent[] = data.map(event => ({
          ...event,
          blockNumber: BigInt(event.blockNumber),
        }));
        
        setEvents(formattedData);
      } catch (error) {
        console.error('获取事件列表失败:', error);
        setError(error instanceof Error ? error.message : '获取事件数据失败');
      } finally {
        setLoading(false);
      }
    };

    // 立即获取一次
    fetchEvents();
    
    // 设置定时获取
    const interval = setInterval(fetchEvents, 1000);
    
    return () => clearInterval(interval);
  }, [address, isConnected]);

  if (loading && events.length === 0) {
    return <div className="text-center py-10">加载中...</div>;
  }

  if (error && events.length === 0) {
    return <div className="text-center py-10 text-red-500">错误: {error}</div>;
  }

  if (events.length === 0) {
    return <div className="text-center py-10">暂无事件数据</div>;
  }

  return (
    <div className="overflow-x-auto">
      {error && <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">{error}</div>}
      <table className="min-w-full bg-white">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">区块号</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">发送地址</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">接收地址</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">数量</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">交易哈希</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {events.map((event) => (
            <tr key={`${event.transactionHash}-${event.logIndex}`}>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{event.blockNumber.toString()}</td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {formatAddress(event.from)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {formatAddress(event.to)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{formatEther(event.value)}</td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {formatAddress(event.transactionHash)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {formatTimestamp(event.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 