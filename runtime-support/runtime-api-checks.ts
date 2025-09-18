import { blake2b } from '@noble/hashes/blake2'
import { PolkadotClient } from 'polkadot-api'

export async function fetchRuntimeSupportedApiIds(
  client: PolkadotClient
): Promise<[string, number][]> {
  const result = await client._request('state_getRuntimeVersion', [])
  return Array.isArray(result?.apis)
    ? result.apis.map((p: [string, number]) => [String(p[0]), Number(p[1])])
    : []
}

export function traitNameToRuntimeApiId(traitName: string): string {
  const hash = blake2b(new TextEncoder().encode(traitName), { dkLen: 8 })
  return (
    '0x' +
    Array.from(hash)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  )
}

export async function checkRuntimeSupportsApiWithVersion(
  client: PolkadotClient,
  trait: string,
  version: number
): Promise<boolean> {
  const apis = await fetchRuntimeSupportedApiIds(client)
  const wantId = traitNameToRuntimeApiId(trait).toLowerCase()
  return apis.some(([id, ver]) => id.toLowerCase() === wantId && ver === version)
}

export const WANTED_TRUSTED_QUERY_API = { name: 'TrustedQueryApi', ver: 1 }
export const WANTED_DRY_RUN_API = { name: 'DryRunApi', ver: 2 }
