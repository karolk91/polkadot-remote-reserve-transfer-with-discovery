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

type ReserveTestCase = {
  name: string
  penpalWasmPath: string
  relayWasmPath: string
  assetHubWasmPath: string
  migrationSupported: boolean
  migrationInProgress: boolean
  sovOnRelayHasFunds: boolean
  sovOnAhHasFunds: boolean
  expectedReserves: string[]
}

const CASES: ReserveTestCase[] = [
  {
    name: 'Penpal (TQ=y, DR=y), Migration In progress, SA on AH has funds, expecting only AH as possible reserve',
    penpalWasmPath: 'test/wasms/penpal_dry_run+trusted_query.wasm',
    relayWasmPath: 'test/wasms/westend_relay+rcMigrator.wasm',
    assetHubWasmPath: 'test/wasms/westend_asset_hub+AhMigrator.wasm',
    migrationSupported: true,
    migrationInProgress: true,
    sovOnRelayHasFunds: true,
    sovOnAhHasFunds: true,
    expectedReserves: ['AssetHub'],
  },
  {
    name: 'Penpal (TQ=y, DR=y), Migration In progress, SA on Relay has funds, Expecting no possible reserves',
    penpalWasmPath: 'test/wasms/penpal_dry_run+trusted_query.wasm',
    relayWasmPath: 'test/wasms/westend_relay+rcMigrator.wasm',
    assetHubWasmPath: 'test/wasms/westend_asset_hub+AhMigrator.wasm',
    migrationSupported: true,
    migrationInProgress: true,
    sovOnRelayHasFunds: true,
    sovOnAhHasFunds: false,
    expectedReserves: [],
  },
  {
    name: 'Penpal (TQ=y, DR=y), Migration Done, SA on AH has funds, expecting only AH as possible reserve',
    penpalWasmPath: 'test/wasms/penpal_dry_run+trusted_query.wasm',
    relayWasmPath: 'test/wasms/westend_relay+rcMigrator.wasm',
    assetHubWasmPath: 'test/wasms/westend_asset_hub+AhMigrator.wasm',
    migrationSupported: true,
    migrationInProgress: false,
    sovOnRelayHasFunds: false,
    sovOnAhHasFunds: true,
    expectedReserves: ['AssetHub'],
  },
  {
    name: 'Penpal (TQ=y, DR=y), No Migration Pallets, SA on AH has funds, expecting only AH as possible reserve',
    penpalWasmPath: 'test/wasms/penpal_dry_run+trusted_query.wasm',
    relayWasmPath: 'test/wasms/westend_relay.wasm',
    assetHubWasmPath: 'test/wasms/westend_asset_hub.wasm',
    migrationSupported: false,
    migrationInProgress: false,
    sovOnRelayHasFunds: false,
    sovOnAhHasFunds: true,
    expectedReserves: ['AssetHub'],
  },
  {
    name: 'Penpal (TQ=y, DR=y), No Migration Pallets, SA on Relay has funds, expecting only Relay as possible reserve',
    penpalWasmPath: 'test/wasms/penpal_dry_run+trusted_query.wasm',
    relayWasmPath: 'test/wasms/westend_relay.wasm',
    assetHubWasmPath: 'test/wasms/westend_asset_hub.wasm',
    migrationSupported: false,
    migrationInProgress: false,
    sovOnRelayHasFunds: true,
    sovOnAhHasFunds: false,
    expectedReserves: ['Relay'],
  },
  {
    name: 'Penpal (TQ=y, DR=y), No Migration Pallets, SA on Relay has funds, SA on AH has funds, expecting only AH as reserve due to succesful dry-run',
    penpalWasmPath: 'test/wasms/penpal_dry_run+trusted_query.wasm',
    relayWasmPath: 'test/wasms/westend_relay.wasm',
    assetHubWasmPath: 'test/wasms/westend_asset_hub.wasm',
    migrationSupported: false,
    migrationInProgress: false,
    sovOnRelayHasFunds: true,
    sovOnAhHasFunds: true,
    expectedReserves: ['AssetHub'],
  },
  {
    name: 'Penpal (TQ=y, DR=n), No Migration Pallets, SA on Relay has funds, SA on AH has funds, expecting both as possible reserve',
    penpalWasmPath: 'test/wasms/penpal_trusted_query.wasm',
    relayWasmPath: 'test/wasms/westend_relay.wasm',
    assetHubWasmPath: 'test/wasms/westend_asset_hub.wasm',
    migrationSupported: false,
    migrationInProgress: false,
    sovOnRelayHasFunds: true,
    sovOnAhHasFunds: true,
    expectedReserves: ['AssetHub', 'Relay'],
  },
  {
    name: 'Penpal (TQ=n, DR=n), No Migration Pallets, SA on Relay has funds, SA on AH has funds, expecting both as possible reserve',
    penpalWasmPath: 'test/wasms/penpal.wasm',
    relayWasmPath: 'test/wasms/westend_relay.wasm',
    assetHubWasmPath: 'test/wasms/westend_asset_hub.wasm',
    migrationSupported: false,
    migrationInProgress: false,
    sovOnRelayHasFunds: true,
    sovOnAhHasFunds: true,
    expectedReserves: ['AssetHub', 'Relay'],
  },
  {
    name: 'Penpal (TQ=n, DR=n), No Migration Pallets, SA on Relay has funds, expecting only Relay as possible reserve',
    penpalWasmPath: 'test/wasms/penpal.wasm',
    relayWasmPath: 'test/wasms/westend_relay.wasm',
    assetHubWasmPath: 'test/wasms/westend_asset_hub.wasm',
    migrationSupported: false,
    migrationInProgress: false,
    sovOnRelayHasFunds: true,
    sovOnAhHasFunds: false,
    expectedReserves: ['Relay'],
  },
  {
    name: 'Penpal (TQ=n, DR=n), No Migration Pallets, SA on AH has funds, expecting only AH as possible reserve',
    penpalWasmPath: 'test/wasms/penpal.wasm',
    relayWasmPath: 'test/wasms/westend_relay.wasm',
    assetHubWasmPath: 'test/wasms/westend_asset_hub.wasm',
    migrationSupported: false,
    migrationInProgress: false,
    sovOnRelayHasFunds: false,
    sovOnAhHasFunds: true,
    expectedReserves: ['AssetHub'],
  },
]

test.concurrent.each(CASES)('$name', { timeout: 300000 * 1000 }, async (tc) => {
  const {
    penpalWasmPath,
    relayWasmPath,
    assetHubWasmPath,
    migrationSupported,
    migrationInProgress,
    sovOnRelayHasFunds,
    sovOnAhHasFunds,
    expectedReserves,
  } = tc

  const {
    relay,
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
    penpal: { 'wasm-override': penpalWasmPath },
    relay: { 'wasm-override': relayWasmPath },
    assetHub: { 'wasm-override': assetHubWasmPath },
  })

  const amountToTransfer = WND(10)
  const assetToTransfer = XcmVersionedAsset.V5({
    id: getNetworkTokenLocationFor(penpalChain),
    fun: XcmV3MultiassetFungibility.Fungible(amountToTransfer),
  })

  // Pre-fund Alice on Penpal
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

  // Set sovereign account balances
  const penpalSovereignOnAssetHub = await getSovereignAccountAddressFor(
    assetHubChain.api,
    getXcmLocationForRoute(assetHubChain, penpalChain)
  )
  await assetHub.dev.setStorage({
    System: {
      account: [
        [
          [penpalSovereignOnAssetHub],
          { providers: 1, data: { free: sovOnAhHasFunds ? WND(100_000) : WND(0) } },
        ],
      ],
    },
  })

  const penpalSovereignOnRelay = await getSovereignAccountAddressFor(
    relayChain.api,
    getXcmLocationForRoute(relayChain, penpalChain)
  )
  await relay.dev.setStorage({
    System: {
      account: [
        [
          [penpalSovereignOnRelay],
          { providers: 1, data: { free: sovOnRelayHasFunds ? WND(100_000) : WND(0) } },
        ],
      ],
    },
  })

  // Set migrator stages if supported
  if (migrationSupported) {
    if (migrationInProgress) {
      await relay.dev.setStorage({
        RcMigrator: { RcMigrationStage: { AccountsMigrationOngoing: { last_key: null } } },
      })
      await assetHub.dev.setStorage({
        AhMigrator: { AhMigrationStage: { DataMigrationOngoing: { last_key: null } } },
      })
    } else {
      await relay.dev.setStorage({
        RcMigrator: { RcMigrationStage: { MigrationDone: null } },
      })
      await assetHub.dev.setStorage({
        AhMigrator: { AhMigrationStage: { MigrationDone: null } },
      })
    }
  }

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
  expect(reserves.map((x) => x.name)).toEqual(expectedReserves)

  if (expectedReserves.length > 0) {
    assert(reserves[0])

    const bobBalanceBefore = await getAssetBalanceOnChain(penpalChain, assetToTransfer, bobSS58)

    const result = await extrinsicToSubmitBuilder(reserves[0]).signAndSubmit(aliceSigner)
    expect(result.ok).toBe(true)

    await advanceNetwork()

    const bobBalanceAfter = await getAssetBalanceOnChain(penpalChain, assetToTransfer, bobSS58)

    expect(bobBalanceBefore).toBeLessThan(bobBalanceAfter)
  }
})
