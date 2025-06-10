# Multi-signature Wallet

<p align="center">
  <img src="./docs/media/brlc-cover.png">
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![example branch parameter](https://github.com/cloudwalk/brlc-multisig/actions/workflows/build.yml/badge.svg?branch=main)
![example branch parameter](https://github.com/cloudwalk/brlc-multisig/actions/workflows/test.yml/badge.svg?branch=main)

The purpose of multi-signature wallets is to increase security by requiring multiple parties to agree on transactions before execution. Transactions can be executed only when confirmed by a predefined number of owners. The project provides two implementations:

- A standard non-upgradeable implementation (`MultiSigWallet.sol`)
- An upgradeable implementation (`MultiSigWalletUpgradeable.sol`) using the UUPS pattern

Key features:
- Configurable number of required approvals
- Transaction expiration time
- Comprehensive security measures

## Documentation

Functional requirements are described in the [documentation](docs/documentation.md).
Technical requirements are described in the NatSpec comments in the code.

## Security audit

Smart contracts are [audited](https://github.com/mixbytes/audits_public) by [MixBytes](https://mixbytes.io):

- [MD Report](https://github.com/mixbytes/audits_public/blob/master/CloudWalk/README.md)
- [PDF Report](https://github.com/mixbytes/audits_public/blob/master/CloudWalk/CloudWalk%20Multisig%20Wallet%20Audit%20Report.pdf)
- [PDF Report (local copy)](CloudWalk%20Multisig%20Wallet%20Audit%20Report.pdf)

NOTE: There have been some changes in the contracts since the last audit, but they are not related to the main logic.

## Project Setup
1. Clone the repo.
2. Create the `.env` file based on the `.env.example` one:
    * Windows:
    ```sh
    copy .env.example .env
    ```
    * MacOS/Linux:
    ```sh
    cp .env.example .env
    ```
3. Update settings in the newly created `.env` file if needed (e.g. another solidity version, number of optimization runs, private keys (PK) for networks, network RPC URLs, etc.).

## Build and test

```sh
# Install all dependencies
npm install

# Compile all contracts
npx hardhat compile

# Run all tests
npx hardhat test
```

## Licensing

This project is released under the MIT License, see [LICENSE](./LICENSE).