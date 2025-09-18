import assert from 'assert'

export type DevChainConfig = {
  endpoint: string
  port: number
  overrideWasm?: string
}

export type DevNetwork = {
  advanceNetwork: () => Promise<void>
}

export async function setupNetworks(config: {
  polkadot: DevChainConfig
  assetHub: DevChainConfig
  penpal: DevChainConfig
}): Promise<DevNetwork> {
  const { setupNetworks: setupChopsticks } = await import('@acala-network/chopsticks-testing')
  const chains = await setupChopsticks(config)

  async function advanceNetwork() {
    assert(chains.polkadot)
    assert(chains.assetHub)
    assert(chains.penpal)

    await chains.polkadot.dev.newBlock()
    await chains.assetHub.dev.newBlock()
    await chains.penpal.dev.newBlock()
  }
  return {
    advanceNetwork,
  }
}
