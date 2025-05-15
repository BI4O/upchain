/** @type {import('next').NextConfig} */
const nextConfig = {
  // 禁用 React 严格模式，避免开发时重复渲染
  reactStrictMode: false,
  // 类型检查配置
  typescript: {
    // 在生产构建中忽略 TS 错误，但在开发中仍然显示它们
    ignoreBuildErrors: process.env.NODE_ENV === 'production',
  },
  // ESLint 配置
  eslint: {
    // 在生产构建中忽略 ESLint 错误
    ignoreDuringBuilds: process.env.NODE_ENV === 'production',
  },
};

module.exports = nextConfig; 