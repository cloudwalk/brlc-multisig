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
    /**
     * @dev New wallet was deployed by factory.
     * @param deployer The address of the wallet deployer.
     * @param newWallet The address of the deployed wallet.
     * @param id The id of the deployed wallet.
     */
    event NewWallet(address indexed deployer, address indexed newWallet, uint indexed id);

    /// @dev The array of addresses of multisig deployed by this factory.
    address[] internal _wallets;

    /**
     * @dev Creates and deploys new multisig wallet contract with the passed constructor parameters.
     * @param owners The array of the owners of the deployed multisig.
     * @param requiredApprovals The number of required approvals for multisig transactions.
     * @return The address of the deployed multisig.
     */
    function deployNewWallet(address[] memory owners, uint256 requiredApprovals) external onlyOwner returns (address) {
        address newWallet = address(new MultiSigWallet(owners, requiredApprovals));
        _wallets.push(newWallet);
        emit NewWallet(msg.sender, newWallet, _wallets.length - 1);
        return newWallet;
    }

    /**
     * @dev Returns an array of deployed wallets.
     * @param id The id og the wallet which address will be returned.
     */
    function getDeployedWallet(uint256 id) external view returns (address) {
        return _wallets[id];
    }

    /**
     * @dev Returns the amount of deployed wallets.
     */
    function walletsCount() external view returns (uint256) {
        return _wallets.length;
    }
}
