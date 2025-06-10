# Multi-signature wallet

BRLC-multisig is a multi-signature wallet used to ensure the decentralization and security of any processes performed through interaction with smart contracts. Only owners of the multi-signature wallet can submit, approve, execute and revoke transactions. All transactions have a cooldown period and expiration time. Transactions cannot be executed before the end of the cooldown period and cannot be executed after the expiration. The default cooldown period is zero seconds. The default expiration time is 10 days. Both values can be changed after the multi-signature wallet is deployed.

<hr>

# Smart contracts

[IMultiSigWallet](../contracts/base/IMultiSigWallet.sol) - An interface of multi-signature wallet contracts.

[MultiSigWalletBase](../contracts/base/MultiSigWalletBase.sol) - An abstract contract that contains the core logic for transactions processing and wallet configuration. This contract is used through inheritance as a base contract for upgradeable and non-upgradeable versions of the multi-signature wallet.

[MultiSigWalletStorage](../contracts/base/MultiSigWalletStorage.sol) - A storage contract with all the variables used by a multi-signature wallet. It is divided into different file versions. When we need to add new storage variables, we create a new version of the MultiSigWalletStorage contract.

[MultiSigWalletUpgradeable](../contracts/MultiSigWalletUpgradeable.sol) - Upgradeable version of multi-signature wallet. Inherited from MultiSigWalletBase contract and initialized with OpenZeppelin initialize function.

[MultiSigWallet](../contracts/MultiSigWallet.sol) - Non-upgradeable version of multi-signature wallet, inherited from `MultiSigWalletBase` contract and initialized with a constructor.

[MultiSigWalletFactory](../contracts/MultiSigWalletFactory.sol) - The factory contract used to deploy new non-upgradeable multi-signature wallets.

<hr>

# Functionality

### [`MultiSigWalletBase.sol`](../contracts/base/MultiSigWalletBase.sol)

Function `submit` - submits a new transaction and adds it to transactions array. Emits a `Submit` event. Can be called only by the owner.

Function `submitAndApprove` - submits a new transaction and adds it to transactions array. Emits a `Submit` event. Approves submitted transaction. Emits an `Approve` event. Can be called only by the owner.

<ul>
    <li>Reverts if the selected transaction does not exist.</li>
    <li>Reverts if the selected transaction is expired.</li>
    <li>Reverts if the selected transaction is executed.</li>
    <li>Reverts if the selected transaction is already approved by the caller.</li>
</ul>

Function `approve` - approves selected transaction. Emits an `Approve` event. Can be called only by the owner.

<ul>
    <li>Reverts if the selected transaction does not exist.</li>
    <li>Reverts if the selected transaction is expired.</li>
    <li>Reverts if the selected transaction is executed.</li>
    <li>Reverts if the selected transaction is already approved by the caller.</li>
</ul>

Function `approveBatch` - approves multiple selected transactions. Emits an `Approve` event for each transaction. Can be called only by the owner.

<ul>
    <li>Reverts if any of the selected transactions do not exist.</li>
    <li>Reverts if any of the selected transactions are expired.</li>
    <li>Reverts if any of the selected transactions are executed.</li>
    <li>Reverts if any of the selected transactions are already approved by the caller.</li>
</ul>

Function `approveAndExecute` - approves and executes the selected transaction. Emits an `Approve` event. Executes transaction. Emits an `Execute` event. Can be called only by the owner.

<ul>
    <li>Reverts if the selected transaction does not exist.</li>
    <li>Reverts if the selected transaction is expired.</li>
    <li>Reverts if the selected transaction is executed.</li>
    <li>Reverts if the selected transaction is already approved by the caller.</li>
    <li>Reverts if the selected transaction is on cooldown.</li>
    <li>Reverts if the approvals amount is less than the amount of required approvals minus one.</li>
</ul>

Function `approveAndExecuteBatch` - approves and executes multiple selected transactions. Emits `Approve` and `Execute` events for each transaction. Can be called only by the owner.

<ul>
    <li>Reverts if any of the selected transactions do not exist.</li>
    <li>Reverts if any of the selected transactions are expired.</li>
    <li>Reverts if any of the selected transactions are executed.</li>
    <li>Reverts if any of the selected transactions are already approved by the caller.</li>
    <li>Reverts if any of the selected transactions are on cooldown.</li>
    <li>Reverts if the approvals amount for any transaction is less than the amount of required approvals minus one.</li>
</ul>

Function `execute` - executes the selected transaction. Emits an `Execute` event. Can be called only by the owner. Allows repeating execution attempt if previous execution failed. Owners are able to choose the order of the execution of approved transactions.

<ul>
    <li>Reverts if the selected transaction does not exist.</li>
    <li>Reverts if the selected transaction is expired.</li>
    <li>Reverts if the selected transaction is executed.</li>
    <li>Reverts if the selected transaction is on cooldown.</li>
    <li>Reverts if the approvals amount is less than the amount of required approvals.</li>
    <li>Reverts if the transaction execution fails.</li>
</ul>

Function `revoke` - revokes approval from the selected transaction. Emits a `Revoke` event. Can be called only by the owner.

<ul>
    <li>Reverts if the selected transaction does not exist.</li>
    <li>Reverts if the selected transaction is expired.</li>
    <li>Reverts if the selected transaction is executed.</li>
    <li>Reverts if the selected transaction is not approved by the caller.</li>
</ul>

Function `configureOwners` - changes owners array and amount of required approvals. Emits a `ConfigureOwners` event. Function execution does not change the state of submitted transactions; the amount of approvals made by previous owners will stay the same.

<ul>
    <li>Reverts if the caller is not the multi-signature wallet itself.</li>
    <li>Reverts if the array of owners is empty.</li>
    <li>Reverts if one of the owners is zero address.</li>
    <li>Reverts if the owner address is duplicated.</li>
    <li>Reverts if the number of required approvals is bigger than the amount of owners.</li>
    <li>Reverts if the number of required approvals is zero.</li>
</ul>

Function `configureExpirationTime` - changes default expiration time of transactions. Emits a `ConfigureExpirationTime` event. Must be at least 60 minutes.

<ul>
    <li>Reverts if the caller is not the multi-signature wallet itself.</li>
    <li>Reverts if the passed expiration time is less than the minimum allowed (60 minutes)</li>
</ul>

Function `configureCooldownTime` - changes default cooldown time of transactions. Emits a `ConfigureCooldownTime` event.

<ul>
    <li>Reverts if the caller is not the multi-signature wallet itself.</li>
</ul>

### [`MultiSigWallet.sol`](../contracts/MultiSigWallet.sol)

`constructor` - sets the owners of the multi-signature wallet, number of required approvals and the expiration time (10 days by default).

<ul>
    <li>Reverts if the array of owners is empty.</li>
    <li>Reverts if one of the owners is zero address.</li>
    <li>Reverts if the owner address is duplicated.</li>
    <li>Reverts if the number of required approvals is bigger than the amount of owners.</li>
    <li>Reverts if the number of required approvals is zero.</li>
</ul>

### [`MultiSigWalletUpgradeable.sol`](../contracts/MultiSigWalletUpgradeable.sol)

Function `initialize` - initializes the contract with the selected parameters. Sets the owners of the multi-signature wallet, number of required approvals and the expiration time (10 days by default).

<ul>
    <li>Reverts if the array of owners is empty.</li>
    <li>Reverts if one of the owners is zero address.</li>
    <li>Reverts if the owner address is duplicated.</li>
    <li>Reverts if the number of required approvals is bigger than the amount of owners.</li>
    <li>Reverts if the number of required approvals is zero.</li>
</ul>

### [`MultiSigWalletFactory.sol`](../contracts/MultiSigWalletFactory.sol)

Function `deployNewWallet` - creates new non-upgradeable instance of multi-signature wallet. Emits a `NewWallet` event.

<ul>
    <li>Reverts if the array of owners is empty.</li>
    <li>Reverts if one of the owners is zero address.</li>
    <li>Reverts if the owner address is duplicated.</li>
    <li>Reverts if the number of required approvals is zero.</li>
    <li>Reverts if the number of required approvals is bigger than the amount of owners.</li>
</ul>

Function `walletsCount` - returns the number of deployed wallets.
