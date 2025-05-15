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

// watch
console.log("开始监听MyToke交易事件...");
client.watchEvent({
    address: tokenAddr,
    event: transferEvent[0],
    onLogs: (logs) => {
        for (const log of logs) {
            const from = log.args.from;
            const to = log.args.to;
            const value = log.args.value;
            console.log(`交易金额：${value}\nfrom:${from}\nto:${to}`);
        }
    }
})

/*
开始监听MyToke交易事件...
交易金额：998
from:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
to:0x70997970C51812dc3A010C7d01b50e0d17dc79C8
*/


