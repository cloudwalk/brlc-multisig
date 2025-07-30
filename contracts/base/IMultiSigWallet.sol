// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title MultiSigWallet types interface
 * @author CloudWalk Inc. (See https://www.cloudwalk.io)
 */
interface IMultiSigWalletTypes {
    /**
     * @dev The data of a single transaction.
     *
     * The fields:
     *
     * - to ---------- The address of the transaction receiver.
     * - executed ---- The execution status of the transaction. True if executed.
     * - cooldown ---- The timestamp before which the transaction cannot be executed.
     * - expiration -- The timestamp after which the transaction cannot be executed.
     * - value ------- The value in native tokens to be sent along with the transaction.
     * - data -------- The data to be sent along with the transaction.
     */
    struct Transaction {
        address to;
        bool executed;
        uint128 cooldown;
        uint128 expiration;
        uint256 value;
        bytes data;
    }
}

/**
 * @title MultiSigWallet interface
 * @author CloudWalk Inc. (See https://www.cloudwalk.io)
 * @dev The interface of the multi-signature wallet contract.
 */
interface IMultiSigWallet is IMultiSigWalletTypes {
    // ------------------ Events ---------------------------------- //

    /**
     * @dev Emitted when native tokens are deposited to the contract.
     * @param sender The address of the native tokens sender.
     * @param amount The amount of deposited native tokens.
     */
    event Deposit(address indexed sender, uint256 amount);

    /**
     * @dev Emitted when a new transaction is submitted.
     * @param owner The address that submitted the transaction.
     * @param txId The ID of the transaction that is submitted.
     */
    event Submit(address indexed owner, uint256 indexed txId);

    /**
     * @dev Emitted when a transaction is approved.
     * @param owner The address that approved the transaction.
     * @param txId The ID of the transaction that is approved.
     */
    event Approve(address indexed owner, uint256 indexed txId);

    /**
     * @dev Emitted when a transaction approval is revoked.
     * @param owner The address that revoked the transaction approval.
     * @param txId The ID of the transaction whose approval is revoked.
     */
    event Revoke(address indexed owner, uint256 indexed txId);

    /**
     * @dev Emitted when a transaction is executed.
     * @param owner The address that executed the transaction.
     * @param txId The ID of the transaction that is executed.
     */
    event Execute(address indexed owner, uint256 indexed txId);

    /**
     * @dev Emitted when wallet owners are configured.
     * @param newOwners The array of addresses that became the wallet owners.
     * @param newRequiredApprovals The new number of approvals required to execute a transaction.
     */
    event ConfigureOwners(address[] newOwners, uint256 newRequiredApprovals);

    /**
     * @dev Emitted when a transaction expiration time is configured.
     * @param newExpirationTime The new value of the expiration time.
     */
    event ConfigureExpirationTime(uint256 newExpirationTime);

    /**
     * @dev Emitted when a transaction cooldown time is configured.
     * @param newCooldownTime The new value of the cooldown time.
     */
    event ConfigureCooldownTime(uint256 newCooldownTime);

    // ------------------ Transactional functions ----------------- //

    /**
     * @dev Submits a new transaction.
     *
     * Emits a {Submit} event.
     *
     * @param to The address of the transaction receiver.
     * @param value The value of the transaction in native tokens.
     * @param data The input data of the transaction.
     */
    function submit(
        address to, // Tools: prevent Prettier one-liner
        uint256 value,
        bytes calldata data
    ) external;

    /**
     * @dev Submits and approves a new transaction.
     *
     * Emits a {Submit} event.
     * Emits an {Approve} event.
     *
     * @param to The address of the transaction receiver.
     * @param value The value of the transaction in native tokens.
     * @param data The input data of the transaction.
     */
    function submitAndApprove(
        address to, // Tools: prevent Prettier one-liner
        uint256 value,
        bytes calldata data
    ) external;

    /**
     * @dev Approves a previously submitted transaction.
     *
     * Emits an {Approve} event.
     *
     * @param txId The ID of the transaction to approve.
     */
    function approve(uint256 txId) external;

    /**
     * @dev Approves a batch of previously submitted transactions.
     *
     * Emits an {Approve} event for each transaction.
     *
     * @param txIds The ID array of the transactions to approve.
     */
    function approveBatch(uint256[] calldata txIds) external;

    /**
     * @dev Approves and executes a previously submitted transaction.
     *
     * Emits an {Approve} event.
     * Emits an {Execute} event.
     *
     * @param txId The ID of the transaction to approve and execute.
     */
    function approveAndExecute(uint256 txId) external;

    /**
     * @dev Approves and executes a batch of previously submitted transactions.
     *
     * Emits an {Approve} event for each transaction.
     * Emits an {Execute} event for each transaction.
     *
     * @param txIds The ID array of the transactions to approve and execute.
     */
    function approveAndExecuteBatch(uint256[] calldata txIds) external;

    /**
     * @dev Executes a previously submitted transaction.
     *
     * Emits an {Execute} event.
     *
     * @param txId The ID of the transaction to execute.
     */
    function execute(uint256 txId) external;

    /**
     * @dev Executes a batch of previously submitted transactions.
     *
     * Emits an {Execute} event for each transaction.
     *
     * @param txIds The ID array of the transactions to execute.
     */
    function executeBatch(uint256[] calldata txIds) external;

    /**
     * @dev Revokes the approved status from a transaction.
     *
     * Emits a {Revoke} event.
     *
     * @param txId The ID of the transaction to revoke the approved status.
     */
    function revoke(uint256 txId) external;

    /**
     * @dev Revokes the approved status from a batch of transactions.
     *
     * Emits a {Revoke} event for each transaction.
     *
     * @param txIds The ID array of the transactions to revoke the approved status.
     */
    function revokeBatch(uint256[] calldata txIds) external;

    /**
     * @dev Configures wallet owners.
     *
     * Emits a {ConfigureOwners} event.
     *
     * @param newOwners The array of addresses to become the wallet owners.
     * @param newRequiredApprovals The new number of approvals required to execute a transaction.
     */
    function configureOwners(address[] memory newOwners, uint16 newRequiredApprovals) external;

    /**
     * @dev Configures the expiration time that will be applied to new transactions.
     *
     * Emits a {ConfigureExpirationTime} event.
     *
     * @param newExpirationTime The new value of the expiration time.
     */
    function configureExpirationTime(uint120 newExpirationTime) external;

    /**
     * @dev Configures the cooldown time that will be applied to new transactions.
     *
     * Emits a {ConfigureCooldownTime} event.
     *
     * @param newCooldownTime The new value of the cooldown time.
     */
    function configureCooldownTime(uint120 newCooldownTime) external;

    // ------------------ View functions -------------------------- //

    /**
     * @dev Returns the number of approvals for a transaction.
     * @param txId The ID of the transaction to check.
     */
    function getApprovalCount(uint256 txId) external view returns (uint256);

    /**
     * @dev Returns the approval status of a transaction.
     * @param txId The ID of the transaction to check.
     * @param owner The address of the wallet owner to check.
     * @return True if the transaction is approved.
     */
    function getApprovalStatus(uint256 txId, address owner) external view returns (bool);

    /**
     * @dev Returns a single transaction.
     * @param txId The ID of the transaction to return.
     */
    function getTransaction(uint256 txId) external view returns (Transaction memory);

    /**
     * @dev Returns an array of transactions.
     * @param txId The ID of the first transaction in the range to return.
     * @param limit The maximum number of transactions in the range to return.
     */
    function getTransactions(uint256 txId, uint256 limit) external view returns (Transaction[] memory);

    /**
     * @dev Returns an array of wallet owners.
     */
    function owners() external view returns (address[] memory);

    /**
     * @dev Checks if an account is configured as a wallet owner.
     */
    function isOwner(address account) external view returns (bool);

    /**
     * @dev Returns the number of approvals required to execute a transaction.
     */
    function requiredApprovals() external view returns (uint256);

    /**
     * @dev Returns the total number of transactions in the wallet.
     */
    function transactionCount() external view returns (uint256);

    /**
     * @dev Returns the configured expiration time.
     */
    function expirationTime() external view returns (uint120);

    /**
     * @dev Returns the configured cooldown time.
     */
    function cooldownTime() external view returns (uint120);
}
