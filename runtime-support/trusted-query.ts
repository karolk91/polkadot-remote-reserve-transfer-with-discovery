import { ChainDefinition } from '@chains/chain-types.js'
import { XcmVersionedAsset } from '@polkadot-api/descriptors'
import { getXcmLocationForRoute } from '@xcm/xcm-utils.js'
import {
  checkRuntimeSupportsApiWithVersion,
  WANTED_TRUSTED_QUERY_API,
} from '@runtime/runtime-api-checks.js'
import { logger } from '@logging/logger.js'

export async function passesTrustedQueryCheck(
  source: ChainDefinition,
  reserve: ChainDefinition,
  dest: ChainDefinition,
  assetToTransfer: XcmVersionedAsset
): Promise<boolean> {
  const sourceSupports = await checkRuntimeSupportsApiWithVersion(
    source.client,
    WANTED_TRUSTED_QUERY_API.name,
    WANTED_TRUSTED_QUERY_API.ver
  )
  const destSupports = await checkRuntimeSupportsApiWithVersion(
    dest.client,
    WANTED_TRUSTED_QUERY_API.name,
    WANTED_TRUSTED_QUERY_API.ver
  )

  logger.debug({ source: source.name, sourceSupports }, 'TrustedQuery support')

  if (!sourceSupports) return true

  const resultSource = await source.api.apis.TrustedQueryApi.is_trusted_reserve(
    assetToTransfer,
    getXcmLocationForRoute(source, reserve)
  )

  let resultDest = undefined
  if (destSupports) {
    resultDest = await source.api.apis.TrustedQueryApi.is_trusted_reserve(
      assetToTransfer,
      getXcmLocationForRoute(source, reserve)
    )
  }

  logger.debug({ resultSource, reserve: reserve.name }, 'TrustedQuery result')
  logger.debug({ resultSource, reserve: reserve.name }, 'TrustedQuery result')

  // Check if source chain supports TrustedQuery, and if the result of the check for reserve is true
  // Also check if destination chain supports TrustedQuery, and allow case when TrustedQuery is not supported, or the result of
  // the check is true (because we can't know if the transfer will work or not based on this data)
  //
  // If destination chain supports TQ but check result is false - then we know whole transfer will fail anyway for this reserve
  return (
    resultSource.success &&
    resultSource.value &&
    (resultDest == undefined || (resultDest.success && resultSource.value))
  )
}
