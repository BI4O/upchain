import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address, BigInt } from "@graphprotocol/graph-ts"
import { NftListed } from "../generated/schema"
import { NftListed as NftListedEvent } from "../generated/NFTMarket/NFTMarket"
import { handleNftListed } from "../src/nft-market"
import { createNftListedEvent } from "./nft-market-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#tests-structure

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let seller = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let _NftId = BigInt.fromI32(234)
    let price = BigInt.fromI32(234)
    let newNftListedEvent = createNftListedEvent(seller, _NftId, price)
    handleNftListed(newNftListedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

  test("NftListed created and stored", () => {
    assert.entityCount("NftListed", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "NftListed",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "seller",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "NftListed",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "_NftId",
      "234"
    )
    assert.fieldEquals(
      "NftListed",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "price",
      "234"
    )

    // More assert options:
    // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#asserts
  })
})
