'use client';

import { createContext, useContext, useState, ReactNode, useEffect, useRef, useCallback } from 'react';

// 模态框信息类型
type ModalInfo = {
  id: string;
  message: string;
  source: string; // 来源组件标识
  timestamp: number;
};

// UI上下文类型定义
type UIContextType = {
  showSuccessModal: boolean;
  successMessage: string;
  modalSource: string;
  modalId: string; // 添加modalId到上下文
  showModal: (message: string, source?: string, duration?: number) => void;
  hideModal: (modalIdToClose?: string) => void;
};

// 创建上下文
const UIContext = createContext<UIContextType | undefined>(undefined);

// 生成唯一ID
const generateId = () => `modal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// 上下文提供者
export function UIProvider({ children }: { children: ReactNode }) {
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [modalSource, setModalSource] = useState('');
  const [currentModalId, setCurrentModalId] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 清除定时器的功能
  const clearModalTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 显示模态框，可选参数source指定来源组件，duration指定自动关闭的时间（毫秒）
  const showModal = useCallback((message: string, source = 'unknown', duration = 5000) => {
    // 生成新的模态框ID
    const modalId = generateId();
    
    // 清除之前的定时器
    clearModalTimer();
    
    // 设置模态框信息
    setSuccessMessage(message);
    setModalSource(source);
    setCurrentModalId(modalId);
    setShowSuccessModal(true);
    
    // 输出调试信息
    console.log(`[UIContext] 显示模态框: ${message}, 来源: ${source}, ID: ${modalId}`);
    
    // 设置自动关闭定时器
    if (duration > 0) {
      timerRef.current = setTimeout(() => {
        console.log(`[UIContext] 自动关闭模态框: ID: ${modalId}`);
        hideModal(modalId);
      }, duration);
    }
  }, [clearModalTimer]);

  // 隐藏模态框，可选参数modalId用于确保只关闭特定ID的模态框
  const hideModal = useCallback((modalIdToClose?: string) => {
    // 如果提供了modalId且不匹配当前的模态框，则不执行关闭操作
    if (modalIdToClose && modalIdToClose !== currentModalId) {
      console.log(`[UIContext] 忽略关闭请求，ID不匹配: 当前=${currentModalId}, 要关闭=${modalIdToClose}`);
      return;
    }
    
    console.log(`[UIContext] 关闭模态框: ID=${currentModalId}`);
    setShowSuccessModal(false);
    
    // 使用setTimeout确保UI更新后再清除其他状态
    setTimeout(() => {
      setCurrentModalId('');
      setSuccessMessage('');
      setModalSource('');
    }, 100);
    
    // 清除定时器
    clearModalTimer();
  }, [currentModalId, clearModalTimer]);

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      clearModalTimer();
    };
  }, [clearModalTimer]);

  // 上下文值
  const value: UIContextType = {
    showSuccessModal,
    successMessage,
    modalSource,
    modalId: currentModalId,
    showModal,
    hideModal
  };

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
}

// 自定义Hook，用于访问上下文
export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI必须在UIProvider内部使用');
  }
  return context;
} 