'use client';

interface AlertModalProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
}

export default function AlertModal({ isOpen, message, onClose }: AlertModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-[10px]"
        onClick={onClose}
      />
      {/* 弹窗内容 */}
      <div className="relative backdrop-blur-md bg-white/10 rounded-xl border border-white/20 p-8 max-w-sm w-full mx-4 shadow-2xl transform transition-all">
        <div className="text-center mb-6">
          <div className="mb-4">
            <div className="mx-auto h-16 w-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
              <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-medium text-white mb-2">操作成功</h3>
          <p className="text-gray-300">{message}</p>
        </div>
        <div className="text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium transition-all transform hover:scale-105 hover:shadow-lg hover:shadow-green-500/25 focus:outline-none"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
} 