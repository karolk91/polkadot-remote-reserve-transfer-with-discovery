import {
  XcmV3MultiassetFungibility,
  XcmV5Instruction,
  XcmV3WeightLimit,
  XcmVersionedXcm,
  DispatchRawOrigin,
} from '@polkadot-api/descriptors'
import { ChainDefinition, ParachainDefinition } from '@chains/chain-types.js'
import { getNetworkTokenLocationFor, getXcmLocationForRoute } from '@xcm/xcm-utils.js'
import {
  checkRuntimeSupportsApiWithVersion,
  WANTED_DRY_RUN_API,
} from '@runtime/runtime-api-checks.js'
import { logger } from '@logging/logger.js'
import { TransferViaTransferAssetsUsingTypeAndThen } from '@xcm/send-transfer.js'
import { SS58String } from 'polkadot-api'
import { isEqual } from 'lodash'

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

function findForwardedXcm(
  forwardedXcms: [unknown, XcmVersionedXcm[] | undefined][],
  expectedLocation: unknown
): XcmVersionedXcm | null {
  const found = forwardedXcms.find(([location]) => isEqual(location, expectedLocation))
  if (!found) return null

  const [, messages] = found
  return messages && messages.length > 0 ? messages[0]! : null
}

export async function passesFullDryRunCheck(
  source: ParachainDefinition,
  reserve: ChainDefinition,
  dest: ChainDefinition,
  extrinsicBuilder: (reserve: ChainDefinition) => TransferViaTransferAssetsUsingTypeAndThen,
  origin: SS58String
): Promise<boolean> {
  const [sourceSupport, reserveSupport, destSupport] = await Promise.all([
    checkRuntimeSupportsApiWithVersion(
      source.client,
      WANTED_DRY_RUN_API.name,
      WANTED_DRY_RUN_API.ver
    ),
    checkRuntimeSupportsApiWithVersion(
      reserve.client,
      WANTED_DRY_RUN_API.name,
      WANTED_DRY_RUN_API.ver
    ),
    checkRuntimeSupportsApiWithVersion(
      dest.client,
      WANTED_DRY_RUN_API.name,
      WANTED_DRY_RUN_API.ver
    ),
  ])

  if (!(sourceSupport && reserveSupport && destSupport)) {
    logger.warn({ sourceSupport, reserveSupport, destSupport }, 'Full dry-run not supported')
    return false
  }

  const sourceResult = await source.api.apis.DryRunApi.dry_run_call(
    { type: 'system', value: DispatchRawOrigin.Signed(origin) },
    extrinsicBuilder(reserve).decodedCall,
    5
  )
  if (!sourceResult.success) return false

  const firstHop = findForwardedXcm(
    sourceResult.value.forwarded_xcms ?? [],
    getXcmLocationForRoute(source, reserve)
  )
  if (!firstHop) return false

  const reserveResult = await reserve.api.apis.DryRunApi.dry_run_xcm(
    getXcmLocationForRoute(reserve, source),
    firstHop
  )
  if (!reserveResult.success) return false

  const secondHop = findForwardedXcm(
    reserveResult.value.forwarded_xcms ?? [],
    getXcmLocationForRoute(reserve, dest)
  )
  if (!secondHop) return false

  const destResult = await dest.api.apis.DryRunApi.dry_run_xcm(
    getXcmLocationForRoute(dest, reserve),
    secondHop
  )

  return destResult.success
}
