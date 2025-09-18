# Polkadot XCM Testing Project

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