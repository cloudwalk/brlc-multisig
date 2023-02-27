// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { MultiSigWallet } from "./MultiSigWallet.sol";

/**
 * @title MultiSigWalletFactory contract
 * @author CloudWalk Inc.
 * @dev The contract factory for creating new multisig wallet contracts.
 */
contract MultiSigWalletFactory is Ownable {
    /// @dev The array of addresses of multisig deployed by this factory.
    address[] internal _wallets;

    /**
     * @dev Creates and deploys new multisig wallet contract with the passed constructor parameters.
     * @param owners The array of the owners of the deployed multisig.
     * @param requiredApprovals The number of required approvals for multisig transactions.
     * @return The address of the deployed multisig.
     */
    function deployNewWallet(
        address[] memory owners,
        uint256 requiredApprovals
    ) external onlyOwner returns (address) {
        address newWallet = address(new MultiSigWallet(owners, requiredApprovals));
        _wallets.push(newWallet);
        return newWallet;
    }

    /**
     * @dev Returns an array of deployed wallets.
     */
    function getDeployedWallets() external view returns (address[] memory) {
        return _wallets;
    }
}
