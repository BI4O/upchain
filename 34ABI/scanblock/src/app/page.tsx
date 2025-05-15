import { getAllEvents } from '@/lib/db';
import { ConnectWallet } from '@/components/ConnectWallet';
import { EventList } from '@/components/EventList';
import { initializeScanner } from '@/lib/scanner';

// 记录扫描器是否已初始化
let isInitialized = false;

export default async function Home() {
  // 在服务器端初始化扫描器（只执行一次）
  if (!isInitialized) {
    try {
      console.log('正在初始化扫描器...');
      await initializeScanner();
      isInitialized = true;
      console.log('扫描器已成功初始化');
    } catch (error) {
      console.error('初始化扫描器失败:', error);
    }
  }

  // 获取初始事件数据
  const events = await getAllEvents();
  
  // 将 BigInt 转换为字符串，以便在客户端组件中使用
  const initialEvents = events.map(event => ({
    ...event,
    blockNumber: event.blockNumber,
  }));

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">区块链事件查询</h1>
          <ConnectWallet />
        </header>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">转账事件记录</h2>
          <EventList initialEvents={initialEvents} />
        </div>
      </div>
    </main>
  );
}
