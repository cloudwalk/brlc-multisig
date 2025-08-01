// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import { MultiSigWalletBase } from "./base/MultiSigWalletBase.sol";

/**
 * @title MultiSigWallet contract
 * @author CloudWalk Inc. (See https://www.cloudwalk.io)
 * @dev The implementation of the multi-signature wallet contract.
 */
contract MultiSigWallet is MultiSigWalletBase {
    /**
     * @dev Constructor that sets multi-signature wallet owners and number of required approvals.
     *
     * @param newOwners An array of wallet owners.
     * @param newRequiredApprovals The number of required approvals to execute a transaction.
     */
    constructor(address[] memory newOwners, uint16 newRequiredApprovals) {
        _configureExpirationTime(10 days);
        _configureOwners(newOwners, newRequiredApprovals);
    }
}
