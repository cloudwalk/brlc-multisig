# Multisignature Wallet

<p align="center">
  <img src="./docs/media/brlc-cover.png">
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![example branch parameter](https://github.com/cloudwalk/brlc-multisig/actions/workflows/build.yml/badge.svg?branch=main)
![example branch parameter](https://github.com/cloudwalk/brlc-multisig/actions/workflows/test.yml/badge.svg?branch=main)

The purpose of multisig wallets is to increase security by requiring multiple parties to agree on transactions before execution. Transactions can be executed only when confirmed by a predefined number of owners.

## Documentation

Functional requirements are described in the [documentation](docs/documentation.md).
Technical requirements are described in the NatSpec comments in the code.

## Security audit

Smart contracts are [audited](https://github.com/mixbytes/audits_public) by [MixBytes](https://mixbytes.io):

- [MD Report](https://github.com/mixbytes/audits_public/blob/master/CloudWalk/README.md)
- [PDF Report](https://github.com/mixbytes/audits_public/blob/master/CloudWalk/CloudWalk%20Multisig%20Wallet%20Audit%20Report.pdf)
- [PDF Report (local copy)](CloudWalk%20Multisig%20Wallet%20Audit%20Report.pdf)

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
