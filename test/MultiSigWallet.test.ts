import { ethers, network, upgrades } from "hardhat";
import { expect } from "chai";
import { Contract, ContractFactory } from "ethers";
import { TransactionResponse } from "@ethersproject/abstract-provider";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { proveTx } from "../test-utils/eth";

interface TestTx {
  id: number;
  to: string;
  value: number;
  data: string;
  executed?: boolean;
}

function checkTxEquality(actualOnChainTx: TestTx, expectedTx: TestTx) {
  expect(actualOnChainTx.to).to.equal(expectedTx.to, `tx[${expectedTx.id}].to is incorrect`);
  expect(actualOnChainTx.value).to.equal(expectedTx.value, `tx[${expectedTx.id}].value is incorrect`);
  expect(actualOnChainTx.data).to.equal(expectedTx.data, `tx[${expectedTx.id}].data is incorrect`);
  expect(actualOnChainTx.executed).to.equal(!!expectedTx.executed, `tx[${expectedTx.id}].executed is incorrect`);
}

function checkTxArrayEquality(actualOnChainTxs: TestTx[], expectedTxs: TestTx[]) {
  expect(actualOnChainTxs.length).to.eq(expectedTxs.length);
  for (let i = 0; i < expectedTxs.length; ++i) {
    checkTxEquality(actualOnChainTxs[i], expectedTxs[i]);
  }
}

async function setUpFixture<T>(func: () => Promise<T>): Promise<T> {
  if (network.name === "hardhat") {
    return loadFixture(func);
  } else {
    return func();
  }
}

describe("MultiSigWallet contract", () => {
  const REQUIRED_APPROVALS = 2;
  const ONE_MINUTE = 60;
  const TWO_HOURS = 7200;
  const ONE_DAY = 3600 * 24;
  const ONE_YEAR = 3600 * 24 * 365;

  const ADDRESS_STUB = "0x0000000000000000000000000000000000000001";
  const ADDRESS_STUB2 = "0x0000000000000000000000000000000000000002";
  const TX_VALUE_STUB = 123;
  const TX_DATA_STUB = ethers.utils.hexlify(ethers.utils.toUtf8Bytes("Some data"));
  const TX_DATA_STUB2 = ethers.utils.hexlify(ethers.utils.toUtf8Bytes("Some data 2"));
  const DEFAULT_ERROR_DATA = "0x";

  const EVENT_NAME_APPROVE = "Approve";
  const EVENT_NAME_DEPOSIT = "Deposit";
  const EVENT_NAME_EXECUTE = "Execute";
  const EVENT_NAME_REVOKE = "Revoke";
  const EVENT_NAME_SUBMIT = "Submit";
  const EVENT_NAME_TEST = "TestEvent";
  const EVENT_NAME_CONFIGURE_OWNERS = "ConfigureOwners";
  const EVENT_NAME_CONFIGURE_COOLDOWN_TIME = "ConfigureCooldownTime";
  const EVENT_NAME_CONFIGURE_EXPIRATION_TIME = "ConfigureExpirationTime";

  const REVERT_ERROR_IF_UNAUTHORIZED_CALLER = "UnauthorizedCaller";
  const REVERT_ERROR_IF_DUPLICATE_OWNER_ADDRESS = "DuplicateOwnerAddress";
  const REVERT_ERROR_IF_EMPTY_OWNERS_ARRAY = "EmptyOwnersArray";
  const REVERT_ERROR_IF_INVALID_REQUIRED_APPROVALS = "InvalidRequiredApprovals";
  const REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED = "InternalTransactionFailed";
  const REVERT_ERROR_IF_TRANSACTION_DOES_NOT_EXIST = "TransactionNotExist";
  const REVERT_ERROR_IF_TRANSACTION_HAS_NOT_ENOUGH_APPROVALS = "NotEnoughApprovals";
  const REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_APPROVED = "TransactionAlreadyApproved";
  const REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_EXECUTED = "TransactionAlreadyExecuted";
  const REVERT_ERROR_IF_TRANSACTION_IS_NOT_APPROVED = "TransactionNotApproved";
  const REVERT_ERROR_IF_ZERO_OWNER_ADDRESS = "ZeroOwnerAddress";
  const REVERT_ERROR_IF_TRANSACTION_ON_COOLDOWN = "CooldownNotEnded";
  const REVERT_ERROR_IF_TRANSACTION_EXPIRED = "TransactionExpired";

  let tokenFactory: ContractFactory;
  let walletUpgradeableFactory: ContractFactory;
  let walletFactory: ContractFactory;

  let owner1: SignerWithAddress;
  let owner2: SignerWithAddress;
  let owner3: SignerWithAddress;
  let user: SignerWithAddress;

  let ownerAddresses: string[];

  before(async () => {
    [, owner1, owner2, owner3, user] = await ethers.getSigners();
    ownerAddresses = [owner1.address, owner2.address, owner3.address];
    walletUpgradeableFactory = await ethers.getContractFactory("MultiSigWalletUpgradeable");
    walletFactory = await ethers.getContractFactory("MultiSigWallet");
    tokenFactory = await ethers.getContractFactory("TestContractMock");
  });

  async function checkOwnership(
    wallet: Contract,
    options: { ownerAddresses: string[]; expectedOwnershipStatus: boolean }
  ) {
    for (let i = 0; i < options.ownerAddresses.length; ++i) {
      const address = options.ownerAddresses[i];
      expect(await wallet.isOwner(address)).to.eq(
        options.expectedOwnershipStatus,
        `Wrong ownership status for address: ${address}`
      );
    }
  }

  function encodeConfigureOwnersFunctionData(ownerAddresses: string[], requiredApprovals: number): string {
    return walletUpgradeableFactory.interface.encodeFunctionData(
      "configureOwners",
      [ownerAddresses, requiredApprovals]
    );
  }

  function encodeConfigureCooldownTimeFunctionData(cooldownTime: number): string {
    return walletUpgradeableFactory.interface.encodeFunctionData(
      "configureCooldownTime",
      [cooldownTime]
    );
  }

  function encodeConfigureExpirationTimeTimeFunctionData(expirationTime: number): string {
    return walletUpgradeableFactory.interface.encodeFunctionData(
      "configureExpirationTime",
      [expirationTime]
    );
  }

  async function deployTestContractMock(): Promise<{
    testContractMock: Contract;
  }> {
    const testContractMock = await tokenFactory.deploy();
    await testContractMock.deployed();

    return {
      testContractMock
    };
  }

  async function deployWalletUpgradeable(): Promise<{ wallet: Contract }> {
    const wallet = await upgrades.deployProxy(walletUpgradeableFactory, [ownerAddresses, REQUIRED_APPROVALS]);
    await wallet.deployed();

    return {
      wallet
    };
  }

  async function deployWallet(): Promise<{ wallet: Contract }> {
    const wallet = await walletFactory.deploy(ownerAddresses, REQUIRED_APPROVALS);
    await wallet.deployed();
    return {
      wallet
    };
  }

  async function deployAllContracts(): Promise<{
    wallet: Contract;
    testContractMock: Contract;
  }> {
    const { wallet } = await deployWalletUpgradeable();
    const { testContractMock } = await deployTestContractMock();

    return {
      wallet,
      testContractMock
    };
  }

  describe("Contract 'MultiSigWallet'", async () => {
    it("Constructor configures wallet as expected", async () => {
      const { wallet } = await setUpFixture(deployWallet);

      expect(await wallet.owners()).to.deep.eq(ownerAddresses);
      expect(await wallet.requiredApprovals()).to.eq(REQUIRED_APPROVALS);
      expect(await wallet.transactionCount()).to.eq(0);
      expect(await wallet.cooldownTime()).to.eq(0);
      expect(await wallet.expirationTime()).to.eq(ONE_YEAR);
      await checkOwnership(wallet, {
        ownerAddresses,
        expectedOwnershipStatus: true
      });
    });

    it("Deployment is reverted if the input owner array is empty", async () => {
      await expect(
        walletFactory.deploy([], REQUIRED_APPROVALS)
      ).to.be.revertedWithCustomError(walletFactory, REVERT_ERROR_IF_EMPTY_OWNERS_ARRAY);
    });

    it("Deployment is reverted if the input number of required approvals is zero", async () => {
      const requiredApprovals = 0;
      await expect(
        walletFactory.deploy(ownerAddresses, requiredApprovals)
      ).to.be.revertedWithCustomError(walletFactory, REVERT_ERROR_IF_INVALID_REQUIRED_APPROVALS);
    });

    it("Deployment is reverted if the number of required approvals exceeds the length of the owner array", async () => {
      const requiredApprovals = ownerAddresses.length + 1;
      await expect(
        walletFactory.deploy(ownerAddresses, requiredApprovals)
      ).to.be.revertedWithCustomError(walletFactory, REVERT_ERROR_IF_INVALID_REQUIRED_APPROVALS);
    });

    it("Deployment is reverted if one of the input owners is the zero address", async () => {
      const ownerAddressArray = [ownerAddresses[0], ownerAddresses[1], ethers.constants.AddressZero];
      const requiredApprovals = ownerAddressArray.length - 1;
      await expect(
        walletFactory.deploy(ownerAddressArray, requiredApprovals)
      ).to.be.revertedWithCustomError(walletFactory, REVERT_ERROR_IF_ZERO_OWNER_ADDRESS);
    });

    it("Deployment is reverted if there is a duplicate address in the input owner array", async () => {
      const ownerAddressArray = [ownerAddresses[0], ownerAddresses[1], ownerAddresses[0]];
      const requiredApprovals = ownerAddresses.length - 1;
      await expect(
        walletFactory.deploy(ownerAddressArray, requiredApprovals)
      ).to.be.revertedWithCustomError(walletFactory, REVERT_ERROR_IF_DUPLICATE_OWNER_ADDRESS);
    });
  });

  describe("Contract 'MultiSigWalletBase'", () => {
    describe("Function 'configureOwners()'", () => {
      it("Updates list of owners and removes old owners", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const newOwnerAddresses = [owner1.address, owner2.address, user.address];
        const txData = encodeConfigureOwnersFunctionData(newOwnerAddresses, REQUIRED_APPROVALS + 1);

        await proveTx(wallet.connect(owner1).submitAndApprove(wallet.address, 0, txData));
        // Check that transaction is successful and event is emitted
        await expect(wallet.connect(owner2).approveAndExecute(0))
          .to.emit(wallet, EVENT_NAME_CONFIGURE_OWNERS)
          .withArgs(newOwnerAddresses, REQUIRED_APPROVALS + 1);
        // Check that owners array is updated.
        expect(await wallet.owners()).to.deep.eq(newOwnerAddresses);

        // Check statuses of owners
        await checkOwnership(wallet, {
          ownerAddresses: newOwnerAddresses,
          expectedOwnershipStatus: true
        });
        await checkOwnership(wallet, {
          ownerAddresses: [owner3.address],
          expectedOwnershipStatus: false
        });
      });

      it("Is reverted if the caller is not the multi sig wallet itself", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.configureOwners([], REQUIRED_APPROVALS)
        ).to.be.revertedWithCustomError(wallet, REVERT_ERROR_IF_UNAUTHORIZED_CALLER);
      });

      it("Is reverted if the input owner array is empty", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const txData = encodeConfigureOwnersFunctionData([], REQUIRED_APPROVALS);

        await proveTx(wallet.connect(owner1).submitAndApprove(wallet.address, 0, txData));
        await expect(wallet.connect(owner2).approveAndExecute(0))
          .to.be.revertedWithCustomError(wallet, REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED)
          .withArgs(wallet.interface.encodeErrorResult(REVERT_ERROR_IF_EMPTY_OWNERS_ARRAY));
      });

      it("Is reverted if the input number of required approvals is zero", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const invalidApprovals = 0;
        const txData = encodeConfigureOwnersFunctionData(ownerAddresses, invalidApprovals);

        await proveTx(wallet.connect(owner1).submitAndApprove(wallet.address, 0, txData));
        await expect(wallet.connect(owner2).approveAndExecute(0))
          .to.be.revertedWithCustomError(wallet, REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED)
          .withArgs(wallet.interface.encodeErrorResult(REVERT_ERROR_IF_INVALID_REQUIRED_APPROVALS));
      });

      it("Is reverted if the number of required approvals exceeds the length of the owner array", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const invalidApprovals = ownerAddresses.length + 1;
        const txData = encodeConfigureOwnersFunctionData(ownerAddresses, invalidApprovals);

        await proveTx(wallet.connect(owner1).submitAndApprove(wallet.address, 0, txData));
        await expect(wallet.connect(owner2).approveAndExecute(0))
          .to.be.revertedWithCustomError(wallet, REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED)
          .withArgs(wallet.interface.encodeErrorResult(REVERT_ERROR_IF_INVALID_REQUIRED_APPROVALS));
      });

      it("Is reverted if one of the input owners is the zero address", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const invalidAddresses: string[] = [ownerAddresses[0], ownerAddresses[1], ethers.constants.AddressZero];
        const txData = encodeConfigureOwnersFunctionData(invalidAddresses, REQUIRED_APPROVALS);

        await proveTx(wallet.connect(owner1).submitAndApprove(wallet.address, 0, txData));
        await expect(wallet.connect(owner2).approveAndExecute(0))
          .to.be.revertedWithCustomError(wallet, REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED)
          .withArgs(wallet.interface.encodeErrorResult(REVERT_ERROR_IF_ZERO_OWNER_ADDRESS));
      });

      it("Is reverted if there is a duplicate address in the input owner array", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const invalidAddress = [ownerAddresses[0], ownerAddresses[1], ownerAddresses[0]];
        const txData = encodeConfigureOwnersFunctionData(invalidAddress, REQUIRED_APPROVALS);

        await proveTx(wallet.connect(owner1).submitAndApprove(wallet.address, 0, txData));
        await expect(wallet.connect(owner2).approveAndExecute(0))
          .to.be.revertedWithCustomError(wallet, REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED)
          .withArgs(wallet.interface.encodeErrorResult(REVERT_ERROR_IF_DUPLICATE_OWNER_ADDRESS));
      });
    });

    describe("Function 'configureCooldownTime()'", () => {
      it("Correctly changes the transaction cooldown time", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const txData = encodeConfigureCooldownTimeFunctionData(TWO_HOURS);

        await proveTx(wallet.connect(owner1).submitAndApprove(wallet.address, 0, txData));
        await expect(wallet.connect(owner2).approveAndExecute(0))
          .to.emit(wallet, EVENT_NAME_CONFIGURE_COOLDOWN_TIME)
          .withArgs(TWO_HOURS);

        expect(await wallet.cooldownTime()).to.eq(TWO_HOURS);
      });

      it("Is reverted if the caller is not the multi sig wallet itself", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.configureCooldownTime(ONE_MINUTE)
        ).to.be.revertedWithCustomError(wallet, REVERT_ERROR_IF_UNAUTHORIZED_CALLER);
      });
    });

    describe("Function 'configureExpirationTime()'", () => {
      it("Correctly changes the transaction expiration time", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const txData = encodeConfigureExpirationTimeTimeFunctionData(ONE_YEAR);

        await proveTx(wallet.connect(owner1).submitAndApprove(wallet.address, 0, txData));
        await expect(wallet.connect(owner2).approveAndExecute(0))
          .to.emit(wallet, EVENT_NAME_CONFIGURE_EXPIRATION_TIME)
          .withArgs(ONE_YEAR);

        expect(await wallet.expirationTime()).to.eq(ONE_YEAR);
      });

      it("Is reverted if the caller is not the multi sig wallet itself", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.configureExpirationTime(ONE_MINUTE)
        ).to.be.revertedWithCustomError(wallet, REVERT_ERROR_IF_UNAUTHORIZED_CALLER);
      });

      it("Is reverted if passed expiration time is less than minimal allowed", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const txData = encodeConfigureExpirationTimeTimeFunctionData(ONE_MINUTE);

        await proveTx(wallet.connect(owner1).submitAndApprove(wallet.address, 0, txData));
        await expect(
          wallet.connect(owner2).approveAndExecute(0)
        ).to.be.revertedWithCustomError(wallet, REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED);
      });
    });

    describe("Function 'receive()'", () => {
      describe("Executes as expected and emits the correct event when it is called indirectly with", () => {
        async function checkExecutionOfReceive(params: { value: number }) {
          const { wallet } = await setUpFixture(deployWallet);

          const txResponse = await user.sendTransaction({
            to: wallet.address,
            value: params.value
          });

          await expect(txResponse)
            .to.emit(wallet, EVENT_NAME_DEPOSIT)
            .withArgs(user.address, params.value);
          await expect(txResponse).to.changeEtherBalances(
            [wallet, user],
            [+params.value, -params.value]
          );
        }

        it("A nonzero value", async () => {
          await checkExecutionOfReceive({ value: TX_VALUE_STUB });
        });

        it("The zero value", async () => {
          await checkExecutionOfReceive({ value: 0 });
        });
      });
    });

    describe("Function 'submit()'", () => {
      const tx: TestTx = {
        id: 0,
        to: ADDRESS_STUB,
        value: TX_VALUE_STUB,
        data: TX_DATA_STUB
      };

      it("Executes as expected and emits the correct event", async () => {
        const { wallet } = await setUpFixture(deployWallet);

        await expect(wallet.connect(owner1).submit(tx.to, tx.value, tx.data))
          .to.emit(wallet, EVENT_NAME_SUBMIT)
          .withArgs(owner1.address, tx.id);

        const actualTx = await wallet.getTransaction(tx.id);
        checkTxEquality(actualTx, tx);
        expect(await wallet.transactionCount()).to.eq(1);
      });

      it("Is reverted if it is called not by an owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.submit(tx.to, tx.value, tx.data)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_UNAUTHORIZED_CALLER);
      });
    });

    describe("Function 'submitAndApprove()'", () => {
      const tx: TestTx = {
        id: 0,
        to: ADDRESS_STUB,
        value: TX_VALUE_STUB,
        data: TX_DATA_STUB
      };

      it("Executes as expected and emits the correct events", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const txResponse: TransactionResponse = wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data);

        await expect(txResponse).to.emit(wallet, EVENT_NAME_SUBMIT).withArgs(owner1.address, tx.id);
        await expect(txResponse).to.emit(wallet, EVENT_NAME_APPROVE).withArgs(owner1.address, tx.id);

        const actualTx = await wallet.getTransaction(tx.id);
        checkTxEquality(actualTx, tx);
        expect(await wallet.transactionCount()).to.eq(1);
        expect(await wallet.getApprovalStatus(tx.id, owner1.address)).to.eq(true);
      });

      it("Is reverted if it is called not by an owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.submitAndApprove(tx.to, tx.value, tx.data)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_UNAUTHORIZED_CALLER);
      });
    });

    describe("Function 'approve()'", () => {
      const tx: TestTx = {
        id: 0,
        to: ADDRESS_STUB,
        value: 0,
        data: TX_DATA_STUB
      };

      it("Executes as expected and emits the correct event", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(wallet.connect(owner1).submit(tx.to, tx.value, tx.data));
        expect(await wallet.getApprovalCount(tx.id)).to.eq(0);

        await expect(wallet.connect(owner1).approve(tx.id))
          .to.emit(wallet, EVENT_NAME_APPROVE)
          .withArgs(owner1.address, tx.id);

        expect(await wallet.getApprovalStatus(tx.id, owner1.address)).to.eq(true);

        await expect(wallet.connect(owner2).approve(tx.id))
          .to.emit(wallet, EVENT_NAME_APPROVE)
          .withArgs(owner2.address, tx.id);

        expect(await wallet.getApprovalStatus(tx.id, owner2.address)).to.eq(true);
        expect(await wallet.getApprovalCount(tx.id)).to.eq(2);
      });

      it("Is reverted if it is called not by an owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(wallet.approve(tx.id)).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_UNAUTHORIZED_CALLER);
      });

      it("Is reverted if the transaction does not exist", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.connect(owner1).approve(tx.id)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_DOES_NOT_EXIST);
      });

      it("Is reverted if the transaction is already executed", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        await proveTx(wallet.connect(owner2).approveAndExecute(tx.id));

        await expect(
          wallet.connect(owner3).approve(tx.id)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_EXECUTED);
      });

      it("Is reverted if the transaction is already approved by the same owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));

        await expect(
          wallet.connect(owner1).approve(tx.id)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_APPROVED);
      });
    });

    describe("Function 'approveBatch()'", () => {
      const txs: TestTx[] = [
        {
          id: 0,
          to: ADDRESS_STUB,
          value: 0,
          data: TX_DATA_STUB
        },
        {
          id: 1,
          to: ADDRESS_STUB2,
          value: 0,
          data: TX_DATA_STUB2
        }
      ];
      const txIds: number[] = txs.map(tx => tx.id);

      it("Executes as expected and emits the correct events", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        for (const tx of txs) {
          await proveTx(wallet.connect(owner1).submit(tx.to, tx.value, tx.data));
          expect(await wallet.getApprovalCount(tx.id)).to.eq(0);
        }

        const txResponse1 = wallet.connect(owner1).approveBatch(txIds);
        for (const tx of txs) {
          await expect(txResponse1)
            .to.emit(wallet, EVENT_NAME_APPROVE)
            .withArgs(owner1.address, tx.id);
          expect(await wallet.getApprovalStatus(tx.id, owner1.address)).to.eq(true);
          expect(await wallet.getApprovalCount(tx.id)).to.eq(1);
        }

        const txResponse2 = wallet.connect(owner2).approveBatch(txIds);
        for (const tx of txs) {
          await expect(txResponse2)
            .to.emit(wallet, EVENT_NAME_APPROVE)
            .withArgs(owner2.address, tx.id);
          expect(await wallet.getApprovalStatus(tx.id, owner2.address)).to.eq(true);
          expect(await wallet.getApprovalCount(tx.id)).to.eq(2);
        }
      });

      it("Is reverted if it is called not by an owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.approveBatch(txIds)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_UNAUTHORIZED_CALLER);
      });

      it("Is reverted if a transaction from the batch does not exist", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(wallet.connect(owner1).submit(txs[0].to, txs[0].value, txs[0].data));
        await expect(
          wallet.connect(owner1).approve(txIds)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_DOES_NOT_EXIST);
      });

      it("Is reverted if a transaction from the batch is already executed", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        for (const tx of txs) {
          await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        }
        const lastTx: TestTx = txs[txs.length - 1];
        await proveTx(wallet.connect(owner2).approveAndExecute(lastTx.id));

        await expect(
          wallet.connect(owner3).approveBatch(txIds)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_EXECUTED);
      });

      it("Is reverted if the transaction is already approved by the same owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        for (const tx of txs) {
          await proveTx(wallet.connect(owner1).submit(tx.to, tx.value, tx.data));
        }
        const lastTx: TestTx = txs[txs.length - 1];
        await proveTx(wallet.connect(owner1).approve(lastTx.id));

        await expect(
          wallet.connect(owner1).approveBatch(txIds)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_APPROVED);
      });
    });

    describe("Function 'approveAndExecute()'", () => {
      const tx: TestTx = {
        id: 0,
        to: ADDRESS_STUB,
        value: 0,
        data: TX_DATA_STUB
      };

      it("Executes as expected and emits the correct events", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        expect(await wallet.getApprovalStatus(tx.id, owner1.address)).to.eq(true);

        const txResponse: TransactionResponse = await wallet.connect(owner2).approveAndExecute(tx.id);
        await expect(txResponse).to.emit(wallet, EVENT_NAME_APPROVE).withArgs(owner2.address, tx.id);
        await expect(txResponse).to.emit(wallet, EVENT_NAME_EXECUTE).withArgs(owner2.address, tx.id);
        tx.executed = true;

        expect(await wallet.getApprovalStatus(tx.id, owner2.address)).to.eq(true);
        const actualTx = await wallet.getTransaction(tx.id);
        checkTxEquality(actualTx, tx);
      });

      it("Is reverted if it is called not by an owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.approveAndExecute(tx.id)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_UNAUTHORIZED_CALLER);
      });

      it("Is reverted if the transaction does not exist", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.connect(owner1).approveAndExecute(tx.id)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_DOES_NOT_EXIST);
      });

      it("Is reverted if the transaction is already approved by the same owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));

        await expect(
          wallet.connect(owner1).approveAndExecute(tx.id)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_APPROVED);
      });

      it("Is reverted if the transaction is already executed", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        await proveTx(wallet.connect(owner2).approveAndExecute(tx.id));

        await expect(
          wallet.connect(owner3).approveAndExecute(tx.id)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_EXECUTED);
      });

      it("Is reverted if the transaction has not enough approvals", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(wallet.connect(owner1).submit(tx.to, tx.value, tx.data));

        await expect(
          wallet.connect(owner1).approveAndExecute(tx.id)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_HAS_NOT_ENOUGH_APPROVALS);
      });

      it("Is reverted if the internal transaction execution fails", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        tx.value = TX_VALUE_STUB;
        await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));

        await expect(wallet.connect(owner2).approveAndExecute(tx.id))
          .to.revertedWithCustomError(wallet, REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED)
          .withArgs(DEFAULT_ERROR_DATA);
      });
    });

    describe("Function 'approveAndExecuteBatch()'", () => {
      const txs: TestTx[] = [
        {
          id: 0,
          to: ADDRESS_STUB,
          value: 0,
          data: TX_DATA_STUB
        },
        {
          id: 1,
          to: ADDRESS_STUB2,
          value: 0,
          data: TX_DATA_STUB2
        }
      ];
      const txIds: number[] = txs.map(tx => tx.id);

      it("Executes as expected and emits the correct events", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        for (const tx of txs) {
          await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        }

        const txResponse: TransactionResponse = await wallet.connect(owner2).approveAndExecuteBatch(txIds);
        for (const tx of txs) {
          await expect(txResponse).to.emit(wallet, EVENT_NAME_APPROVE).withArgs(owner2.address, tx.id);
          await expect(txResponse).to.emit(wallet, EVENT_NAME_EXECUTE).withArgs(owner2.address, tx.id);
          tx.executed = true;
          expect(await wallet.getApprovalStatus(tx.id, owner2.address)).to.eq(true);
          const actualTx = await wallet.getTransaction(tx.id);
          checkTxEquality(actualTx, tx);
        }
      });

      it("Is reverted if it is called not by an owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.approveAndExecuteBatch(txIds)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_UNAUTHORIZED_CALLER);
      });

      it("Is reverted if a transaction from the batch does not exist", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(wallet.connect(owner1).submit(txs[0].to, txs[0].value, txs[0].data));
        await proveTx(wallet.connect(owner1).approve(txs[0].id));
        await expect(
          wallet.connect(owner2).approveAndExecuteBatch(txIds)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_DOES_NOT_EXIST);
      });

      it("Is reverted if a transaction from the batch is already approved by the same owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        for (const tx of txs) {
          await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        }

        await expect(
          wallet.connect(owner1).approveAndExecuteBatch(txIds)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_APPROVED);
      });

      it("Is reverted if a transaction from the batch is already executed", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        for (const tx of txs) {
          await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        }
        const lastTx: TestTx = txs[txs.length - 1];
        await proveTx(wallet.connect(owner2).approveAndExecute(lastTx.id));

        await expect(
          wallet.connect(owner3).approveAndExecuteBatch(txIds)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_EXECUTED);
      });

      it("Is reverted if a transaction from the batch has not enough approvals", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        for (const tx of txs) {
          await proveTx(wallet.connect(owner1).submit(tx.to, tx.value, tx.data));
        }

        await expect(
          wallet.connect(owner1).approveAndExecuteBatch(txIds)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_HAS_NOT_ENOUGH_APPROVALS);
      });

      it("Is reverted if the internal transaction execution fails", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const lastTx: TestTx = txs[txs.length - 1];
        lastTx.value = TX_VALUE_STUB;
        for (const tx of txs) {
          await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        }

        await expect(wallet.connect(owner2).approveAndExecuteBatch(txIds))
          .to.revertedWithCustomError(wallet, REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED)
          .withArgs(DEFAULT_ERROR_DATA);
      });
    });

    describe("Function 'execute()'", () => {
      const tx: TestTx = {
        id: 0,
        to: ADDRESS_STUB,
        value: 0,
        data: TX_DATA_STUB
      };

      it("Executes as expected and emits the correct event", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        await proveTx(wallet.connect(owner2).approve(tx.id));

        await expect(wallet.connect(owner1).execute(tx.id))
          .to.emit(wallet, EVENT_NAME_EXECUTE)
          .withArgs(owner1.address, tx.id);
        tx.executed = true;

        const actualTx = await wallet.getTransaction(tx.id);
        checkTxEquality(actualTx, tx);
      });

      it("Is reverted if it is called not by an owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(wallet.execute(tx.id)).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_UNAUTHORIZED_CALLER);
      });

      it("Is reverted if the transaction does not exist", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.connect(owner1).execute(tx.id)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_DOES_NOT_EXIST);
      });

      it("Is reverted if the transaction is already executed", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        await proveTx(wallet.connect(owner2).approveAndExecute(tx.id));

        await expect(
          wallet.connect(owner3).execute(tx.id)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_EXECUTED);
      });

      it("Is reverted if the transaction has not enough approvals", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));

        await expect(
          wallet.connect(owner1).execute(tx.id)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_HAS_NOT_ENOUGH_APPROVALS);
      });

      it("Is reverted if the internal transaction execution fails", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        tx.value = TX_VALUE_STUB;
        await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        await proveTx(wallet.connect(owner2).approve(tx.id));

        await expect(wallet.connect(owner1).execute(tx.id))
          .to.revertedWithCustomError(wallet, REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED)
          .withArgs(DEFAULT_ERROR_DATA);
      });
    });

    describe("Function 'executeBatch()'", () => {
      const txs: TestTx[] = [
        {
          id: 0,
          to: ADDRESS_STUB,
          value: 0,
          data: TX_DATA_STUB
        },
        {
          id: 1,
          to: ADDRESS_STUB2,
          value: 0,
          data: TX_DATA_STUB2
        }
      ];
      const txIds: number[] = txs.map(tx => tx.id);

      it("Executes as expected and emits the correct events", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        for (const tx of txs) {
          await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        }
        await proveTx(wallet.connect(owner2).approveBatch(txIds));

        const txResponse = wallet.connect(owner3).executeBatch(txIds);

        for (const tx of txs) {
          await expect(txResponse)
            .to.emit(wallet, EVENT_NAME_EXECUTE)
            .withArgs(owner3.address, tx.id);
          tx.executed = true;
          const actualTx = await wallet.getTransaction(tx.id);
          checkTxEquality(actualTx, tx);
        }
      });

      it("Is reverted if it is called not by an owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.executeBatch(txIds)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_UNAUTHORIZED_CALLER);
      });

      it("Is reverted if a transaction from the batch does not exist", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        for (const tx of txs.slice(0, -1)) {
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data);
        }
        await proveTx(wallet.connect(owner2).approveBatch(txIds.slice(0, -1)));

        await expect(
          wallet.connect(owner3).executeBatch(txIds)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_DOES_NOT_EXIST);
      });

      it("Is reverted if a transaction from the batch is already executed", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const lastTx = txs[txs.length - 1];
        for (const tx of txs) {
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data);
        }
        await proveTx(wallet.connect(owner2).approveBatch(txIds));
        await proveTx(wallet.connect(owner3).execute(lastTx.id));

        await expect(
          wallet.connect(owner3).executeBatch(txIds)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_EXECUTED);
      });

      it("Is reverted if the transaction has not enough approvals", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        for (const tx of txs) {
          await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        }
        await proveTx(wallet.connect(owner2).approveBatch(txIds.slice(0, -1)));

        await expect(
          wallet.connect(owner3).executeBatch(txIds)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_HAS_NOT_ENOUGH_APPROVALS);
      });

      it("Is reverted if the internal transaction execution fails", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const lastTx: TestTx = txs[txs.length - 1];
        lastTx.value = TX_VALUE_STUB;
        for (const tx of txs) {
          await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        }
        await proveTx(wallet.connect(owner2).approveBatch(txIds));

        await expect(wallet.connect(owner3).executeBatch(txIds))
          .to.revertedWithCustomError(wallet, REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED)
          .withArgs(DEFAULT_ERROR_DATA);
      });
    });

    describe("Function 'revoke()'", () => {
      const tx: TestTx = {
        id: 0,
        to: ADDRESS_STUB,
        value: 0,
        data: TX_DATA_STUB
      };

      it("Executes as expected and emits the correct event", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        expect(await wallet.getApprovalStatus(tx.id, owner1.address)).to.eq(true);

        await expect(wallet.connect(owner1).revoke(tx.id))
          .to.emit(wallet, EVENT_NAME_REVOKE)
          .withArgs(owner1.address, tx.id);

        expect(await wallet.getApprovalStatus(tx.id, owner1.address)).to.eq(false);
      });

      it("Is reverted if it is called not by an owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(wallet.revoke(tx.id)).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_UNAUTHORIZED_CALLER);
      });

      it("Is reverted if the transaction does not exist", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.connect(owner1).revoke(tx.id)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_DOES_NOT_EXIST);
      });

      it("Is reverted if the transaction is already executed", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        await proveTx(wallet.connect(owner2).approveAndExecute(tx.id));

        await expect(
          wallet.connect(owner1).revoke(tx.id)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_EXECUTED);
      });

      it("Is reverted if the transaction is not approved by the owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));

        await expect(
          wallet.connect(owner2).revoke(tx.id)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_IS_NOT_APPROVED);
      });
    });

    describe("Function 'revokeBatch()'", () => {
      const txs: TestTx[] = [
        {
          id: 0,
          to: ADDRESS_STUB,
          value: 0,
          data: TX_DATA_STUB
        },
        {
          id: 1,
          to: ADDRESS_STUB2,
          value: 0,
          data: TX_DATA_STUB2
        }
      ];
      const txIds: number[] = txs.map(tx => tx.id);

      it("Executes as expected and emits the correct events", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        for (const tx of txs) {
          await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
          expect(await wallet.getApprovalStatus(tx.id, owner1.address)).to.eq(true);
        }

        const txResponse = wallet.connect(owner1).revokeBatch(txIds);

        for (const tx of txs) {
          await expect(txResponse)
            .to.emit(wallet, EVENT_NAME_REVOKE)
            .withArgs(owner1.address, tx.id);
          expect(await wallet.getApprovalStatus(tx.id, owner1.address)).to.eq(false);
        }
      });

      it("Is reverted if it is called not by an owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.revokeBatch(txIds)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_UNAUTHORIZED_CALLER);
      });

      it("Is reverted if a transaction from the batch does not exist", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        for (const tx of txs.slice(0, -1)) {
          await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        }

        await expect(
          wallet.connect(owner1).revokeBatch(txIds)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_DOES_NOT_EXIST);
      });

      it("Is reverted if a transaction from the batch is already executed", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const lastTx = txs[txs.length - 1];
        for (const tx of txs) {
          await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        }
        await proveTx(wallet.connect(owner2).approveAndExecute(lastTx.id));

        await expect(
          wallet.connect(owner1).revokeBatch(txIds)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_EXECUTED);
      });

      it("Is reverted if a transaction from the batch is not approved by the owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        for (const tx of txs) {
          await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        }
        await proveTx(wallet.connect(owner2).approveBatch(txIds.slice(0, -1)));

        await expect(
          wallet.connect(owner2).revokeBatch(txIds)
        ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_IS_NOT_APPROVED);
      });
    });

    describe("Functions 'getTransaction()' and 'getTransactions()'", () => {
      const txs: TestTx[] = [0, 1, 2, 3].map(id => {
        return {
          id: id,
          to: ethers.utils.hexZeroPad(ethers.utils.hexValue(id + 1), 20),
          value: id,
          data: ethers.utils.hexlify(ethers.utils.toUtf8Bytes("Some data " + (id + 1)))
        };
      });

      it("Execute as expected in different cases", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        for (const tx of txs) {
          await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        }
        await proveTx(wallet.connect(owner2).approveAndExecute(txs[0].id));
        txs[0].executed = true;

        expect(await wallet.transactionCount()).to.eq(txs.length);

        for (const tx of txs) {
          const actualTx = await wallet.getTransaction(tx.id);
          checkTxEquality(actualTx, tx);
        }

        if (network.name === "hardhat") {
          await expect(
            wallet.getTransaction(txs.length)
          ).to.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_DOES_NOT_EXIST);
        } else {
          await expect(wallet.getTransaction(txs.length)).to.reverted;
        }

        let actualTxs: TestTx[];

        actualTxs = await wallet.getTransactions(0, 50);
        checkTxArrayEquality(actualTxs, txs);

        actualTxs = await wallet.getTransactions(0, 2);
        checkTxArrayEquality(actualTxs, [txs[0], txs[1]]);

        actualTxs = await wallet.getTransactions(1, 2);
        checkTxArrayEquality(actualTxs, [txs[1], txs[2]]);

        actualTxs = await wallet.getTransactions(1, 1);
        checkTxArrayEquality(actualTxs, [txs[1]]);

        actualTxs = await wallet.getTransactions(2, 2);
        checkTxArrayEquality(actualTxs, [txs[2], txs[3]]);

        actualTxs = await wallet.getTransactions(2, 50);
        checkTxArrayEquality(actualTxs, [txs[2], txs[3]]);

        actualTxs = await wallet.getTransactions(4, 50);
        checkTxArrayEquality(actualTxs, []);

        actualTxs = await wallet.getTransactions(1, 0);
        checkTxArrayEquality(actualTxs, []);
      });
    });

    describe("Scenarios with cooldown and expiration", () => {
      const tx: TestTx = {
        id: 0,
        to: ADDRESS_STUB,
        value: 0,
        data: TX_DATA_STUB
      };

      async function wait(timeoutInSeconds: number) {
        if (network.name === "hardhat") {
          // A virtual wait through network time shifting
          await time.increase(timeoutInSeconds);
        } else {
          // A real wait through a promise
          const timeoutInMills = timeoutInSeconds * 1000;
          await new Promise(resolve => setTimeout(resolve, timeoutInMills));
        }
      }

      async function executeWalletTx(params: { wallet: Contract; txData: string; txId?: number }): Promise<number> {
        const { wallet, txData } = params;
        const txId = params.txId || 0;
        await proveTx(wallet.connect(owner1).submitAndApprove(wallet.address, txId, txData));
        await proveTx(wallet.connect(owner2).approveAndExecute(txId));
        return txId + 1;
      }

      it("Submission of a transaction sets the cooldown and expiration fields properly", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const txData = encodeConfigureCooldownTimeFunctionData(TWO_HOURS);
        const txId = await executeWalletTx({ wallet, txData });

        const txReceipt = await proveTx(wallet.connect(owner1).submit(tx.to, tx.value, tx.data));

        const txStruct = await wallet.getTransaction(txId);
        const block = await wallet.provider.getBlock(txReceipt.blockNumber);
        const blockTimestamp: number = block.timestamp;
        expect(txStruct.cooldown).to.eq(blockTimestamp + TWO_HOURS);
        expect(txStruct.expiration).to.eq(blockTimestamp + TWO_HOURS + ONE_YEAR);
      });

      it("Execution of a transaction is reverted if the transaction is still on the cooldown", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const txData = encodeConfigureCooldownTimeFunctionData(TWO_HOURS);
        const txId = await executeWalletTx({ wallet, txData });

        await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));

        await expect(
          wallet.connect(owner2).approveAndExecute(txId)
        ).to.be.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_ON_COOLDOWN);
      });

      it("Approval of a transaction is reverted if the transaction is already expired", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const txData = encodeConfigureExpirationTimeTimeFunctionData(ONE_DAY);
        const txId = await executeWalletTx({ wallet, txData });

        await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        await wait(2 * ONE_DAY);
        await expect(
          wallet.connect(owner2).approve(txId)
        ).to.be.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_EXPIRED);
      });

      async function prepareExecutionWithSingleApproval(): Promise<{
        wallet: Contract;
        txId: number;
      }> {
        const { wallet } = await setUpFixture(deployWallet);

        // Set only one required approval
        const requiredApprovals = 1;
        let txData = encodeConfigureOwnersFunctionData(ownerAddresses, requiredApprovals);
        let txId = await executeWalletTx({ wallet, txData });

        // Set the new expiration time
        txData = encodeConfigureExpirationTimeTimeFunctionData(ONE_DAY);
        await proveTx(wallet.connect(owner1).submitAndApprove(wallet.address, 0, txData));
        await proveTx(wallet.connect(owner1).execute(txId));

        ++txId;
        return { wallet, txId };
      }

      it("Execution of a transaction is reverted if the transaction is already expired", async () => {
        const { wallet, txId } = await prepareExecutionWithSingleApproval();
        await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        await wait(2 * ONE_DAY);
        await expect(
          wallet.connect(owner1).execute(txId)
        ).to.be.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_EXPIRED);
      });

      it("Revocation of a transaction is reverted if the transaction is already expired", async () => {
        const { wallet, txId } = await prepareExecutionWithSingleApproval();

        await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));
        await wait(2 * ONE_DAY);
        await expect(
          wallet.connect(owner1).revoke(txId)
        ).to.be.revertedWithCustomError(wallet, REVERT_ERROR_IF_TRANSACTION_EXPIRED);
      });
    });

    describe("Scenarios with sending transactions to another contract", () => {
      async function beforeExecution(params: { functionName: string; txValue: number }): Promise<{
        wallet: Contract;
        testContractMock: Contract;
        tx: TestTx;
        amount: number;
      }> {
        const { wallet, testContractMock } = await setUpFixture(deployAllContracts);
        const tokenInterface = new ethers.utils.Interface([`function ${params.functionName}(uint256 amount)`]);
        const amount = 234;
        const tx: TestTx = {
          id: 0,
          to: testContractMock.address,
          value: params.txValue,
          data: tokenInterface.encodeFunctionData(params.functionName, [amount])
        };
        await proveTx(wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data));

        return {
          wallet,
          testContractMock,
          tx,
          amount
        };
      }

      describe("Function 'approveAndExecute()' sends a transaction as expected if", () => {
        it("The function of another contract exists and other conditions are met", async () => {
          const { wallet, testContractMock, tx, amount } = await beforeExecution({
            functionName: "testFunction",
            txValue: TX_VALUE_STUB
          });
          await proveTx(
            owner2.sendTransaction({
              to: wallet.address,
              value: tx.value
            })
          );

          const txResponse: TransactionResponse = await wallet.connect(owner2).approveAndExecute(tx.id);
          await expect(txResponse)
            .to.emit(wallet, EVENT_NAME_EXECUTE)
            .withArgs(owner2.address, tx.id);
          await expect(txResponse)
            .to.emit(testContractMock, EVENT_NAME_TEST)
            .withArgs(wallet.address, tx.value, amount);
          await expect(txResponse).to.changeEtherBalances(
            [wallet, testContractMock],
            [-tx.value, tx.value]
          );
        });
      });

      describe("Function 'approveAndExecute()' is reverted if", () => {
        it("The function of another contract does not exist", async () => {
          const { wallet, tx } = await beforeExecution({
            functionName: "burn",
            txValue: 0
          });

          await expect(wallet.connect(owner2).approveAndExecute(tx.id))
            .to.revertedWithCustomError(wallet, REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED)
            .withArgs(DEFAULT_ERROR_DATA);
        });

        it("The function of another contract is reverted during execution", async () => {
          const { wallet, testContractMock, tx } = await beforeExecution({
            functionName: "testFunction",
            txValue: 0
          });
          await proveTx(testContractMock.disable());

          await expect(wallet.connect(owner2).approveAndExecute(tx.id))
            .to.revertedWithCustomError(wallet, REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED)
            .withArgs(testContractMock.interface.encodeErrorResult("TestError", ["Contract is disabled"]));
        });

        it("The wallet has not enough balance of the native tokens", async () => {
          const { wallet, tx } = await beforeExecution({
            functionName: "testFunction",
            txValue: TX_VALUE_STUB
          });
          await proveTx(
            owner2.sendTransaction({
              to: wallet.address,
              value: tx.value - 1
            })
          );

          await expect(wallet.connect(owner2).approveAndExecute(tx.id))
            .to.revertedWithCustomError(wallet, REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED)
            .withArgs(DEFAULT_ERROR_DATA);
        });
      });
    });
  });
});
