import { ChainDefinition } from '@chains/chain-types.js'
import { XcmVersionedAsset } from '@polkadot-api/descriptors'
import { passesTrustedQueryCheck } from '@runtime/trusted-query.js'
import { passesMinimalDryRunCheck, passesFullDryRunCheck } from '@runtime/dryrun.js'
import { hasEnoughFundsOnSovereignAccount } from '@xcm/xcm-utils.js'

async function filterAsync<T>(array: T[], predicate: (item: T) => Promise<boolean>): Promise<T[]> {
  const results = await Promise.all(array.map(predicate))
  return array.filter((_, i) => results[i])
}

export async function filterPossibleReserves(
  reserves: ChainDefinition[],
  source: ChainDefinition,
  assetToTransfer: XcmVersionedAsset,
  amount: bigint
): Promise<ChainDefinition[]> {
  for (const reserve of reserves) {
    if (await passesFullDryRunCheck(source, reserve, amount)) {
      return [reserve]
    }
  }

  let stillPossible = reserves

  stillPossible = await filterAsync(stillPossible, (r) =>
    passesTrustedQueryCheck(source, r, assetToTransfer)
  )

  stillPossible = await filterAsync(stillPossible, (r) =>
    hasEnoughFundsOnSovereignAccount(source, r, amount)
  )

  stillPossible = await filterAsync(stillPossible, (r) =>
    passesMinimalDryRunCheck(source, r, amount)
  )

  return stillPossible
}
