# Dune 数据可视化

## 获取链上数据的方式

- ##### 自建

  - 前端：viem等获取合约接口
  - 后段：geth/viem

- ##### 数据平台

  - the graph（event为主）
    - graphGL自定义查询
    - subgraph实时跟踪事件
  - Dune（状态变量+可视化为主）
    - sql
    - 可视化
  - 其他中心化的数据供应商
    - okx os
    - bitquery
    - etherscan API

## Dune

- 提供丰富数据集，几分钟刷新一次（不同的链不同）
- Dune AI，将自然语言转化为SQL
- 可视化图表
- SIM API，建好的数据可以通过API访问

## 数据类型

- Curated data（精选数据，**curated**：仔细挑选并展览的）
  - token.transfer
  - token.balances
  - dex.trades
  - nft.trades
- Blockchain data（区块链数据，每个区块的表头不一样）
  - ethereum.transactions
  - erc20_ethereum.evt_Transfer
- Community Data（社区数据）
  - 一般是mev之类的数据，比较少用

## 数据查询

#### 示例一：curated data

> curated data相当于大杂烩，所有的区块链的数据都统一表头放在一起，比如transfer就都放在一起

查六月以来的4条大于1wU的交易

```sql
SELECT
  blockchain,
  block_time,
  symbol,
  price_usd,
  amount,
  amount_usd
FROM tokens.transfers
WHERE
  price_usd > 20 
  AND amount_usd > 1e5 
  AND symbol <> 'ETH' 
  AND block_date > DATE '2025-06-01'
LIMIT 20
```

##### 结果

| blockchain | block_time       | symbol | price_usd | amount             | amount_usd        |
| ---------- | ---------------- | ------ | --------- | ------------------ | ----------------- |
| arbitrum   | 2025-06-03 01:16 | WETH   | 2623.16   | 190.5541345421896  | 499853.98356569   |
| arbitrum   | 2025-06-03 18:35 | WBTC   | 105841.5  | 1                  | 105841.5          |
| arbitrum   | 2025-06-03 02:47 | WETH   | 2631.25   | 60.302999789999994 | 158672.2681974375 |
| arbitrum   | 2025-06-04 16:47 | WETH   | 2658.23   | 287.9996800022     | 765569.3893722482 |

#### 示例二：blockchain data

> blockchain data - raw每个不同的链都有自己的表，表头不一定都一样

过去一天在以太坊链上的USDC交易量

```sql
select
    sum(tr.value / 1e6) as USDC_transder_volume
from erc20_ethereum.evt_Transfer as tr
where contract_address = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
   and tr.evt_block_time > CURRENT_TIMESTAMP - Interval '1' day
```

结果

| USDC_transder_volume |
| -------------------- |
| 17065719269.203196   |

#### 示例三：blockchain data 用with中间表

查询过去一周的以太坊交易量

```sql
WITH eth_transactions AS (
    SELECT DATE_TRUNC('day', block_time) AS day, value / 1e18 AS eth_volume, price 
    FROM ethereum.transactions t
    join prices.usd_daily d ON t.block_date = d.day
    WHERE 
    block_time > CURRENT_TIMESTAMP - INTERVAL '7' day
    AND d.symbol = 'ETH'
    AND d.contract_address IS NULL
    and value > 0
)

SELECT 
    day,
    SUM(eth_volume * price) AS usd_volume
FROM 
    eth_transactions
group by 1 order by 1 
```

##### 结果

| day              | usd_volume         |
| ---------------- | ------------------ |
| 2025-05-29 00:00 | 3629246960.642419  |
| 2025-05-30 00:00 | 5805812864.444974  |
| 2025-05-31 00:00 | 2383437826.663451  |
| 2025-06-01 00:00 | 2137750624.3082018 |
| 2025-06-02 00:00 | 5538103812.956213  |
| 2025-06-03 00:00 | 7263246566.8417635 |
| 2025-06-04 00:00 | 6287757953.832935  |

## 优化查询

- 注意用limit或者用严格的where
- 仅仅select需要的列
- 尽量避免使用orderby
- where使用非随机且可以排序的列，比如date
  - 用区块号而不是交易hash
  - 尽量不要在where中使用函数，除非只是字符串处理
- 用较小的表来join较大的表，而不是反过来

## 仪表盘

首先要做仪表盘需求，一般都要先查询，因为你不可能直接用现成的公共表来做

作业：一个Azuki NFT的基础看板：https://dune.com/bi4o/azuki-nft

