// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { MultiSigWalletBase } from "./base/MultiSigWalletBase.sol";

/**
 * @title MultiSigWalletUpgradeable contract
 * @author CloudWalk Inc. (See https://www.cloudwalk.io)
 * @dev The implementation of the upgradeable multi-signature wallet contract.
 */
contract MultiSigWalletUpgradeable is Initializable, UUPSUpgradeable, MultiSigWalletBase {
    // ------------------ Constructor ----------------------------- //

    /**
     * @dev Constructor that prohibits the initialization of the implementation of the upgradeable contract.
     *
     * See details
     * https://docs.openzeppelin.com/upgrades-plugins/writing-upgradeable#initializing_the_implementation_contract
     *
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor() {
        _disableInitializers();
    }

    // ------------------ Initializers ---------------------------- //

    /**
     * @dev The initializer of the upgradeable contract.
     *
     * See details: https://docs.openzeppelin.com/upgrades-plugins/writing-upgradeable
     *
     * Requirements:
     *
     * - The array of wallet owners must not be empty.
     * - The number of required approvals must not be zero and must not exceed the length of the wallet owners array.
     *
     * @param newOwners An array of wallet owners.
     * @param newRequiredApprovals The number of required approvals to execute a transaction.
     */
    function initialize(address[] memory newOwners, uint16 newRequiredApprovals) external initializer {
        _configureExpirationTime(10 days);
        _configureOwners(newOwners, newRequiredApprovals);
    }

    // ------------------ Internal functions ---------------------- //

    /**
     * @dev Upgrade authorization function.
     *
     * See details: https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable
     *
     * @param newImplementation The address of the new implementation
     *
     * Requirements:
     *
     * - The caller must be the multi-signature wallet itself.
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        onlySelfCall
        override
    {}
}
