import { ChainDefinition } from './chain-types.js'
import { createClient } from 'polkadot-api'
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat'
import { getWsProvider } from 'polkadot-api/ws-provider/web'

export const createChainDefinition = (
  name: string,
  url: string,
  parachainId?: number
): ChainDefinition => {
  const client = createClient(withPolkadotSdkCompat(getWsProvider(url)))
  const isRelay = !parachainId
  return isRelay
    ? { name, client, api: client.getUnsafeApi(), isRelay: true }
    : { name, client, api: client.getUnsafeApi(), isRelay: false, parachainId: parachainId! }
}
