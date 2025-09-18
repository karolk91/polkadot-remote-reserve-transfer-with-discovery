import {
  XcmV3MultiassetFungibility,
  XcmV5Instruction,
  XcmV3WeightLimit,
  XcmVersionedXcm,
} from '@polkadot-api/descriptors'
import { ChainDefinition } from '@chains/chain-types.js'
import { getNetworkTokenLocationFor, getXcmLocationForRoute } from '@xcm/xcm-utils.js'
import { checkRuntimeSupportsApiWithVersion, WANTED_DRY_RUN_API } from '@runtime/runtime-api-checks.js'
import { logger } from '@logging/logger.js'

export async function passesMinimalDryRunCheck(
  source: ChainDefinition,
  reserve: ChainDefinition,
  amount: bigint
): Promise<boolean> {
  const supportsDryRun = await checkRuntimeSupportsApiWithVersion(
    reserve.client,
    WANTED_DRY_RUN_API.name,
    WANTED_DRY_RUN_API.ver
  )

  if (!supportsDryRun) return true

  const asset = {
    id: getNetworkTokenLocationFor(reserve),
    fun: XcmV3MultiassetFungibility.Fungible(amount),
  }

  const xcm = XcmVersionedXcm.V5([
    XcmV5Instruction.WithdrawAsset([asset]),
    XcmV5Instruction.BuyExecution({
      fees: asset,
      weight_limit: XcmV3WeightLimit.Unlimited(),
    }),
  ])

  const result = await reserve.api.apis.DryRunApi.dry_run_xcm(
    await getXcmLocationForRoute(reserve, source),
    xcm
  )

  const passed = result.success && result.value.execution_result.type === 'Complete'

  if (!passed) {
    logger.warn({ result, reserve: reserve.name }, 'Minimal dry-run failed')
  }

  return passed
}

export async function passesFullDryRunCheck(
  source: ChainDefinition,
  reserve: ChainDefinition,
  amount: bigint
): Promise<boolean> {
  const srcSupport = await checkRuntimeSupportsApiWithVersion(
    source.client,
    WANTED_DRY_RUN_API.name,
    WANTED_DRY_RUN_API.ver
  )
  const resSupport = await checkRuntimeSupportsApiWithVersion(
    reserve.client,
    WANTED_DRY_RUN_API.name,
    WANTED_DRY_RUN_API.ver
  )

  const possible = srcSupport && resSupport
  logger.debug({ srcSupport, resSupport }, 'Full dry-run support')

  if (!possible) return false

  // TODO: implement real full dry-run logic
  return false
}
