# 项目常用命令指南

## 开发环境启动
1. 启动 Anvil 本地链
```bash
anvil
```

2. 启动 Next.js 开发服务器
```bash
pnpm dev
```

## 合约相关命令
1. 编译合约
```bash
pnpm forge build
```

2. 部署合约
```bash
pnpm forge script script/Deploy.s.sol --rpc-url ws://127.0.0.1:50494 --broadcast
```

3. 运行合约测试
```bash
pnpm forge test
```

## 事件监听相关
1. 检查合约部署状态
```bash
pnpm tsx app/data/checkDeployment.ts
```

2. 启动 NFT 市场事件监听
```bash
pnpm tsx app/data/listenNftMarket.ts
```

## 其他常用命令
1. 安装依赖
```bash
pnpm install
```

2. 清理构建文件
```bash
pnpm clean
```

3. 运行类型检查
```bash
pnpm type-check
```

4. 运行代码格式化
```bash
pnpm format
```

## 注意事项
1. 确保在运行任何命令前，Anvil 本地链已经启动
2. 合约部署后，需要更新 app/data/NFTmarket.ts 中的合约地址
3. 如果遇到 WebSocket 连接问题，检查 Anvil 的 WebSocket 端口是否正确

## 常见问题解决
1. 如果遇到 "Cannot find module" 错误，运行：
```bash
pnpm install
```

2. 如果遇到 TypeScript 错误，运行：
```bash
pnpm type-check
```

3. 如果需要重置本地链，重启 Anvil 即可 