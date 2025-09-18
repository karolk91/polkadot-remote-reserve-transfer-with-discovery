import { ChainDefinition, ParachainDefinition } from '@chains/chain-types.js'
import { XcmVersionedAsset } from '@polkadot-api/descriptors'
import { passesTrustedQueryCheck } from '@runtime/trusted-query.js'
import { passesMinimalDryRunCheck, passesFullDryRunCheck } from '@runtime/dryrun.js'
import { hasEnoughFundsOnSovereignAccount } from '@xcm/xcm-utils.js'
import { TransferViaTransferAssetsUsingTypeAndThen } from './send-transfer.js'
import { SS58String } from 'polkadot-api'

async function filterAsync<T>(array: T[], predicate: (item: T) => Promise<boolean>): Promise<T[]> {
  const results = await Promise.all(array.map(predicate))
  return array.filter((_, i) => results[i])
}

export async function filterPossibleReserves(
  reserves: ChainDefinition[],
  source: ParachainDefinition,
  dest: ChainDefinition,
  assetToTransfer: XcmVersionedAsset,
  amount: bigint,
  extrinsicBuilder: (reserve: ChainDefinition) => TransferViaTransferAssetsUsingTypeAndThen,
  origin: SS58String
): Promise<ChainDefinition[]> {
  for (const reserve of reserves) {
    // as soon as we find any reserve that passes full dry-run path, we choose this reserve
    if (await passesFullDryRunCheck(source, reserve, dest, extrinsicBuilder, origin)) {
      return [reserve]
    }
  }

  let stillPossible = reserves

  stillPossible = await filterAsync(stillPossible, (reserve) =>
    passesTrustedQueryCheck(source, reserve, dest, assetToTransfer)
  )

  stillPossible = await filterAsync(stillPossible, (reserve) =>
    hasEnoughFundsOnSovereignAccount(source, reserve, amount)
  )

  stillPossible = await filterAsync(stillPossible, (reserve) =>
    passesMinimalDryRunCheck(source, reserve, amount)
  )

  return stillPossible
}
