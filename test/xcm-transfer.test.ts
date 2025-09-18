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
import { ChainDefinition } from '@chains/chain-types.js'
import { logger } from '@logging/logger.js'

const CASES = [
  ['Penpal (TQ=y, DR=y, SA=y)', 'test/wasms/penpal_dry_run+trusted_query.wasm'],
  ['Penpal (TQ=y, DR=n, SA=y)', 'test/wasms/penpal_trusted_query.wasm'],
  ['Penpal (TQ=n, DR=n, SA=y)', 'test/wasms/penpal.wasm'],
] as const

test.each(CASES)('%s', { timeout: 6000 * 1000 }, async (_, wasmPath) => {
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
    penpal: { 'wasm-override': wasmPath },
  })

  const amountToTransfer = WND(10)
  const assetToTransfer = XcmVersionedAsset.V5({
    id: getNetworkTokenLocationFor(penpalChain),
    fun: XcmV3MultiassetFungibility.Fungible(amountToTransfer),
  })

  // Pre-fund Alice
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

  // Pre-fund Sovereign Account
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

  const extrinsicToSubmitBuilder = (reserve: ChainDefinition) =>
    xcmTransferViaTransferAssetsUsingTypeAndThen({
      source: penpalChain,
      reserve,
      dest: penpalChain,
      assets,
      assetToTransfer,
      beneficiaryAccountId: accountId(bobKeyPair.publicKey),
    })

  const reserves = await filterPossibleReserves(
    possibleReserves,
    penpalChain,
    penpalChain,
    assetToTransfer,
    amountToTransfer,
    extrinsicToSubmitBuilder,
    aliceSS58
  )
  logger.info({ reserves: reserves.map((x) => x.name) }, 'Found possible reserves')
  expect(reserves.length).toBeGreaterThan(0)
  assert(reserves[0])

  const bobBalanceBefore = await getAssetBalanceOnChain(penpalChain, assetToTransfer, bobSS58)

  const result = await extrinsicToSubmitBuilder(reserves[0]).signAndSubmit(aliceSigner)
  expect(result.ok).toBe(true)

  await advanceNetwork()

  const bobBalanceAfter = await getAssetBalanceOnChain(penpalChain, assetToTransfer, bobSS58)

  expect(bobBalanceBefore).toBeLessThan(bobBalanceAfter)
})
