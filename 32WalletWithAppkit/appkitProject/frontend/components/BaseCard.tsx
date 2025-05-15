import { ReactNode } from 'react';

interface BaseCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  isLoading?: boolean;
  headerAction?: ReactNode;
  noPadding?: boolean;
  maxHeight?: string;
}

export default function BaseCard({ 
  title, 
  children, 
  className = '',
  isLoading = false,
  headerAction,
  noPadding = false,
  maxHeight = 'calc(100%-2rem)'
}: BaseCardProps) {
  return (
    <div className={`
      bg-gray-900/50 backdrop-blur-sm 
      rounded-xl border border-white/10 
      transition-all duration-200 hover:border-white/20
      ${noPadding ? '' : 'p-6'} 
      h-full 
      ${className}
    `}>
      <div className="flex justify-between items-center mb-4 px-6">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {headerAction && <div>{headerAction}</div>}
      </div>
      
      <div className={`h-[${maxHeight}] overflow-auto custom-scrollbar relative ${noPadding ? '' : 'px-6'}`}>
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/30 backdrop-blur-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        ) : children}
      </div>
    </div>
  );
} 