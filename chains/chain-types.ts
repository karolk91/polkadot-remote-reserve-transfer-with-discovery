import { PolkadotClient, TypedApi, UnsafeApi } from 'polkadot-api'
import { westend_relay, westend_asset_hub } from '@polkadot-api/descriptors'

export type RoutingData = {
  isRelay: boolean
  parachainId?: number
}

export type RelayDefinition = {
  name: string
  client: PolkadotClient
  api: TypedApi<typeof westend_relay>
  unsafeApi: UnsafeApi<typeof westend_relay>
  isRelay: true
} & RoutingData

export type ParachainDefinition = {
  name: string
  client: PolkadotClient
  api: TypedApi<typeof westend_asset_hub>
  unsafeApi: UnsafeApi<typeof westend_asset_hub>
  isRelay: false
  parachainId: number
} & RoutingData

export type ChainDefinition = RelayDefinition | ParachainDefinition
