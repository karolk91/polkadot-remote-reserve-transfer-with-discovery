import { westend_asset_hub, westend_relay } from '@polkadot-api/descriptors'
import { createClient } from 'polkadot-api'
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat'
import { getWsProvider } from 'polkadot-api/ws-provider/web'

export type ChainDescriptor = typeof westend_relay | typeof westend_asset_hub

export function createChainDefinition<D extends ChainDescriptor>(
  name: string,
  url: string,
  descriptors: D,
  parachainId?: number
) {
  const client = createClient(withPolkadotSdkCompat(getWsProvider(url)))
  if (parachainId == null) {
    return {
      name,
      client,
      api: client.getTypedApi(descriptors),
      unsafeApi: client.getUnsafeApi<D>(),
      isRelay: true as const,
    }
  } else {
    return {
      name,
      client,
      api: client.getTypedApi(descriptors),
      unsafeApi: client.getUnsafeApi<D>(),
      isRelay: false as const,
      parachainId,
    }
  }
}
