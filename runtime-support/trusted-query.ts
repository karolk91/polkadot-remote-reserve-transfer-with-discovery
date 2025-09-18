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
  assetToTransfer: XcmVersionedAsset
): Promise<boolean> {
  const supports = await checkRuntimeSupportsApiWithVersion(
    source.client,
    WANTED_TRUSTED_QUERY_API.name,
    WANTED_TRUSTED_QUERY_API.ver
  )

  logger.debug({ source: source.name, supports }, 'TrustedQuery support')

  if (!supports) return true

  const result = await source.api.apis.TrustedQueryApi.is_trusted_reserve(
    assetToTransfer,
    getXcmLocationForRoute(source, reserve)
  )

  logger.debug({ result, reserve: reserve.name }, 'TrustedQuery result')

  return result.success && result.value
}
