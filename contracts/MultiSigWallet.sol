// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import { MultiSigWalletStorage } from "./MultiSigWalletStorage.sol";
import { IMultiSigWallet } from "./IMultiSigWallet.sol";

/**
 * @title MultiSigWallet contract
 * @author CloudWalk Inc.
 * @dev The implementation of the multi-signature wallet contract.
 */
contract MultiSigWallet is Initializable, MultiSigWalletStorage, IMultiSigWallet {
    // --------------------------- Errors ---------------------------

    /// @dev An unauthorized account called a function.
    error UnauthorizedCaller();

    /// @dev A transaction with the specified Id does not exist.
    error TransactionNotExist();

    /// @dev A transaction with the specified Id is already executed.
    error TransactionAlreadyExecuted();

    /// @dev A transaction with the specified Id must be approved by the caller.
    error TransactionNotApproved();

    /// @dev A transaction with the specified Id is already approved by the caller.
    error TransactionAlreadyApproved();

    /// @dev An empty array of addresses was passed when configuring the wallet owners.
    error EmptyOwnersArray();

    /// @dev The zero address was passed within the owners array when configuring the wallet owners.
    error ZeroOwnerAddress();

    /// @dev A duplicate address was passed within the owners array when configuring the wallet owners.
    error DuplicateOwnerAddress();

    /// @dev An invalid number of required approvals was passed when configuring the wallet owners.
    error InvalidRequiredApprovals();

    /// @dev The number of approvals for a given transaction is less than the required minimum.
    error NotEnoughApprovals();

    /// @dev A low level call/transaction to the transaction receiver failed.
    error InternalTransactionFailed(bytes data);

    /// @dev A transaction with the specified Id has already expired.
    error TransactionExpired();

    /// @dev A transaction with the specified Id is on cooldown.
    error CooldownNotEnded();

    // ------------------------- Modifiers --------------------------

    /**
     * @dev Throws if called by any account other than a wallet owner.
     */
    modifier onlyOwner() {
        if (!_isOwner[msg.sender]) {
            revert UnauthorizedCaller();
        }
        _;
    }

    /**
     * @dev Throws if called by any account other than the contract itself.
     */
    modifier onlySelfCall() {
        if (msg.sender != address(this)) {
            revert UnauthorizedCaller();
        }
        _;
    }

    // ------------------------- Functions --------------------------

    /**
     * @dev Constructor that prohibits the initialization of the implementation of the upgradable contract.
     *
     * See details
     * https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable#initializing_the_implementation_contract
     *
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev The initializer of the upgradable contract.
     *
     * See details https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable
     *
     * Requirements:
     *
     * - The array of wallet owners must not be empty.
     * - The number of required approvals must not be zero and must not exceed the length of the wallet owners array.
     *
     * @param newOwners An array of wallet owners.
     * @param newRequiredApprovals The number of required approvals to execute a transaction.
     */
    function initialize(address[] memory newOwners, uint256 newRequiredApprovals) external initializer {
        __BRLCMultisig_init(newOwners, newRequiredApprovals);
    }

    /**
     * @dev The internal initializer of the upgradable contract.
     *
     * See {MultiSigWallet-initialize}.
     */
    function __BRLCMultisig_init(address[] memory newOwners, uint256 newRequiredApprovals) internal onlyInitializing {
        __BRLCMultisig_init_unchained(newOwners, newRequiredApprovals);
    }

    /**
     * @dev The unchained internal initializer of the upgradable contract.
     *
     * See {MultiSigWallet-initialize}.
     */
    function __BRLCMultisig_init_unchained(address[] memory newOwners, uint256 newRequiredApprovals)
        internal
        onlyInitializing
    {
        _configureExpirationTime(365 days);
        _configureOwners(newOwners, newRequiredApprovals);
    }

    /**
     * @dev Called when native tokens are sent to the contract.
     *
     * Emits a {Deposit} event.
     */
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @dev See {IMultiSigWallet-submit}.
     *
     * Requirements:
     *
     * - The caller must be a wallet owner.
     */
    function submit(
        address to,
        uint256 value,
        bytes calldata data
    ) external onlyOwner {
        _submit(to, value, data);
    }

    /**
     * @dev See {IMultiSigWallet-submitAndApprove}.
     *
     * Requirements:
     *
     * - The caller must be a wallet owner.
     */
    function submitAndApprove(
        address to,
        uint256 value,
        bytes calldata data
    ) external onlyOwner {
        _approve(_submit(to, value, data));
    }

    /**
     * @dev See {IMultiSigWallet-approve}.
     *
     * Requirements:
     *
     * - The caller must be a wallet owner.
     * - The transaction with the given Id must exist.
     * - The transaction with the given Id must not be expired.
     * - The transaction with the given Id must not be executed.
     * - The transaction with the given Id must not be already approved by the caller.
     */
    function approve(uint256 txId) external onlyOwner {
        _approve(txId);
    }

    /**
     * @dev See {IMultiSigWallet-approveAndExecute}.
     *
     * Requirements:
     *
     * - The caller must be a wallet owner.
     * - The transaction with the given Id must exist.
     * - The transaction with the given Id must not be expired.
     * - The transaction with the given Id must not be executed.
     * - The transaction with the given Id must not be on cooldown.
     * - The transaction with the given Id must not be already approved by the caller.
     * - The transaction with the given Id must have at least the required number of approvals minus one.
     */
    function approveAndExecute(uint256 txId) external onlyOwner {
        _approve(txId);
        _execute(txId);
    }

    /**
     * @dev See {IMultiSigWallet-execute}.
     *
     * Requirements:
     *
     * - The caller must be a wallet owner.
     * - The transaction with the given Id must exist.
     * - The transaction with the given Id must not be expired.
     * - The transaction with the given Id must not be executed.
     * - The transaction with the given Id must not be on cooldown.
     * - The transaction with the given Id must have at least the required number of approvals.
     */
    function execute(uint256 txId) external onlyOwner {
        _execute(txId);
    }

    /**
     * @dev See {IMultiSigWallet-revoke}.
     *
     * Requirements:
     *
     * - The caller must be a wallet owner.
     * - The transaction with the given Id must exist.
     * - The transaction with the given Id must not be expired.
     * - The transaction with the given Id must not be executed.
     * - The transaction with the given Id must be approved by the caller.
     */
    function revoke(uint256 txId) external onlyOwner {
        _revoke(txId);
    }

    /**
     * @dev See {IMultiSigWallet-configureOwners}
     *
     * Requirements:
     *
     * - The array of wallet owners must not be empty.
     * - The number of required approvals must not be zero and must not exceed the length of the wallet owners array.
     */
    function configureOwners(address[] memory newOwners, uint256 newRequiredApprovals) external onlySelfCall {
        _configureOwners(newOwners, newRequiredApprovals);
    }

    /**
     * @dev See {IMultiSigWallet-configureExpirationTime}
     */
    function configureExpirationTime(uint256 newExpirationTime) external onlySelfCall {
        _configureExpirationTime(newExpirationTime);
    }

    /**
     * @dev See {IMultiSigWallet-configureCooldownTime}
     */
    function configureCooldownTime(uint256 newCooldownTime) external onlySelfCall {
        _configureCooldownTime(newCooldownTime);
    }

    /**
     * @dev See {IMultiSigWallet-getApprovalCount}.
     */
    function getApprovalCount(uint256 txId) external view returns (uint256) {
        return _approvalCount[txId];
    }

    /**
     * @dev See {IMultiSigWallet-getApprovalStatus}.
     */
    function getApprovalStatus(uint256 txId, address owner) external view returns (bool) {
        return _approvalStatus[txId][owner];
    }

    /**
     * @dev See {IMultiSigWallet-getTransaction}.
     */
    function getTransaction(uint256 txId) external view returns (Transaction memory) {
        return _transactions[txId];
    }

    /**
     * @dev See {IMultiSigWallet-getTransactions}.
     *
     * The total number of returned transactions will not exceed the provided limit, but may be less.
     * The function will return an empty array if there is no transaction with the given Id or if the limit is zero.
     * The empty transaction array will be returned if the transaction with the provided Id does not exist or the
     * provided limit is zero.
     */
    function getTransactions(uint256 txId, uint256 limit) external view returns (Transaction[] memory txs) {
        uint256 len = _transactions.length;
        if (len <= txId || limit == 0) {
            txs = new Transaction[](0);
        } else {
            len -= txId;
            if (len > limit) {
                len = limit;
            }
            txs = new Transaction[](len);
            for (uint256 i = 0; i < len; i++) {
                txs[i] = _transactions[txId];
                txId++;
            }
        }
    }

    /**
     * @dev See {IMultiSigWallet-owners}.
     */
    function owners() external view returns (address[] memory) {
        return _owners;
    }

    /**
     * @dev See {IMultiSigWallet-isOwner}.
     */
    function isOwner(address account) external view returns (bool) {
        return _isOwner[account];
    }

    /**
     * @dev See {IMultiSigWallet-requiredApprovals}.
     */
    function requiredApprovals() external view returns (uint256) {
        return _requiredApprovals;
    }

    /**
     * @dev See {IMultiSigWallet-transactionCount}.
     */
    function transactionCount() external view returns (uint256) {
        return _transactions.length;
    }

    /**
     * @dev See {IMultiSigWallet-expirationTime}.
     */
    function expirationTime() external view returns (uint256) {
        return _expirationTime;
    }

    /**
     * @dev See {IMultiSigWallet-cooldownTime}.
     */
    function cooldownTime() external view returns (uint256) {
        return _cooldownTime;
    }

    /**
     * @dev See {MultiSigWallet-submit}.
     */
    function _submit(
        address to,
        uint256 value,
        bytes calldata data
    ) internal returns (uint256 txId) {
        _transactions.push(
            Transaction({
                to: to,
                value: value,
                cooldown: block.timestamp + _cooldownTime,
                expiration: block.timestamp + _cooldownTime + _expirationTime,
                executed: false,
                data: data
            })
        );

        txId = _transactions.length - 1;

        emit Submit(msg.sender, txId);
    }

    /**
     * @dev See {MultiSigWallet-approve}.
     */
    function _approve(uint256 txId) internal {
        if (txId >= _transactions.length) {
            revert TransactionNotExist();
        }
        if (_approvalStatus[txId][msg.sender]) {
            revert TransactionAlreadyApproved();
        }

        Transaction memory transaction = _transactions[txId];

        if (transaction.executed) {
            revert TransactionAlreadyExecuted();
        }
        if (transaction.expiration < block.timestamp) {
            revert TransactionExpired();
        }

        _approvalCount[txId] += 1;
        _approvalStatus[txId][msg.sender] = true;

        emit Approve(msg.sender, txId);
    }

    /**
     * @dev See {MultiSigWallet-execute}.
     */
    function _execute(uint256 txId) internal {
        if (txId >= _transactions.length) {
            revert TransactionNotExist();
        }

        Transaction storage transaction = _transactions[txId];

        if (transaction.executed) {
            revert TransactionAlreadyExecuted();
        }
        if (transaction.cooldown > block.timestamp) {
            revert CooldownNotEnded();
        }
        if (transaction.expiration < block.timestamp) {
            revert TransactionExpired();
        }
        if (_approvalCount[txId] < _requiredApprovals) {
            revert NotEnoughApprovals();
        }

        transaction.executed = true;

        emit Execute(msg.sender, txId);

        (bool success, bytes memory data) = transaction.to.call{ value: transaction.value }(transaction.data);
        if (!success) {
            revert InternalTransactionFailed(data);
        }
    }

    /**
     * @dev See {MultiSigWallet-revoke}.
     */
    function _revoke(uint256 txId) internal {
        if (txId >= _transactions.length) {
            revert TransactionNotExist();
        }
        if (!_approvalStatus[txId][msg.sender]) {
            revert TransactionNotApproved();
        }

        Transaction storage transaction = _transactions[txId];

        if (transaction.executed) {
            revert TransactionAlreadyExecuted();
        }
        if (transaction.expiration < block.timestamp) {
            revert TransactionExpired();
        }

        _approvalCount[txId] -= 1;
        _approvalStatus[txId][msg.sender] = false;

        emit Revoke(msg.sender, txId);
    }

    /**
     * @dev See {MultiSigWallet-configureOwners}.
     */
    function _configureOwners(address[] memory newOwners, uint256 newRequiredApprovals) internal {
        if (newOwners.length == 0) {
            revert EmptyOwnersArray();
        }
        if (newRequiredApprovals == 0) {
            revert InvalidRequiredApprovals();
        }
        if (newRequiredApprovals > newOwners.length) {
            revert InvalidRequiredApprovals();
        }

        uint256 len;
        if (_owners.length != 0) {
            len = _owners.length;
            for (uint256 i = 0; i < len; i++) {
                _isOwner[_owners[i]] = false;
            }
        }

        address owner;
        len = newOwners.length;
        for (uint256 i = 0; i < len; i++) {
            owner = newOwners[i];

            if (owner == address(0)) {
                revert ZeroOwnerAddress();
            }
            if (_isOwner[owner]) {
                revert DuplicateOwnerAddress();
            }

            _isOwner[owner] = true;
        }

        _owners = newOwners;
        _requiredApprovals = newRequiredApprovals;

        emit ConfigureOwners(newOwners, newRequiredApprovals);
    }

    /**
     * @dev See {MultiSigWallet-configureExpirationTime}.
     */
    function _configureExpirationTime(uint256 newExpirationTime) internal {
        _expirationTime = newExpirationTime;
        emit CofigureExpirationTime(newExpirationTime);
    }

    /**
     * @dev See {MultiSigWallet-configureCooldownTime}.
     */
    function _configureCooldownTime(uint256 newCooldownTime) internal {
        _cooldownTime = newCooldownTime;
        emit ConfigureCooldownTime(newCooldownTime);
    }
}
