/**
 * 格式化工具函数库
 */

/**
 * 格式化地址显示
 * @param address 地址字符串
 * @returns 格式化后的地址
 */
export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * 格式化金额显示，从 wei 转为 ether
 * @param weiValue wei 单位的金额字符串
 * @param decimals 代币精度，默认为 18
 * @param symbol 代币符号，默认为 MT
 * @returns 格式化后的金额
 */
export function formatEther(weiValue: string | bigint, decimals: number = 18, symbol: string = 'MT'): string {
  try {
    // 转换为 BigInt
    const wei = typeof weiValue === 'string' ? BigInt(weiValue) : weiValue;
    
    // 计算除数
    const divisor = BigInt(10 ** decimals);
    
    // 整数部分
    const integerPart = wei / divisor;
    
    // 小数部分
    const fractionPart = wei % divisor;
    
    // 将小数部分格式化为固定长度的字符串
    const fractionStr = fractionPart.toString().padStart(decimals, '0');
    
    // 构建结果，去除末尾的0
    let result = `${integerPart}`;
    
    // 只有在小数部分非0时才添加小数点和小数部分
    if (fractionPart > 0) {
      // 找到第一个非0字符的位置
      const firstNonZero = fractionStr.search(/[1-9]/);
      
      // 如果小数部分全是0，就不显示小数点
      if (firstNonZero !== -1) {
        // 取至少6位小数，但不超过非0位+2位
        const significantDigits = Math.min(
          Math.max(6, firstNonZero + 3), 
          decimals
        );
        
        result += `.${fractionStr.substring(0, significantDigits)}`;
      }
    }
    
    return `${result} ${symbol}`;
  } catch (e) {
    console.error('格式化金额失败:', e);
    return `${weiValue} wei`;
  }
}

/**
 * 格式化时间戳
 * @param timestamp ISO日期字符串
 * @returns 格式化的日期时间
 */
export function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return timestamp;
  }
} 