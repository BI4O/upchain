# 区块链事件查询网站

这个项目是一个轻量级的区块链事件查询网站，用于监控和展示区块链网络上的 Transfer 事件。

## 功能特点

- 实时扫描区块链网络中的 Transfer 事件
- 使用 JSON 文件作为轻量级数据库
- 每 5 秒自动扫描区块链上的新事件
- 每 1 秒自动刷新展示页面
- 支持钱包连接，连接后只显示与当前地址相关的事件
- 提供账号地址相关事件的 API 接口

## 技术栈

- Next.js 15 App Router
- Tailwind CSS
- Viem - 与区块链交互
- Wagmi - 钱包连接
- 文件系统 JSON 数据库

## 环境变量

项目需要以下环境变量：

```
NEXT_PUBLIC_ANVIL_RPC_URL="http://localhost:8545"
NEXT_PUBLIC_CONTRACT_ADDRESS="0x5FbDB2315678afecb367f032d93F642f64180aa3"
```

## 开发指南

1. 克隆项目并安装依赖：

```bash
git clone <仓库地址>
cd <项目文件夹>
pnpm install
```

2. 创建 `.env.local` 文件并设置环境变量。

3. 启动开发服务器：

```bash
pnpm dev
```

4. 浏览器访问 http://localhost:3000

## API 接口

- `GET /api/events` - 获取所有事件
- `GET /api/account/{address}` - 获取指定地址相关的事件

## 数据存储

事件数据存储在 `src/data/events.json` 文件中，结构如下：

```json
[
  {
    "blockNumber": "123456",
    "from": "0x...",
    "to": "0x...",
    "value": "1000000000000000000",
    "transactionHash": "0x...",
    "logIndex": 0,
    "createdAt": "2023-01-01T00:00:00.000Z"
  }
]
```

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
