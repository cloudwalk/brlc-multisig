// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

import { IMultiSigWalletTypes } from "./IMultiSigWallet.sol";

/**
 * @title Multisignature wallet storage version 1
 * @author CloudWalk Inc.
 */
abstract contract MultiSigWalletStorageV1 is IMultiSigWalletTypes {
    /// @dev The array of wallet owners.
    address[] internal _owners;

    /// @dev The array of wallet transactions.
    Transaction[] internal _transactions;

    /// @dev The mapping of a contract ownership status for a given account.
    mapping(address => bool) internal _isOwner;

    /// @dev The mapping of an approval existence from a given account and transaction id.
    mapping(uint256 => mapping(address => bool)) internal _approvalStatus;

    /// @dev The number of approvals required to execute a transaction.
    uint256 internal _requiredApprovals;

    /// @dev The time that need to pass after submitting a transaction before it can be executed.
    uint256 internal _cooldownTime;

    /// @dev The time after submitting a transaction before which it can be executed.
    uint256 internal _expirationTime;

    mapping(uint256 => uint256) internal _approvalCount;
}

/**
 * @title MultiSigWallet storage
 *
 * We are following Compound's approach of upgrading new contract implementations.
 * See https://github.com/compound-finance/compound-protocol.
 * When we need to add new storage variables, we create a new version of MultiSigWalletStorage
 * e.g. MultiSigWalletStorage<versionNumber>, so finally it would look like
 * "contract MultiSigWalletStorage is MultiSigWalletStorageV1, MultiSigWalletStorageV2".
 */
abstract contract MultiSigWalletStorage is MultiSigWalletStorageV1 {

}
