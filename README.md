# Polkadot XCM Reserve-based transfers testing project

This project contains integration tests for XCM reserve-based transfers using
Chopsticks and polkadot-api (PAPI) and is mainly concerned with the specific type of transfer that requires Remote Reserve.

Intention of the project is to showcase logic required to properly choose a remote reserve for a transfer of DOT/KSM/WND between parachains. Reserve choice is done dynamically based on various checks against runtime APIs - this allows to adapt to possible change of the reserve in real-time and be immune to Asset Hub migration, runtime upgrades etc.

Testing environment is spinning up local network powered by Chopsticks composed of Westend Relay, Westend Asset Hub and Westend Penpal chains.

## Running the project

### Requirements

- Yarn

### 1. Install dependencies

    yarn install

### 2. Run the tests

    yarn test

### Details about the algorithm

Reserve-based transfer of assets using Remote Reserve is a type of transfer where two chains (source & destination) wants to move funds from one to the other, but they do not trust each other. In such case they still can transact if there is another chain that they commonly trust, a middle-man (common reserve). This middle-man chain provides appropriate bookkeeping to ensure transactions are allowed to happen. Its done in terms of Sovereign Accounts - special accounts that live on the common reserve chain, which are in control of these other chains.

With regards to chains participanting in the transfer we need to consider:

1. Does the runtime configuration, specifically `IsReserve` attribute recognizes the middle-man as trusted source for given asset. Both on the source and the destination
1. Does the source chain have enough funds on the balance of its Sovereign Account on common reserve chain?
1. How to find out which chain is the common reserve in the first place ?

In context of network native asset (DOT, KSM, WND), traditionally it was well known that the relay chain of the network acted as common, trusted reserver for other parachains. The landscape is changing and in the near future, the Asset Hub system chain will take over this role.

Taking into account all the things to consider (mentioned above), it can be seen that the switch depends on many factors. Its entirely possible that for some time landscape will be fragmented, and chains will update their runtime configurations possibly to trust both reserves at the same time (Relay Chain + Asset Hub). Orthogonal to the configuration updates, transfer of funds of the Sovereign Accounts will happen.

As such, this project proposes and implements as a Proof of Concept, an algorithm that will allow for seamless transition in context of the above but also reduces the chances of erroneus scenarios in general. On the high-level it can be described as follow

> **Note**
> please also consider the pipeline below implemented [HERE](xcm/filters.ts):

1. The idea is to figure out final list of possible reserves
1. Start with full list (Asset Hub, Relay Chain) and for every possible reserve chain:
   1. Verify if Asset Hub Migration is in progress - if yes, it means that Relay Chain is currently migrating and cannot be used as reserve. Asset Hub can be considered a possible reserve at this point, but this will depend upon further checks (if eg. Sovereign Accounts were already migrated)
      1. Make sure that `RcMigrator` pallet is present on Relay Chain, if not, then no migration is happening and Relay Chain can be considered a possible reserve
      1. If pallet is present, query storage `RcMigrator.RcMigrationStage` -> any value other than `Pending` or `MigrationDone` means that migration is in progress and Relay Chain should be eliminated from final possible reserve list
   1. Verify if all the participating chains (the triple), implement [`DryRunApi`](https://chains.papi.how/polkadot_asset_hub/modules/RuntimeCalls.DryRunApi.html). If yes, then execute full path of dry-runs, starting on the source chain, through reserve and destination chain. Set of supported APIs can be retrieved via [`state_getRuntimeVersion`](https://polkadot.js.org/docs/polkadot/rpc/#getruntimeversionat-blockhash-runtimeversion) RPC API
      1. Having full dry-run succesful result, ensures everything is in place for transfer to succeed.
      1. If dry-run result is not succesful, try with another reserve.
      1. If dry-run fails for all possible reserves, then the transfer is not possible
   1. Else, if any of the chain doesn't support `DryRunApi`, fallback to set of elimination methods:
      1. For source and destination chains, verify if they support [`TrustedQuery`](https://chains.papi.how/westend_asset_hub/modules/RuntimeCalls.TrustedQueryApi.html) API.
         1. If any of the two chains implement the API and their `is_trusted_reserve` method returns `false` - it means that the currently being checked reserve is not trusted by source or destination chains so it cannot be used. If thats the case, remove this reserve from final list of possible reserves (eliminate from the list).
         1. Otherwise if source and destination chain either doesn't support `TrustedQuery` or `is_trusted_reserve` returns true it means that this reserve stays on final list of possible reserves
      1. Then, for source chain, check if its Soverign Account balance on the reserve chain has enough funds to cover the amount of asset of the transfer in question. This can be achieved by utlizing [`LocationToAccount`](https://chains.papi.how/westend_asset_hub/modules/RuntimeCalls.LocationToAccountApi.html) API to find out the SS58 Address of the Sovereign Account and then read its balance
         1. If balance is not enough, the transfer will fail, eliminate this reserve from final list
      1. As final elimination step, knowing that possible reserve chains (Asset Hub and Relay Chain) support `DryRunApi`, its possible to prepare minimal XCM program that resembles real scenario to verify any other issue. Minimal XCM program is defined as below, and the origin sending this XCM is set to the source chain:

         ```
         const xcm = XcmVersionedXcm.V5([
             XcmV5Instruction.WithdrawAsset([asset]),
             XcmV5Instruction.BuyExecution({
             fees: asset,
             weight_limit: XcmV3WeightLimit.Unlimited(),
             }),
         ])
         ```

         1. If dry-run of the XCM above result is not succesfull, eliminate reserve in-check from the final list

1. At this point, the final possible reserve list contains either single entry due to the full-dry run check, or there can be multiple entries that survived the elimination steps above. There is still no 100% guarantee that the transfer will work, but chances to fail are greatly reduced
