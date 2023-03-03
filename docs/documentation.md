# Multisig wallet

BRLC-multisig is a multi-signature wallet used to ensure the decentralization and security of any processes performed through interaction with smart contracts. Only owners of the multisig wallet can submit, approve, execute and revoke transactions. All transactions have a cooldown period and expiration time. Transactions cannot be executed before the end of the cooldown period and cannot be executed after the expiration. The default cooldown period is zero seconds. The default expiration time is 365 days. Both values can be changed after multisig is deployed.

<hr>

# Smart contracts

[IMultiSigWallet](../contracts//base//IMultiSigWallet.sol) - An interface of multisig wallet contracts.

[MultiSigWalletBase](../contracts/base/MultiSigWalletBase.sol) - An abstract contract that contains the core logic for transactions processing and wallet configuration. This contract is used through inheritance as a base contract for upgradable and non-upgradable versions of the multisig wallet.

[MultisigWalletStorage](../contracts/base/MultiSigWalletStorage.sol) A storage contract with all the variables used by a multisig wallet. It is divided into different file versions. When we need to add new storage variables, we create a new version of the MultiSigWalletStorage contract.

[MultiSigWalletUpgradeable](../contracts/MultiSigWalletUpgradeable.sol) - Upgradeable version of multisig wallet. Inherited from MultiSigWalletBase contract and initialized with OpenZeppelin initialize function.

[MultiSigWallet](../contracts/MultiSigWallet.sol) - Non-upgradeable version of multisig wallet, inherited from MultisigWalletBase contract and initialized with a constructor.

[MultiSigWalletFactory](../contracts//MultiSigWalletFactory.sol) - The factory contract used to deploy new multisig wallets.

<hr>

# Functionality

### [```MultiSigWalletBase.sol```](../contracts/base/MultiSigWalletBase.sol)

Function `submit` - submits new transaction and adds it to transactions array. Emits a `Submit` event. Can be called only by the owner.

Function `submitAndApprove` - submits new transaction and adds it to transactions array. Emits a `Submit` event. Approves submitted transaction. Emits an `Approve` event. Should be called only by the owner.
<ul>
    <li>Should be reverted if the selected transaction does not exist.</li>
    <li>Should be reverted if the selected transaction is expired.</li>
    <li>Should be reverted if the selected transaction is executed.</li>
    <li>Should be reverted if the selected transaction is already approved by the caller.</li>
</ul>

Function `approve` - approves selected transaction. Emits an `Approve` event. Should be called only by the owner.
<ul>
    <li>Should be reverted if the selected transaction does not exist.</li>
    <li>Should be reverted if the selected transaction is expired.</li>
    <li>Should be reverted if the selected transaction is executed.</li>
    <li>Should be reverted if the selected transaction is already approved by the caller.</li>
</ul>

Function `approveAndExecute` - approves and executes the selected transaction. Emits an `Approve` event. Executes transaction. Emits an `Execute` event. Should be called only by the owner.
<ul>
    <li>Should be reverted if the selected transaction does not exist.</li>
    <li>Should be reverted if the selected transaction is expired.</li>
    <li>Should be reverted if the selected transaction is executed.</li>
    <li>Should be reverted if the selected transaction is already approved by the caller.</li>
    <li>Should be reverted if the selected transaction is executed.</li>
    <li>Should be reverted if the selected transaction is on cooldown.</li>
    <li>Should be reverted if the approvals amount is less than the amount of required approvals.</li>
</ul>

Function `execute` - executes the selected transaction. Emits an `Execute` event. Should be called only by the owner.
<ul>
    <li>Should be reverted if the selected transaction does not exist.</li>
    <li>Should be reverted if the selected transaction is expired.</li>
    <li>Should be reverted if the selected transaction is executed.</li>
    <li>Should be reverted if the selected transaction is on cooldown.</li>
    <li>Should be reverted if the approvals amount is less than the amount of required approvals.</li>
    <li>Should be reverted if the transaction execution fails.</li>
</ul>

Function `revoke` - revokes approval from the selected transaction. Emits a `Revoke` event. Should be called only by the owner.
<ul>
    <li>Should be reverted if the selected transaction does not exist.</li>
    <li>Should be reverted if the selected transaction is expired.</li>
    <li>Should be reverted if the selected transaction is executed.</li>
    <li>Should be reverted if the selected transaction is not approved by the caller.</li>
</ul>

Function `configureOwners` - changes owners array and amount of required approvals. Emits a `ConfigureOwners` event.
<ul>
    <li>Should be reverted if the caller is not a multisig itself.</li>
    <li>Should be reverted if the array of owners is empty.</li>
    <li>Should be reverted if one of the owners is zero address.</li>
    <li>Should be reverted if the owner address is duplicated.</li>
    <li>Should be reverted if the number of required approvals is bigger than the amount of owners.</li>
    <li>Should be reverted if the number of required approvals is zero.</li>
</ul>

Function `configureExpirationTime` - changes default expiration time of transactions. Emits a `ConfigureExpirationTime` event.
<ul>
    <li>Should be reverted if the caller is not a multisig itself.</li>
</ul>


Function `configureCooldownTime` - changes default cooldown time of transactions. Emits a `ConfigureCooldownTime` event.
<ul>
    <li>Should be reverted if the caller is not a multisig itself.</li>
</ul>


### [```MultiSigWallet.sol```](../contracts//MultiSigWallet.sol)

`constructor` - sets the owners of the multisig, number of required approvals and the expiration time (365 days by default).
<ul>
    <li>Should be reverted if the array of owners is empty.</li>
    <li>Should be reverted if one of the owners is zero address.</li>
    <li>Should be reverted if the owner address is duplicated.</li>
    <li>Should be reverted if the number of required approvals is bigger than the amount of owners.</li>
    <li>Should be reverted if the number of required approvals is zero.</li>
</ul>

### [```MultiSigWalletUpgradeable.sol```](../contracts//MultiSigWalletUpgradeable.sol)

Function `initialize` - initializes the contract with the selected parameters. Sets the owners of the multisig, number of required approvals and the expiration time (365 days by default).
<ul>
    <li>Should be reverted if the array of owners is empty.</li>
    <li>Should be reverted if one of the owners is zero address.</li>
    <li>Should be reverted if the owner address is duplicated.</li>
    <li>Should be reverted if the number of required approvals is bigger than the amount of owners.</li>
    <li>Should be reverted if the number of required approvals is zero.</li>
    <li>Should be reverted if the number of required approvals is zero.</li>
    <li>Ownership of the ProxyAdmin contract will be transferred to the wallet itself, so the upgrade will be possible only after the transaction is approved by owners.</li>
</ul>


### [```MultiSigWalletFactory.sol```](../contracts//MultiSigWalletFactory.sol)

Function `deployNewWallet` - creates new non-upgradeable instance of multisig wallet. Emits a `NewWallet` event.
<ul>
    <li>Should be reverted if the array of owners is empty.</li>
    <li>Should be reverted if one of the owners is zero address.</li>
    <li>Should be reverted if the owner address is duplicated.</li>
    <li>Should be reverted if the number of required approvals is zero.</li>
    <li>Should be reverted if the number of required approvals is bigger than the amount of owners.</li>
</ul>
