import { test, expect } from 'vitest'
import { filterPossibleReserves } from '@xcm/filters.js'
import { xcmTransferViaTransferAssetsUsingTypeAndThen } from '@xcm/send-transfer.js'
import {
  getNetworkTokenLocationFor,
  WND,
  getXcmLocationForRoute,
  getSovereignAccountAddressFor,
  getAssetBalanceOnChain,
} from '@xcm/xcm-utils.js'
import { accountId } from '@polkadot-labs/hdkd-helpers'
import {
  XcmVersionedAsset,
  XcmV3MultiassetFungibility,
  XcmVersionedAssets,
} from '@polkadot-api/descriptors'
import assert from 'assert'
import { setupTestNetwork } from '@test/utils/setupTestNetwork.js'

test('executes xcm transfer via selected reserve', { timeout: 6000 * 1000 }, async () => {
  const {
    penpal,
    assetHub,
    assetHubChain,
    penpalChain,
    relayChain,
    advanceNetwork,
    aliceSS58,
    bobSS58,
    aliceSigner,
    bobKeyPair,
  } = await setupTestNetwork({
    penpal: { "wasm-override": "test/wasms/penpal.wasm" },
  })

  const amountToTransfer = WND(10)
  const assetToTransfer = XcmVersionedAsset.V5({
    id: getNetworkTokenLocationFor(penpalChain),
    fun: XcmV3MultiassetFungibility.Fungible(amountToTransfer),
  })

  // pre-fund Alice account with:
  // 1. Penpal native token (PEN)
  // 2. WND (relay token) which is a ForeginAsset for Penpal
  await penpal.dev.setStorage({
    System: { account: [[[aliceSS58], { providers: 1, data: { free: WND(100_000) } }]] },
    ForeignAssets: {
      Account: [
        [
          [{ parents: 1, interior: { Here: null } }, aliceSS58],
          {
            balance: amountToTransfer.toString() + 1,
            status: 'Liquid',
            reason: 'Consumer',
            extra: null,
          },
        ],
      ],
    },
  })
  // pre-fund Soverign Account of Penpal on Asset-Hub to be able to accept the transfer
  const penpalSovereignAccountOnAssetHub = await getSovereignAccountAddressFor(
    assetHubChain.api,
    getXcmLocationForRoute(assetHubChain, penpalChain)
  )
  await assetHub.dev.setStorage({
    System: {
      account: [
        [[penpalSovereignAccountOnAssetHub], { providers: 1, data: { free: WND(100_000) } }],
      ],
    },
  })

  advanceNetwork()

  const possibleReserves = [assetHubChain, relayChain]

  const assets = XcmVersionedAssets.V5([assetToTransfer.value])

  const reserves = await filterPossibleReserves(
    possibleReserves,
    penpalChain,
    assetToTransfer,
    amountToTransfer
  )
  expect(reserves.length).toBeGreaterThan(0)
  assert(reserves[0])

  const bobBalanceBefore = await getAssetBalanceOnChain(penpalChain, assetToTransfer, bobSS58)

  // sending from Penpal Alice via reserve to Penpal Bob
  // Penpal -> reserve chain -> Penpal while non-practical
  // is legit. Also not much choice since Westend
  // doesn't have any other non-system chain live than Penpal
  await xcmTransferViaTransferAssetsUsingTypeAndThen({
    source: penpalChain,
    reserve: reserves[0],
    dest: penpalChain,
    assets,
    assetToTransfer: assetToTransfer,
    beneficiaryAccountId: accountId(bobKeyPair.publicKey),
    signer: aliceSigner,
  })

  await advanceNetwork()

  const bobBalanceAfter = await getAssetBalanceOnChain(penpalChain, assetToTransfer, bobSS58)

  // we expect Bob's balance for WND to increase by (amountToTransfer - fees)
  // since we don't bother with calculating fees for this example so just check it
  // actually increased
  expect(bobBalanceBefore).toBeLessThan(bobBalanceAfter)
})
