// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import { IMultiSigWallet } from "./IMultiSigWallet.sol";
import { MultiSigWalletStorage } from "./MultiSigWalletStorage.sol";

/**
 * @title MultiSigWalletBase contract
 * @author CloudWalk Inc.
 * @dev The base of the multi-signature wallet contract.
 */
abstract contract MultiSigWalletBase is MultiSigWalletStorage, IMultiSigWallet {
    // --------------------------- Constants ---------------------------

    /// @dev The minimal transaction expiration time.
    uint256 public constant MINIMUM_EXPIRATION_TIME = 60 minutes;

    // --------------------------- Errors ---------------------------

    /// @dev An unauthorized account called a function.
    error UnauthorizedCaller();

    /// @dev A transaction with the specified ID does not exist.
    error TransactionNotExist();

    /// @dev A transaction with the specified ID is already executed.
    error TransactionAlreadyExecuted();

    /// @dev A transaction with the specified ID must be approved by the caller.
    error TransactionNotApproved();

    /// @dev A transaction with the specified ID is already approved by the caller.
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

    /// @dev A transaction with the specified ID has already expired.
    error TransactionExpired();

    /// @dev A transaction with the specified ID is on cooldown.
    error CooldownNotEnded();

    /// @dev The invalid amount of time was passed when configuring the expiration time.
    error InvalidExpirationTime();

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
     * @inheritdoc IMultiSigWallet
     *
     * @dev Requirements:
     *
     * - The caller must be a wallet owner.
     * - The transaction with the given ID must exist.
     * - The transaction with the given ID must not be expired.
     * - The transaction with the given ID must not be executed.
     * - The transaction with the given ID must not be already approved by the caller.
     */
    function approve(uint256 txId) external onlyOwner {
        _approve(txId);
    }

    /**
     * @inheritdoc IMultiSigWallet
     *
     * @dev Requirements:
     *
     * - The caller must be a wallet owner.
     * - The transactions with the given IDs must exist.
     * - The transactions with the given IDs must not be expired.
     * - The transactions with the given IDs must not be executed.
     * - The transactions with the given IDs must not be already approved by the caller.
     */
    function approveBatch(uint256[] calldata txIds) external onlyOwner {
        uint256 count = txIds.length;
        for (uint256 i = 0; i < count; ++i) {
            _approve(txIds[i]);   
        }
    }

    /**
     * @inheritdoc IMultiSigWallet
     *
     * @dev Requirements:
     *
     * - The caller must be a wallet owner.
     * - The transaction with the given ID must exist.
     * - The transaction with the given ID must not be expired.
     * - The transaction with the given ID must not be executed.
     * - The transaction with the given ID must not be on cooldown.
     * - The transaction with the given ID must not be already approved by the caller.
     * - The transaction with the given ID must have at least the required number of approvals minus one.
     */
    function approveAndExecute(uint256 txId) external onlyOwner {
        _approve(txId);
        _execute(txId);
    }

    /**
     * @inheritdoc IMultiSigWallet
     *
     * @dev Requirements:
     *
     * - The caller must be a wallet owner.
     * - The transactions with the given IDs must exist.
     * - The transactions with the given IDs must not be expired.
     * - The transactions with the given IDs must not be executed.
     * - The transactions with the given IDs must not be on cooldown.
     * - The transactions with the given IDs must not be already approved by the caller.
     * - The transactions with the given IDs must have at least the required number of approvals minus one.
     */
    function approveAndExecuteBatch(uint256[] calldata txIds) external onlyOwner {
        uint256 count = txIds.length;
        for (uint256 i = 0; i < count; ++i) {
            uint256 txId = txIds[i];
            _approve(txId);
            _execute(txId);
        }
    }

    /**
     * @inheritdoc IMultiSigWallet
     *
     * @dev Requirements:
     *
     * - The caller must be a wallet owner.
     * - The transaction with the given ID must exist.
     * - The transaction with the given ID must not be expired.
     * - The transaction with the given ID must not be executed.
     * - The transaction with the given ID must not be on cooldown.
     * - The transaction with the given ID must have at least the required number of approvals.
     */
    function execute(uint256 txId) external onlyOwner {
        _execute(txId);
    }

    /**
     * @inheritdoc IMultiSigWallet
     *
     * @dev Requirements:
     *
     * - The caller must be a wallet owner.
     * - The transactions with the given IDs must exist.
     * - The transactions with the given IDs must not be expired.
     * - The transactions with the given IDs must not be executed.
     * - The transactions with the given IDs must not be on cooldown.
     * - The transactions with the given IDs must have at least the required number of approvals.
     */
    function executeBatch(uint256[] calldata txIds) external onlyOwner {
        uint256 count = txIds.length;
        for (uint256 i = 0; i < count; ++i) {
            _execute(txIds[i]);
        }
    }

    /**
     * @inheritdoc IMultiSigWallet
     *
     * @dev Requirements:
     *
     * - The caller must be a wallet owner.
     * - The transaction with the given ID must exist.
     * - The transaction with the given ID must not be expired.
     * - The transaction with the given ID must not be executed.
     * - The transaction with the given ID must be approved by the caller.
     */
    function revoke(uint256 txId) external onlyOwner {
        _revoke(txId);
    }

    /**
     * @inheritdoc IMultiSigWallet
     *
     * @dev Requirements:
     *
     * - The caller must be a wallet owner.
     * - The transactions with the given IDs must exist.
     * - The transactions with the given IDs must not be expired.
     * - The transactions with the given IDs must not be executed.
     * - The transactions with the given IDs must be approved by the caller.
     */
    function revokeBatch(uint256[] calldata txIds) external onlyOwner {
        uint256 count = txIds.length;
        for (uint256 i = 0; i < count; ++i) {
            _revoke(txIds[i]);
        }
    }

    /**
     * @inheritdoc IMultiSigWallet
     *
     * @dev Requirements:
     *
     * - The array of wallet owners must not be empty.
     * - The number of required approvals must not be zero and must not exceed the length of the wallet owners array.
     */
    function configureOwners(address[] memory newOwners, uint16 newRequiredApprovals) external onlySelfCall {
        _configureOwners(newOwners, newRequiredApprovals);
    }

    /**
     * @inheritdoc IMultiSigWallet
     */
    function configureExpirationTime(uint120 newExpirationTime) external onlySelfCall {
        _configureExpirationTime(newExpirationTime);
    }

    /**
     * @inheritdoc IMultiSigWallet
     */
    function configureCooldownTime(uint120 newCooldownTime) external onlySelfCall {
        _configureCooldownTime(newCooldownTime);
    }

    /**
     * @inheritdoc IMultiSigWallet
     */
    function getApprovalCount(uint256 txId) external view returns (uint256) {
        return _approvalCount[txId];
    }

    /**
     * @inheritdoc IMultiSigWallet
     */
    function getApprovalStatus(uint256 txId, address owner) external view returns (bool) {
        return _approvalStatus[txId][owner];
    }

    /**
     * @inheritdoc IMultiSigWallet
     */
    function getTransaction(uint256 txId) external view returns (Transaction memory) {
        if (txId >= _transactions.length) {
            revert TransactionNotExist();
        }
        return _transactions[txId];
    }

    /**
     * @inheritdoc IMultiSigWallet
     *
     * @dev Notes:
     * - The total number of returned transactions will not exceed the provided limit, but may be less.
     * - The function will return an empty array if there is no transaction with the given ID or if the limit is zero.
     * - The empty transaction array will be returned if the transaction with the provided ID does not exist or the
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
     * @inheritdoc IMultiSigWallet
     */
    function owners() external view returns (address[] memory) {
        return _owners;
    }

    /**
     * @inheritdoc IMultiSigWallet
     */
    function isOwner(address account) external view returns (bool) {
        return _isOwner[account];
    }

    /**
     * @inheritdoc IMultiSigWallet
     */
    function requiredApprovals() external view returns (uint256) {
        return _requiredApprovals;
    }

    /**
     * @inheritdoc IMultiSigWallet
     */
    function transactionCount() external view returns (uint256) {
        return _transactions.length;
    }

    /**
     * @inheritdoc IMultiSigWallet
     */
    function expirationTime() external view returns (uint120) {
        return _expirationTime;
    }

    /**
     * @inheritdoc IMultiSigWallet
     */
    function cooldownTime() external view returns (uint120) {
        return _cooldownTime;
    }

    /**
     * @dev Submits a transaction internally. See {MultiSigWallet-submit}.
     */
    function _submit(
        address to,
        uint256 value,
        bytes calldata data
    ) internal returns (uint256 txId) {
        uint128 blockTimestamp = toUint128(block.timestamp);

        _transactions.push(
            Transaction({
                to: to,
                executed: false,
                cooldown: blockTimestamp + _cooldownTime,
                expiration: blockTimestamp + _cooldownTime + _expirationTime,
                value: value,
                data: data
            })
        );

        txId = _transactions.length - 1;

        emit Submit(msg.sender, txId);
    }

    /**
     * @dev Approves a transaction internally. See {MultiSigWallet-approve}.
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
     * @dev Executes a transaction internally. {MultiSigWallet-execute}.
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
     * @dev Revokes a transaction internally. {MultiSigWallet-revoke}.
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
     * @dev Configures owners internally. See {MultiSigWallet-configureOwners}.
     */
    function _configureOwners(address[] memory newOwners, uint16 newRequiredApprovals) internal {
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
     * @dev Configures expiration time of transactions internally. See {MultiSigWallet-configureExpirationTime}.
     */
    function _configureExpirationTime(uint120 newExpirationTime) internal {
        if (newExpirationTime < MINIMUM_EXPIRATION_TIME) {
            revert InvalidExpirationTime();
        }
        _expirationTime = newExpirationTime;
        emit ConfigureExpirationTime(newExpirationTime);
    }

    /**
     * @dev Configures cooldown time of transactions internally. See {MultiSigWallet-configureCooldownTime}.
     */
    function _configureCooldownTime(uint120 newCooldownTime) internal {
        _cooldownTime = newCooldownTime;
        emit ConfigureCooldownTime(newCooldownTime);
    }

    /**
     * @dev Returns the downcasted uint128 from uint256, reverting on
     * overflow (when the input is greater than largest uint128).
     */
    function toUint128(uint256 value) internal pure returns (uint128) {
        require(value <= type(uint128).max, "SafeCast: value doesn't fit in 128 bits");
        return uint128(value);
    }
}
