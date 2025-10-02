// test/utils/setupTestNetwork.ts
import { setupNetworks } from '@acala-network/chopsticks-testing'
import { createChainDefinition } from '@chains/chain-definitions.js'
import { ParachainDefinition, RelayDefinition } from '@chains/chain-types.js'
import { sr25519CreateDerive } from '@polkadot-labs/hdkd'
import { DEV_MINI_SECRET, ss58Address } from '@polkadot-labs/hdkd-helpers'
import { getPolkadotSigner } from 'polkadot-api/signer'

import assert from 'assert'

import { westend_asset_hub, westend_relay } from '@polkadot-api/descriptors'

import { defaultLogger } from '@acala-network/chopsticks'
defaultLogger.level = 'error'

export async function setupTestNetwork(overrides?: {
  relay?: Record<string, unknown>
  assetHub?: Record<string, unknown>
  penpal?: Record<string, unknown>
}) {
  const { polkadot, assetHub, penpal } = await setupNetworks({
    polkadot: {
      endpoint: 'wss://westend-rpc.n.dwellir.com',
      'runtime-log-level': 1,
      ...overrides?.relay,
    },
    assetHub: {
      endpoint: 'wss://asset-hub-westend-rpc.n.dwellir.com',
      'runtime-log-level': 1,
      ...overrides?.assetHub,
    },
    penpal: {
      endpoint: 'wss://westend-penpal-rpc.polkadot.io',
      'runtime-log-level': 1,
      ...overrides?.penpal,
    },
  })

  const relay = polkadot

  assert(relay)
  assert(assetHub)
  assert(penpal)

  const advanceNetwork = async () => {
    await relay.dev.newBlock()
    await assetHub.dev.newBlock()
    await penpal.dev.newBlock()
  }

  const relayChain = createChainDefinition(
    'Relay',
    polkadot.ws.endpoint,
    westend_relay
  ) as RelayDefinition

  const assetHubChain = createChainDefinition(
    'AssetHub',
    assetHub.ws.endpoint,
    westend_asset_hub,
    1000
  ) as ParachainDefinition

  const penpalChain = createChainDefinition(
    'Penpal',
    penpal.ws.endpoint,
    westend_asset_hub,
    2042
  ) as ParachainDefinition

  const aliceKeyPair = sr25519CreateDerive(DEV_MINI_SECRET)('//Alice')
  const bobKeyPair = sr25519CreateDerive(DEV_MINI_SECRET)('//Bob')

  const aliceSigner = getPolkadotSigner(aliceKeyPair.publicKey, 'Sr25519', aliceKeyPair.sign)

  const aliceSS58 = ss58Address(aliceKeyPair.publicKey)
  const bobSS58 = ss58Address(bobKeyPair.publicKey)

  return {
    relay,
    assetHub,
    penpal,
    advanceNetwork,
    relayChain,
    assetHubChain,
    penpalChain,
    aliceKeyPair,
    bobKeyPair,
    aliceSigner,
    aliceSS58,
    bobSS58,
  }
}
