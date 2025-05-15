#!/usr/bin/env bash
# 启用严格模式，脚本出错就退出
set -euo pipefail

# 1. 启动 Anvil（后端就绪后继续）
anvil --chain-id 31337 > /dev/null 2>&1 &
ANVIL_PID=$!
# 等 1 秒让 Anvil 起起来
sleep 1

echo "⛓️  Anvil started (PID $ANVIL_PID), deploying contracts…"

# 2. 用 Forge 脚本自动部署
forge script script/Deploy.s.sol \
  --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bac0ca... \
  --rpc-url http://127.0.0.1:8545

# 3. 脚本结束时，保留 Anvil 运行（或根据需要 kill）
echo "✅  Deployment done. Anvil still running on localhost:8545"
echo "   To stop Anvil: kill $ANVIL_PID"
