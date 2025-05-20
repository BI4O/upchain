import { cookieStorage, createStorage } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { mainnet, arbitrum, sepolia, foundry} from "@reown/appkit/networks";

/*
App：车
- wagmi：车的引擎和方向盘（底层硬件）
- appkit：自动驾驶系统，一键搞定连接和支付（高级软件）

wagmiAdapter：连接引擎和自动驾驶的“连接器”
- projectId：自动驾驶许可码
- storage：保存自动驾驶数据的地方（cookie）
- network：自动驾驶可以跑的路线
- ssr：自动驾驶运行端（ssr客户端）
*/

// 一、项目id
export const projectId = "09c587df26f35f6bbb77709241fe2e75"
// export const projectId = process.env.PROJECTID;
// assert projectId
if (!projectId) {throw new Error("请提供reown项目id")};

// 二、网络
export const networks = [mainnet,arbitrum,sepolia,foundry];

// 三、转接器
export const wagmiAdapter = new WagmiAdapter({
    projectId,
    networks,
    storage:createStorage({storage: cookieStorage}),
    ssr: true
})

// 导出连接器
export const config = wagmiAdapter.wagmiConfig;

// console.log(config);