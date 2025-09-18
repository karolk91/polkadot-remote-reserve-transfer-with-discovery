import {
  XcmVersionedLocation,
  XcmV5Junctions,
  XcmV5Junction,
  XcmVersionedAsset,
  westend_relay,
  westend_asset_hub,
} from '@polkadot-api/descriptors'
import { ChainDefinition, ParachainDefinition, RoutingData } from '@chains/chain-types.js'
import { SS58String, UnsafeApi } from 'polkadot-api'

export const WND = (x: number) => BigInt(x) * BigInt(1e12)

export function getXcmLocationForRoute(from: RoutingData, to: RoutingData): XcmVersionedLocation {
  if (!from.isRelay && !to.isRelay) {
    return XcmVersionedLocation.V5({
      parents: 1,
      interior: XcmV5Junctions.X1(XcmV5Junction.Parachain(to.parachainId!)),
    })
  }

  if (from.isRelay && !to.isRelay) {
    return XcmVersionedLocation.V5({
      parents: 0,
      interior: XcmV5Junctions.X1(XcmV5Junction.Parachain(to.parachainId!)),
    })
  }

  if (!from.isRelay && to.isRelay) {
    return XcmVersionedLocation.V5({
      parents: 1,
      interior: XcmV5Junctions.Here(),
    })
  }

  return XcmVersionedLocation.V5({
    parents: 0,
    interior: XcmV5Junctions.Here(),
  })
}

export function getNetworkTokenLocationFor(chain: RoutingData) {
  return {
    parents: chain.isRelay ? 0 : 1,
    interior: XcmV5Junctions.Here(),
  }
}

export async function getSovereignAccountAddressFor(
  api: UnsafeApi<typeof westend_relay | typeof westend_asset_hub>,
  location: XcmVersionedLocation
): Promise<string> {
  const result = await api.apis.LocationToAccountApi.convert_location(location)
  if (!result.success) throw new Error('Failed to resolve sovereign account address')
  return result.value
}

export async function hasEnoughFundsOnSovereignAccount(
  source: ChainDefinition,
  dest: ChainDefinition,
  amountToSend: bigint
): Promise<boolean> {
  const xcmRoute = getXcmLocationForRoute(dest, source)
  const account = await getSovereignAccountAddressFor(dest.api, xcmRoute)
  const result = await dest.api.query.System.Account.getValue(account)
  const balance = result.data.free
  return balance >= amountToSend
}

export async function getAssetBalanceOnChain(
  chain: ChainDefinition,
  asset: Extract<XcmVersionedAsset, { type: 'V5' }>,
  account: SS58String
): Promise<bigint> {
  const networkToken = getNetworkTokenLocationFor(chain)
  if (chain.isRelay && asset.value.id == networkToken) {
    const result = await chain.api.query.System.Account.getValue(account)
    return result.data.free
  } else {
    const result = await (chain as ParachainDefinition).api.query.ForeignAssets.Account.getValue(
      asset.value.id,
      account
    )
    return result?.balance.valueOf() || 0n
  }
}
