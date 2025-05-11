import { 
    createPublicClient, 
    createWalletClient, 
    publicActions,
    formatEther,
    http, 
    parseEther} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'

/*
给 Token Bank 添加前端界面：
显示当前 Token 的余额，并且可以存款(点击按钮存款)到 TokenBank
存款后显示用户存款金额，同时支持用户取款(点击按钮取款)。
*/

export async function GET() {
    // 一、环境对象
    // const _client = createPublicClient({
    //     chain: foundry,
    //     transport: http('http://127.0.0.1:8545'), // anvil 默认地址
    // })
    // // 区块高度
    // const blockNum = await _client.getBlockNumber();


    // 二、钱包对象+环境对象
    const account = privateKeyToAccount(`0x${process.env.LC_PRIVATE_KEY}`)
    const client = createWalletClient({
        chain: foundry,
        transport: http('http://127.0.0.1:8545'), // anvil 默认地址
    }).extend(publicActions);
    const blockNum = await client.getBlockNumber()

    // 钱包地址
    const allAddrs = await client.getAddresses();
    const w1 = allAddrs[0];
    const w2 = allAddrs[1];
    const b1 = await client.getBalance({address: w1});
    const b2 = await client.getBalance({address: w2});
    console.log('acc1 balance: ', formatEther(b1));
    console.log('acc2 balance: ', formatEther(b2));
    // 转账 b1 -> b2 转
    const hash = await client.sendTransaction({
        account,
        to: w2,
        value: parseEther("200")
    })
    const receipt = await client.waitForTransactionReceipt({ hash })
    // 再看看
    console.log('acc1 balance: ', formatEther(b1));
    console.log('acc2 balance: ', formatEther(b2));
    


    return Response.json({ 
        block_number: `${blockNum}`,
        account: account,
    })
}