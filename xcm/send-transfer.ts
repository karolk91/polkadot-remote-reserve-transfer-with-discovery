import {
  XcmVersionedAssets,
  XcmVersionedAsset,
  XcmVersionedAssetId,
  XcmV5Instruction,
  XcmV5Junctions,
  XcmV5Junction,
  XcmV5AssetFilter,
  XcmV5WildAsset,
  XcmVersionedXcm,
} from '@polkadot-api/descriptors'
import { FixedSizeBinary, PolkadotSigner } from 'polkadot-api'
import { getXcmLocationForRoute } from '@xcm/xcm-utils.js'
import { ChainDefinition, ParachainDefinition } from '@chains/chain-types.js'
import { logger } from '@logging/logger.js'

export async function xcmTransferViaTransferAssetsUsingTypeAndThen({
  source,
  reserve,
  dest,
  assets,
  assetToTransfer,
  beneficiaryAccountId,
  signer,
}: {
  source: ParachainDefinition
  reserve: ChainDefinition
  dest: ChainDefinition
  assets: Extract<XcmVersionedAssets, { type: 'V5' }>
  assetToTransfer: Extract<XcmVersionedAsset, { type: 'V5' }>
  beneficiaryAccountId: Uint8Array<ArrayBufferLike>
  signer: PolkadotSigner
}) {
  const extrinsic = source.api.tx.PolkadotXcm.transfer_assets_using_type_and_then({
    dest: getXcmLocationForRoute(source, dest),
    assets,
    assets_transfer_type: {
      type: 'RemoteReserve',
      value: getXcmLocationForRoute(source, reserve),
    },
    remote_fees_id: XcmVersionedAssetId.V5(assetToTransfer.value.id),
    fees_transfer_type: {
      type: 'RemoteReserve',
      value: getXcmLocationForRoute(source, reserve),
    },
    custom_xcm_on_dest: XcmVersionedXcm.V5([
      XcmV5Instruction.RefundSurplus(),
      XcmV5Instruction.DepositAsset({
        assets: XcmV5AssetFilter.Wild(XcmV5WildAsset.All()),
        beneficiary: {
          parents: 0,
          interior: XcmV5Junctions.X1(
            XcmV5Junction.AccountId32({
              id: new FixedSizeBinary(beneficiaryAccountId),
            })
          ),
        },
      }),
    ]),
    weight_limit: {
      type: 'Unlimited',
      value: undefined,
    },
  })

  const result = await extrinsic.signAndSubmit(signer)

  if (!result.ok) {
    logger.error({ result }, 'Extrinsic submission failed')
    throw new Error('XCM transfer extrinsic failed')
  }
}
