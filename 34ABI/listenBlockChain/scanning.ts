import {createPublicClient, http, parseAbi} from "viem";
import {foundry} from "viem/chains";

const tokenAddr = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
const transferEvent = parseAbi([
    "event Transfer(address indexed from, address indexed to, uint256 value)",
])

// handler
const client = createPublicClient({
    chain: foundry,
    transport: http("http://localhost:8545")
});

// 监听log
const logs = await client.getLogs({
    address: tokenAddr,
    events: transferEvent,
    fromBlock: 0n,
    toBlock: 9999999n
})

for (const log of logs) {
    console.log(log)
}