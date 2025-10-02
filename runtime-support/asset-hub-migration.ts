import { ChainDefinition, RelayDefinition } from '@chains/chain-types.js'
import { CompatibilityLevel } from 'polkadot-api'

export async function passesMigrationNotInProgressCheck(
  reserve: ChainDefinition
): Promise<boolean> {
  if (reserve.isRelay) {
    if (
      await (reserve as RelayDefinition).api.query.RcMigrator.RcMigrationStage.isCompatible(
        CompatibilityLevel.Identical
      )
    ) {
      const migrationStatus = await (
        reserve as RelayDefinition
      ).api.query.RcMigrator.RcMigrationStage.getValue()
      if (migrationStatus.type != 'Pending' && migrationStatus.type != 'MigrationDone') {
        return false // Migration is in progress on this chain, do not use as reserve
      }
    } // else RcMigrator not supported, means no migration can happen
  }
  return true
}
