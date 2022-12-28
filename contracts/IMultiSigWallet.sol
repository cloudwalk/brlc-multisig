// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

/**
 * @title MultiSigWallet types interface
 * @author CloudWalk Inc.
 */
interface IMultiSigWalletTypes {
    /// @dev Structure with data of a single transaction.
    struct Transaction {
        address to;     // The address of the transaction receiver.
        uint256 value;  // The value in native tokens to be sent along with the transaction.
        bytes data;     // The data to be sent along with the transaction.
        bool executed;  // The execution status of the transaction.
    }
}

/**
 * @title MultiSigWallet interface
 * @author CloudWalk Inc.
 * @dev The interface of the multisignature wallet contract.
 */
interface IMultiSigWallet is IMultiSigWalletTypes {
    // -------------------- Events -----------------------------------

    /**
     * @dev Emitted when native tokens are deposited to the contract.
     * @param sender The address of the native token sender.
     * @param amount The amount of deposited native tokens.
     */
    event Deposit(address indexed sender, uint256 amount);

    /**
     * @dev Emitted when a transaction is submitted.
     * @param txId The id of the submitted transaction.
     */
    event Submit(uint256 indexed txId);

    /**
     * @dev Emitted when a transaction is approved.
     * @param owner The address that approved the transaction.
     * @param txId The id of the transaction that is approved.
     */
    event Approve(address indexed owner, uint256 indexed txId);

    /**
     * @dev Emitted when a transaction approval is revoked.
     * @param owner The address that revoked the transaction approval.
     * @param txId The id of the transaction whose approval is revoked.
     */
    event Revoke(address indexed owner, uint256 indexed txId);

    /**
     * @dev Emitted when a transaction is executed.
     * @param txId The id of the executed transaction.
     */
    event Execute(uint256 indexed txId);

    /**
     * @dev Emitted when a wallet owners and required approvals amount are changed.
     * @param newOwners The array of addresses that became wallet owners.
     * @param newRequiredApprovals The new amount of approvals required to execute a transaction.
     */
    event Configure(address[] newOwners, uint256 newRequiredApprovals);

    // -------------------- Functions --------------------------------

    /**
     * @dev Submits a new transaction.
     *
     * Emits a {Submit} event.
     *
     * @param receiver The address of the transaction receiver.
     * @param txValue The value of the transaction in native tokens.
     * @param txData The data of the transaction.
     */
    function submit(
        address receiver,
        uint256 txValue,
        bytes calldata txData
    ) external;

    /**
     * @dev Submits and approves a new transaction.
     *
     * Emits a {Submit} event.
     * Emits an {Approve} event.
     *
     * @param receiver The address of the transaction receiver.
     * @param txValue The value of the transaction in native tokens.
     * @param txData The data of the transaction.
     */
    function submitAndApprove(
        address receiver,
        uint256 txValue,
        bytes calldata txData
    ) external;

    /**
     * @dev Approves a previously submitted transaction.
     *
     * Emits an {Approve} event.
     *
     * @param txId The id of the transaction to approve.
     */
    function approve(uint256 txId) external;

    /**
     * @dev Approves and executes a previously submitted transaction.
     *
     * Emits an {Approve} event.
     * Emits an {Execute} event.
     *
     * @param txId The id of the transaction to approve and execute.
     */
    function approveAndExecute(uint256 txId) external;

    /**
     * @dev Executes a previously submitted transaction by calling its destination address.
     *
     * Emits an {Execute} event.
     *
     * @param txId The id of the transaction to execute.
     */
    function execute(uint256 txId) external;

    /**
     * @dev Revokes the approved status of a transaction previously granted by the caller.
     *
     * Emits a {Revoke} event.
     *
     * @param txId The id of the transaction to revoke the approval.
     */
    function revoke(uint256 txId) external;

    /**
     * @dev Sets wallet owners and amount of required approvals.
     *
     * Emits a {NewWalletParamaters} event.
     *
     * @param newOwners The array of addresses to become wallet owners.
     * @param newRequiredApprovals The amount of approvals needed to execute a transaction.
     */
    function configure(address[] memory newOwners, uint256 newRequiredApprovals) external;

    /**
     * @dev Checks if a transaction is approved by a wallet owner.
     * @param txId The id of the transaction to check.
     * @param owner The address of the wallet owner to check.
     * @return True if the transaction is approved.
     */
    function getApproval(uint256 txId, address owner) external view returns (bool);

    /**
     * @dev Returns the number of approvals for a transaction.
     * @param txId The id of the transaction to check.
     */
    function getApprovalCount(uint256 txId) external view returns (uint256);

    /**
     * @dev Returns an array of wallet owners.
     */
    function owners() external view returns (address[] memory);

    /**
     * @dev Returns the minimum count of approvals required to execute a transaction.
     */
    function requiredApprovals() external view returns (uint256);

    /**
     * @dev Returns an array of submitted transactions.
     * @param txId The id of the first transaction in the range to return.
     * @param limit The maximum number of transactions in the range to return.
     */
    function getTransactions(uint256 txId, uint256 limit)
        external
        view
        returns (Transaction[] memory resultTransactions);

    /**
     * @dev Returns the details of a transaction.
     * @param txId The id of the transaction to return.
     */
    function getTransaction(uint256 txId) external view returns (Transaction memory);

    /**
     * @dev Returns the length of the array of submitted transactions.
     */
    function transactionCount() external view returns (uint256);
}
