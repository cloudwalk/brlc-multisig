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

function checkTxEquality(actualOnChainTx: any, expectedTx: TestTx) {
  expect(actualOnChainTx.to).to.equal(
    expectedTx.to,
    `tx[${expectedTx.id}].to is incorrect`
  );
  expect(actualOnChainTx.value).to.equal(
    expectedTx.value,
    `tx[${expectedTx.id}].value is incorrect`
  );
  expect(actualOnChainTx.data).to.equal(
    expectedTx.data,
    `tx[${expectedTx.id}].data is incorrect`
  );
  expect(actualOnChainTx.executed).to.equal(
    !!expectedTx.executed,
    `tx[${expectedTx.id}].executed is incorrect`
  );
}

function checkTxArrayEquality(actualOnChainTxs: any[], expectedTxs: TestTx[]) {
  expect(actualOnChainTxs.length).to.eq(expectedTxs.length);
  for (let i = 0; i < expectedTxs.length; ++i) {
    checkTxEquality(actualOnChainTxs[i], expectedTxs[i]);
  }
}

async function setUpFixture(func: any) {
  if (network.name === "hardhat") {
    return loadFixture(func);
  } else {
    return func();
  }
}

describe("Multisig wallet contracts", () => {
  const REQUIRED_APPROVALS = 2;
  const ONE_SECOND = 1;
  const ONE_MINUTE = 60;
  const ONE_YEAR = 3600 * 24 * 365;

  const ADDRESS_STUB = "0x0000000000000000000000000000000000000001";
  const TX_VALUE_STUB = 123;
  const TX_DATA_STUB = ethers.utils.hexlify(
    ethers.utils.toUtf8Bytes("Some data")
  );
  const DEFAULT_ERROR_DATA = "0x";

  const HARDHAT_PROXY_ADMIN_ADDRESS =
    "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const HARDHAT_FIRST_DEPLOYED_WALLET_ADDRESS =
    "0xF1823bc4243b40423b8C8c3F6174e687a4C690b8";

  const EVENT_NAME_APPROVE = "Approve";
  const EVENT_NAME_DEPOSIT = "Deposit";
  const EVENT_NAME_EXECUTE = "Execute";
  const EVENT_NAME_REVOKE = "Revoke";
  const EVENT_NAME_SUBMIT = "Submit";
  const EVENT_NAME_TEST = "TestEvent";
  const EVENT_NAME_CONFIGURE_OWNERS = "ConfigureOwners";
  const EVENT_NAME_CONFIGURE_COOLDOWN_TIME = "ConfigureCooldownTime";
  const EVENT_NAME_CONFIGURE_EXPIRATION_TIME = "ConfigureExpirationTime";
  const EVENT_NAME_NEW_WALLET_DEPLOYED_BY_FACTORY = "NewWallet";

  const REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED =
    "Initializable: contract is already initialized";

  const REVERT_ERROR_IF_UNAUTHORIZED_CALLER = "UnauthorizedCaller";
  const REVERT_ERROR_INVALID_OWNERS_ARRAY = "InvalidOwnersArray";
  const REVERT_ERROR_IF_INVALID_REQUIRED_APPROVALS = "InvalidRequiredApprovals";
  const REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED =
    "InternalTransactionFailed";
  const REVERT_ERROR_IF_TRANSACTION_DOES_NOT_EXIST = "TransactionNotExist";
  const REVERT_ERROR_IF_TRANSACTION_HAS_NOT_ENOUGH_APPROVALS =
    "NotEnoughApprovals";
  const REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_APPROVED =
    "TransactionAlreadyApproved";
  const REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_EXECUTED =
    "TransactionAlreadyExecuted";
  const REVERT_ERROR_IF_TRANSACTION_IS_NOT_APPROVED = "TransactionNotApproved";
  const REVERT_ERROR_IF_TRANSACTION_ON_COOLDOWN = "CooldownNotEnded";
  const REVERT_ERROR_IF_TRANSACTION_EXPIRED = "TransactionExpired";
  const REVERT_MESSAGE_CALLER_NOT_OWNER = "Ownable: caller is not the owner";

  let tokenFactory: ContractFactory;
  let walletUpgradeableFactory: ContractFactory;
  let walletFactory: ContractFactory;
  let factoryContractFactory: ContractFactory;
  let proxyAdminFactory: ContractFactory;
  let mockWalletFactory: ContractFactory;

  let deployer: SignerWithAddress;
  let owner1: SignerWithAddress;
  let owner2: SignerWithAddress;
  let owner3: SignerWithAddress;
  let user: SignerWithAddress;

  let ownerAddresses: string[];

  before(async () => {
    [deployer, owner1, owner2, owner3, user] = await ethers.getSigners();
    ownerAddresses = [owner1.address, owner2.address, owner3.address];
    walletUpgradeableFactory = await ethers.getContractFactory(
      "MultiSigWalletUpgradeable"
    );
    walletFactory = await ethers.getContractFactory("MultiSigWallet");
    factoryContractFactory = await ethers.getContractFactory(
      "MultiSigWalletFactory"
    );
    tokenFactory = await ethers.getContractFactory("TestContractMock");
    proxyAdminFactory = await ethers.getContractFactory("ProxyAdminMock");
    mockWalletFactory = await ethers.getContractFactory("MultiSigWallet");
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

  function encodeConfigureOwnersFunctionData(
    ownerAddresses: string[],
    requiredApprovals: number
  ): string {
    return walletUpgradeableFactory.interface.encodeFunctionData(
      "configureOwners",
      [ownerAddresses, requiredApprovals]
    );
  }

  function encodeConfigureCooldownTimeFunctionData(
    cooldownTime: number
  ): string {
    return walletUpgradeableFactory.interface.encodeFunctionData(
      "configureCooldownTime",
      [cooldownTime]
    );
  }

  function encodeConfigureExpirationTimeTimeFunctionData(
    expirationTime: number
  ): string {
    return walletUpgradeableFactory.interface.encodeFunctionData(
      "configureExpirationTime",
      [expirationTime]
    );
  }

  async function encodeUpgradeFunctionData(
    proxy: string,
    newImplementation: string
  ) {
    return proxyAdminFactory.interface.encodeFunctionData("upgrade", [
      proxy,
      newImplementation,
    ]);
  }

  async function deployTestContractMock(): Promise<{
    testContractMock: Contract;
  }> {
    const testContractMock = await tokenFactory.deploy();
    await testContractMock.deployed();

    return {
      testContractMock,
    };
  }

  async function deployWalletUpgradeable(): Promise<{ wallet: Contract }> {
    const wallet = await upgrades.deployProxy(walletUpgradeableFactory, [
      ownerAddresses,
      REQUIRED_APPROVALS,
    ]);
    await wallet.deployed();

    return {
      wallet,
    };
  }

  async function deployWallet(): Promise<{ wallet: Contract }> {
    const wallet = await walletFactory.deploy(
      ownerAddresses,
      REQUIRED_APPROVALS
    );
    await wallet.deployed();
    return {
      wallet,
    };
  }

  async function deployFactory(): Promise<{ factory: Contract }> {
    const factory = await factoryContractFactory.deploy();
    await factory.deployed();
    return {
      factory,
    };
  }

  async function deployWalletContractMock(): Promise<{
    walletContractMock: Contract;
  }> {
    const walletContractMock = await mockWalletFactory.deploy(
      ownerAddresses,
      REQUIRED_APPROVALS
    );
    await walletContractMock.deployed();

    return {
      walletContractMock,
    };
  }

  async function getProxyAdminContract(): Promise<{
    admin: Contract;
  }> {
    const admin = await ethers.getContractAt(
      "ProxyAdminMock",
      HARDHAT_PROXY_ADMIN_ADDRESS
    );
    return {
      admin,
    };
  }

  async function deployAllContracts(): Promise<{
    wallet: Contract;
    testContractMock: Contract;
    admin: Contract;
    walletContractMock: Contract;
    factory: Contract;
  }> {
    const { wallet } = await deployWalletUpgradeable();
    const { testContractMock } = await deployTestContractMock();
    const { admin } = await getProxyAdminContract();
    const { walletContractMock } = await deployWalletContractMock();
    const { factory } = await deployFactory();

    return {
      wallet,
      testContractMock,
      admin,
      walletContractMock,
      factory,
    };
  }

  describe("Contract 'MultiSigWalletUpgradeable'", () => {
    describe("Function 'initialize()'", () => {
      it("Configures the contract as expected", async () => {
        const { wallet } = await setUpFixture(deployWalletUpgradeable);

        expect(await wallet.owners()).to.deep.eq(ownerAddresses);
        expect(await wallet.requiredApprovals()).to.eq(REQUIRED_APPROVALS);
        expect(await wallet.transactionCount()).to.eq(0);
        expect(await wallet.cooldownTime()).to.eq(0);
        expect(await wallet.expirationTime()).to.eq(ONE_YEAR);
        await checkOwnership(wallet, {
          ownerAddresses,
          expectedOwnershipStatus: true,
        });
      });

      it("Is reverted if it is called a second time", async () => {
        const { wallet } = await setUpFixture(deployWalletUpgradeable);
        await expect(
          wallet.initialize(ownerAddresses, REQUIRED_APPROVALS)
        ).to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
      });

      it("Is reverted if the input owner array is empty", async () => {
        const uninitializedWallet = await upgrades.deployProxy(
          walletUpgradeableFactory,
          [],
          { initializer: false }
        );
        await expect(
          uninitializedWallet.initialize([], 0)
        ).to.be.revertedWithCustomError(
          walletUpgradeableFactory,
          REVERT_ERROR_INVALID_OWNERS_ARRAY
        );
      });

      it("Is reverted if the input number of required approvals is zero", async () => {
        const uninitializedWallet = await upgrades.deployProxy(
          walletUpgradeableFactory,
          [],
          { initializer: false }
        );
        const requiredApprovals = 0;
        await expect(
          uninitializedWallet.initialize(ownerAddresses, requiredApprovals)
        ).to.be.revertedWithCustomError(
          walletUpgradeableFactory,
          REVERT_ERROR_IF_INVALID_REQUIRED_APPROVALS
        );
      });

      it("Is reverted if the input number of required approvals exceeds the length of the input owner array", async () => {
        const uninitializedWallet = await upgrades.deployProxy(
          walletUpgradeableFactory,
          [],
          { initializer: false }
        );
        const requiredApprovals = ownerAddresses.length + 1;
        await expect(
          uninitializedWallet.initialize(ownerAddresses, requiredApprovals)
        ).to.be.revertedWithCustomError(
          walletUpgradeableFactory,
          REVERT_ERROR_IF_INVALID_REQUIRED_APPROVALS
        );
      });

      it("Is reverted if one of the input owners is the zero address", async () => {
        const uninitializedWallet = await upgrades.deployProxy(
          walletUpgradeableFactory,
          [],
          { initializer: false }
        );
        const ownerAddressArray = [
          ownerAddresses[0],
          ownerAddresses[1],
          ethers.constants.AddressZero,
        ];
        const requiredApprovals = ownerAddressArray.length - 1;
        await expect(
          uninitializedWallet.initialize(ownerAddressArray, requiredApprovals)
        ).to.be.revertedWithCustomError(
          walletUpgradeableFactory,
          REVERT_ERROR_INVALID_OWNERS_ARRAY
        );
      });

      it("Is reverted if there is a duplicate address in the input owner array", async () => {
        const uninitializedWallet = await upgrades.deployProxy(
          walletUpgradeableFactory,
          [],
          { initializer: false }
        );
        const ownerAddressArray = [
          ownerAddresses[0],
          ownerAddresses[1],
          ownerAddresses[0],
        ];
        const requiredApprovals = ownerAddresses.length - 1;
        await expect(
          uninitializedWallet.initialize(ownerAddressArray, requiredApprovals)
        ).to.be.revertedWithCustomError(
          walletUpgradeableFactory,
          REVERT_ERROR_INVALID_OWNERS_ARRAY
        );
      });

      it("Is reverted for the contract implementation if it is called even for the first time", async () => {
        const wallet = await walletUpgradeableFactory.deploy();
        await wallet.deployed();

        await expect(
          wallet.initialize(ownerAddresses, REQUIRED_APPROVALS)
        ).to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
      });
    });

    describe("Transferring upgradeable functionality and upgrading", () => {
      it("Deployer can transfer ProxyAdmin ownership to wallet itself", async () => {
        const { admin, wallet } = await setUpFixture(deployAllContracts);

        await admin.transferOwnership(wallet.address);
        const newOwner = await admin.owner();

        expect(newOwner).to.eq(wallet.address);
      });

      it("Upgrades multisig to te new implementaton from multisig itself", async () => {
        const { wallet, walletContractMock, admin } = await setUpFixture(
          deployAllContracts
        );

        await admin.transferOwnership(wallet.address);
        const newOwner = await admin.owner();

        expect(newOwner).to.eq(wallet.address);

        const upgradeData = encodeUpgradeFunctionData(
          wallet.address,
          walletContractMock.address
        );

        await wallet
          .connect(owner1)
          .submitAndApprove(admin.address, 0, upgradeData);
        await wallet.connect(owner2).approveAndExecute(0);

        const newImplementation = await admin.getProxyImplementation(
          wallet.address
        );

        expect(newImplementation).to.eq(walletContractMock.address);
      });

      it("Upgrade is reverted if caller is not a multisig", async () => {
        const { admin, wallet, walletContractMock } = await setUpFixture(
          deployAllContracts
        );

        await admin.transferOwnership(wallet.address);
        const newOwner = await admin.owner();

        expect(newOwner).to.eq(wallet.address);

        await expect(
          admin.upgrade(wallet.address, walletContractMock.address)
        ).to.be.revertedWith(REVERT_MESSAGE_CALLER_NOT_OWNER);
      });
    });
  });

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
        expectedOwnershipStatus: true,
      });
    });

    it("Deployment is reverted if the input owner array is empty", async () => {
      await expect(
        walletFactory.deploy([], REQUIRED_APPROVALS)
      ).to.be.revertedWithCustomError(
        walletFactory,
        REVERT_ERROR_INVALID_OWNERS_ARRAY
      );
    });

    it("Deployment is reverted if the input number of required approvals is zero", async () => {
      const requiredApprovals = 0;
      await expect(
        walletFactory.deploy(ownerAddresses, requiredApprovals)
      ).to.be.revertedWithCustomError(
        walletFactory,
        REVERT_ERROR_IF_INVALID_REQUIRED_APPROVALS
      );
    });

    it("Deployment is reverted if the input number of required approvals exceeds the length of the input owner array", async () => {
      const requiredApprovals = ownerAddresses.length + 1;
      await expect(
        walletFactory.deploy(ownerAddresses, requiredApprovals)
      ).to.be.revertedWithCustomError(
        walletFactory,
        REVERT_ERROR_IF_INVALID_REQUIRED_APPROVALS
      );
    });

    it("Deployment is reverted if one of the input owners is the zero address", async () => {
      const ownerAddressArray = [
        ownerAddresses[0],
        ownerAddresses[1],
        ethers.constants.AddressZero,
      ];
      const requiredApprovals = ownerAddressArray.length - 1;
      await expect(
        walletFactory.deploy(ownerAddressArray, requiredApprovals)
      ).to.be.revertedWithCustomError(
        walletFactory,
        REVERT_ERROR_INVALID_OWNERS_ARRAY
      );
    });

    it("Deployment is reverted if there is a duplicate address in the input owner array", async () => {
      const ownerAddressArray = [
        ownerAddresses[0],
        ownerAddresses[1],
        ownerAddresses[0],
      ];
      const requiredApprovals = ownerAddresses.length - 1;
      await expect(
        walletFactory.deploy(ownerAddressArray, requiredApprovals)
      ).to.be.revertedWithCustomError(
        walletFactory,
        REVERT_ERROR_INVALID_OWNERS_ARRAY
      );
    });
  });

  describe("Contract 'MultiSigWalletFactory'", () => {
    describe("Function 'deployNewWallet()'", () => {
      it("Creates new wallet instance with selected parameters and emits the event", async () => {
        const { factory } = await setUpFixture(deployFactory);

        await expect(
          await factory.deployNewWallet(ownerAddresses, REQUIRED_APPROVALS)
        )
          .to.emit(factory, EVENT_NAME_NEW_WALLET_DEPLOYED_BY_FACTORY)
          .withArgs(deployer.address, HARDHAT_FIRST_DEPLOYED_WALLET_ADDRESS, 0);

        const walletAddress = await factory.wallets(0);
        const wallet = await ethers.getContractAt(
          "MultiSigWallet",
          walletAddress
        );
        expect(await wallet.owners()).to.deep.eq(ownerAddresses);
        expect(await wallet.requiredApprovals()).to.eq(REQUIRED_APPROVALS);
        expect(await wallet.transactionCount()).to.eq(0);
        expect(await wallet.cooldownTime()).to.eq(0);
        expect(await wallet.expirationTime()).to.eq(ONE_YEAR);
      });

      it("Is reverted if the input owner array is empty", async () => {
        const { factory } = await setUpFixture(deployFactory);

        await expect(
          factory.deployNewWallet([], REQUIRED_APPROVALS)
        ).to.be.revertedWithCustomError(
          walletFactory,
          REVERT_ERROR_INVALID_OWNERS_ARRAY
        );
      });

      it("Is reverted if the input number of required approvals is zero", async () => {
        const { factory } = await setUpFixture(deployFactory);

        const requiredApprovals = 0;
        await expect(
          factory.deployNewWallet(ownerAddresses, requiredApprovals)
        ).to.be.revertedWithCustomError(
          walletFactory,
          REVERT_ERROR_IF_INVALID_REQUIRED_APPROVALS
        );
      });

      it("Is reverted if the input number of required approvals exceeds the length of the input owner array", async () => {
        const { factory } = await setUpFixture(deployFactory);

        const requiredApprovals = ownerAddresses.length + 1;
        await expect(
          factory.deployNewWallet(ownerAddresses, requiredApprovals)
        ).to.be.revertedWithCustomError(
          walletFactory,
          REVERT_ERROR_IF_INVALID_REQUIRED_APPROVALS
        );
      });

      it("Is reverted if one of the input owners is the zero address", async () => {
        const { factory } = await setUpFixture(deployFactory);
        const ownerAddressArray = [
          ownerAddresses[0],
          ownerAddresses[1],
          ethers.constants.AddressZero,
        ];
        const requiredApprovals = ownerAddressArray.length - 1;

        await expect(
          factory.deployNewWallet(ownerAddressArray, requiredApprovals)
        ).to.be.revertedWithCustomError(
          walletFactory,
          REVERT_ERROR_INVALID_OWNERS_ARRAY
        );
      });

      it("Deployment is reverted if there is a duplicate address in the input owner array", async () => {
        const { factory } = await setUpFixture(deployFactory);
        const ownerAddressArray = [
          ownerAddresses[0],
          ownerAddresses[1],
          ethers.constants.AddressZero,
        ];
        const requiredApprovals = ownerAddresses.length - 1;
        await expect(
          factory.deployNewWallet(ownerAddressArray, requiredApprovals)
        ).to.be.revertedWithCustomError(
          walletFactory,
          REVERT_ERROR_INVALID_OWNERS_ARRAY
        );
      });
    });

    describe("Function 'walletsCount()'", async () => {
      it("Returns the amount of deployed wallets", async () => {
        const { factory } = await setUpFixture(deployFactory);

        expect(await factory.walletsCount()).to.eq(0);
        await factory.deployNewWallet(ownerAddresses, REQUIRED_APPROVALS);
        expect(await factory.walletsCount()).to.eq(1);
      });
    });
  });

  describe("Contract 'MultiSigWalletBase'", () => {
    describe("Function 'configureOwners()'", () => {
      it("Updates list of owners and removes old owners", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const newOwnerAddresses = [
          owner1.address,
          owner2.address,
          user.address,
        ];
        const txData = encodeConfigureOwnersFunctionData(
          newOwnerAddresses,
          REQUIRED_APPROVALS + 1
        );

        await proveTx(
          wallet.connect(owner1).submitAndApprove(wallet.address, 0, txData)
        );
        // Check that transaction is successful and event is emitted
        await expect(wallet.connect(owner2).approveAndExecute(0))
          .to.emit(wallet, EVENT_NAME_CONFIGURE_OWNERS)
          .withArgs(newOwnerAddresses, REQUIRED_APPROVALS + 1);
        // Check that owners array is updated.
        expect(await wallet.owners()).to.deep.eq(newOwnerAddresses);

        // Check statuses of owners
        await checkOwnership(wallet, {
          ownerAddresses: newOwnerAddresses,
          expectedOwnershipStatus: true,
        });
        await checkOwnership(wallet, {
          ownerAddresses: [owner3.address],
          expectedOwnershipStatus: false,
        });
      });

      it("Is reverted if the caller is not the multi sig wallet itself", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.configureOwners([], REQUIRED_APPROVALS)
        ).to.be.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_UNAUTHORIZED_CALLER
        );
      });

      it("Is reverted if the input owner array is empty", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const txData = encodeConfigureOwnersFunctionData(
          [],
          REQUIRED_APPROVALS
        );

        await proveTx(
          wallet.connect(owner1).submitAndApprove(wallet.address, 0, txData)
        );
        await expect(wallet.connect(owner2).approveAndExecute(0))
          .to.be.revertedWithCustomError(
            wallet,
            REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED
          )
          .withArgs(
            wallet.interface.encodeErrorResult(
              REVERT_ERROR_INVALID_OWNERS_ARRAY
            )
          );
      });

      it("Is reverted if the input number of required approvals is zero", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const invalidApprovals = 0;
        const txData = encodeConfigureOwnersFunctionData(
          ownerAddresses,
          invalidApprovals
        );

        await proveTx(
          wallet.connect(owner1).submitAndApprove(wallet.address, 0, txData)
        );
        await expect(wallet.connect(owner2).approveAndExecute(0))
          .to.be.revertedWithCustomError(
            wallet,
            REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED
          )
          .withArgs(
            wallet.interface.encodeErrorResult(
              REVERT_ERROR_IF_INVALID_REQUIRED_APPROVALS
            )
          );
      });

      it("Is reverted if the input number of required approvals exceeds the length of the input owner array", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const invalidApprovals = ownerAddresses.length + 1;
        const txData = encodeConfigureOwnersFunctionData(
          ownerAddresses,
          invalidApprovals
        );

        await proveTx(
          wallet.connect(owner1).submitAndApprove(wallet.address, 0, txData)
        );
        await expect(wallet.connect(owner2).approveAndExecute(0))
          .to.be.revertedWithCustomError(
            wallet,
            REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED
          )
          .withArgs(
            wallet.interface.encodeErrorResult(
              REVERT_ERROR_IF_INVALID_REQUIRED_APPROVALS
            )
          );
      });

      it("Is reverted if one of the input owners is the zero address", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const invalidAddresses: string[] = [
          ownerAddresses[0],
          ownerAddresses[1],
          ethers.constants.AddressZero,
        ];
        const txData = encodeConfigureOwnersFunctionData(
          invalidAddresses,
          REQUIRED_APPROVALS
        );

        await proveTx(
          wallet.connect(owner1).submitAndApprove(wallet.address, 0, txData)
        );
        await expect(wallet.connect(owner2).approveAndExecute(0))
          .to.be.revertedWithCustomError(
            wallet,
            REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED
          )
          .withArgs(
            wallet.interface.encodeErrorResult(
              REVERT_ERROR_INVALID_OWNERS_ARRAY
            )
          );
      });

      it("Is reverted if there is a duplicate address in the input owner array", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const invalidAddress = [
          ownerAddresses[0],
          ownerAddresses[1],
          ownerAddresses[0],
        ];
        const txData = encodeConfigureOwnersFunctionData(
          invalidAddress,
          REQUIRED_APPROVALS
        );

        await proveTx(
          wallet.connect(owner1).submitAndApprove(wallet.address, 0, txData)
        );
        await expect(wallet.connect(owner2).approveAndExecute(0))
          .to.be.revertedWithCustomError(
            wallet,
            REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED
          )
          .withArgs(
            wallet.interface.encodeErrorResult(
              REVERT_ERROR_INVALID_OWNERS_ARRAY
            )
          );
      });
    });

    describe("Function 'configureCooldownTime()'", () => {
      it("Correctly changes the transaction cooldown time", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const txData = encodeConfigureCooldownTimeFunctionData(ONE_MINUTE);

        await proveTx(
          wallet.connect(owner1).submitAndApprove(wallet.address, 0, txData)
        );
        await expect(wallet.connect(owner2).approveAndExecute(0))
          .to.emit(wallet, EVENT_NAME_CONFIGURE_COOLDOWN_TIME)
          .withArgs(ONE_MINUTE);

        expect(await wallet.cooldownTime()).to.eq(ONE_MINUTE);
      });

      it("Is reverted if the caller is not the multi sig wallet itself", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.configureCooldownTime(ONE_MINUTE)
        ).to.be.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_UNAUTHORIZED_CALLER
        );
      });
    });

    describe("Function 'configureExpirationTime()'", () => {
      it("Correctly changes the transaction expiration time", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const txData =
          encodeConfigureExpirationTimeTimeFunctionData(ONE_MINUTE);

        await proveTx(
          wallet.connect(owner1).submitAndApprove(wallet.address, 0, txData)
        );
        await expect(wallet.connect(owner2).approveAndExecute(0))
          .to.emit(wallet, EVENT_NAME_CONFIGURE_EXPIRATION_TIME)
          .withArgs(ONE_MINUTE);

        expect(await wallet.expirationTime()).to.eq(ONE_MINUTE);
      });

      it("Is reverted if the caller is not the multi sig wallet itself", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.configureExpirationTime(ONE_MINUTE)
        ).to.be.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_UNAUTHORIZED_CALLER
        );
      });
    });

    describe("Function 'receive()'", () => {
      describe("Executes as expected and emits the correct event when it is called indirectly with", () => {
        async function checkExecutionOfReceive(params: { value: number }) {
          const { wallet } = await setUpFixture(deployWallet);

          const txResponse = await user.sendTransaction({
            to: wallet.address,
            value: params.value,
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
        data: TX_DATA_STUB,
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
        ).to.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_UNAUTHORIZED_CALLER
        );
      });
    });

    describe("Function 'submitAndApprove()'", () => {
      const tx: TestTx = {
        id: 0,
        to: ADDRESS_STUB,
        value: TX_VALUE_STUB,
        data: TX_DATA_STUB,
      };

      it("Executes as expected and emits the correct events", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const txResponse: TransactionResponse = wallet
          .connect(owner1)
          .submitAndApprove(tx.to, tx.value, tx.data);

        await expect(txResponse)
          .to.emit(wallet, EVENT_NAME_SUBMIT)
          .withArgs(owner1.address, tx.id);
        await expect(txResponse)
          .to.emit(wallet, EVENT_NAME_APPROVE)
          .withArgs(owner1.address, tx.id);

        const actualTx = await wallet.getTransaction(tx.id);
        checkTxEquality(actualTx, tx);
        expect(await wallet.transactionCount()).to.eq(1);
        expect(await wallet.getApprovalStatus(tx.id, owner1.address)).to.eq(
          true
        );
      });

      it("Is reverted if it is called not by an owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.submitAndApprove(tx.to, tx.value, tx.data)
        ).to.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_UNAUTHORIZED_CALLER
        );
      });
    });

    describe("Function 'approve()'", () => {
      const tx: TestTx = {
        id: 0,
        to: ADDRESS_STUB,
        value: 0,
        data: TX_DATA_STUB,
      };

      it("Executes as expected and emits the correct event", async () => {
        let { wallet } = await setUpFixture(deployWallet);
        await proveTx(wallet.connect(owner1).submit(tx.to, tx.value, tx.data));
        expect(await wallet.getApprovalCount(tx.id)).to.eq(0);

        await expect(wallet.connect(owner1).approve(tx.id))
          .to.emit(wallet, EVENT_NAME_APPROVE)
          .withArgs(owner1.address, tx.id);

        expect(await wallet.getApprovalStatus(tx.id, owner1.address)).to.eq(
          true
        );

        await expect(wallet.connect(owner2).approve(tx.id))
          .to.emit(wallet, EVENT_NAME_APPROVE)
          .withArgs(owner2.address, tx.id);

        expect(await wallet.getApprovalStatus(tx.id, owner2.address)).to.eq(
          true
        );
        expect(await wallet.getApprovalCount(tx.id)).to.eq(2);
      });

      it("Is reverted if it is called not by an owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(wallet.approve(tx.id)).to.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_UNAUTHORIZED_CALLER
        );
      });

      it("Is reverted if the transaction does not exist", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.connect(owner1).approve(tx.id)
        ).to.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_TRANSACTION_DOES_NOT_EXIST
        );
      });

      it("Is reverted if the transaction is already executed", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data)
        );
        await proveTx(wallet.connect(owner2).approveAndExecute(tx.id));

        await expect(
          wallet.connect(owner3).approve(tx.id)
        ).to.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_EXECUTED
        );
      });

      it("Is reverted if the transaction is already approved by the same owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data)
        );

        await expect(
          wallet.connect(owner1).approve(tx.id)
        ).to.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_APPROVED
        );
      });
    });

    describe("Function 'approveAndExecute()'", () => {
      const tx: TestTx = {
        id: 0,
        to: ADDRESS_STUB,
        value: 0,
        data: TX_DATA_STUB,
      };

      it("Executes as expected and emits the correct events", async () => {
        let { wallet } = await setUpFixture(deployWallet);
        await proveTx(
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data)
        );
        expect(await wallet.getApprovalStatus(tx.id, owner1.address)).to.eq(
          true
        );

        const txResponse: TransactionResponse = await wallet
          .connect(owner2)
          .approveAndExecute(tx.id);
        await expect(txResponse)
          .to.emit(wallet, EVENT_NAME_APPROVE)
          .withArgs(owner2.address, tx.id);
        await expect(txResponse)
          .to.emit(wallet, EVENT_NAME_EXECUTE)
          .withArgs(owner2.address, tx.id);
        tx.executed = true;

        expect(await wallet.getApprovalStatus(tx.id, owner2.address)).to.eq(
          true
        );
        const actualTx = await wallet.getTransaction(tx.id);
        await checkTxEquality(actualTx, tx);
      });

      it("Is reverted if it is called not by an owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.approveAndExecute(tx.id)
        ).to.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_UNAUTHORIZED_CALLER
        );
      });

      it("Is reverted if the transaction does not exist", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.connect(owner1).approveAndExecute(tx.id)
        ).to.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_TRANSACTION_DOES_NOT_EXIST
        );
      });

      it("Is reverted if the transaction is already approved by the same owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data)
        );

        await expect(
          wallet.connect(owner1).approveAndExecute(tx.id)
        ).to.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_APPROVED
        );
      });

      it("Is reverted if the transaction is already executed", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data)
        );
        await proveTx(wallet.connect(owner2).approveAndExecute(tx.id));

        await expect(
          wallet.connect(owner3).approveAndExecute(tx.id)
        ).to.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_EXECUTED
        );
      });

      it("Is reverted if the transaction has not enough approvals", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(wallet.connect(owner1).submit(tx.to, tx.value, tx.data));

        await expect(
          wallet.connect(owner1).approveAndExecute(tx.id)
        ).to.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_TRANSACTION_HAS_NOT_ENOUGH_APPROVALS
        );
      });

      it("Is reverted if the internal transaction execution fails", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        tx.value = TX_VALUE_STUB;
        await proveTx(
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data)
        );

        await expect(wallet.connect(owner2).approveAndExecute(tx.id))
          .to.revertedWithCustomError(
            wallet,
            REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED
          )
          .withArgs(DEFAULT_ERROR_DATA);
      });
    });

    describe("Function 'execute()'", () => {
      const tx: TestTx = {
        id: 0,
        to: ADDRESS_STUB,
        value: 0,
        data: TX_DATA_STUB,
      };

      it("Executes as expected and emits the correct event", async () => {
        let { wallet } = await setUpFixture(deployWallet);
        await proveTx(
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data)
        );
        await proveTx(wallet.connect(owner2).approve(tx.id));

        await expect(wallet.connect(owner1).execute(tx.id))
          .to.emit(wallet, EVENT_NAME_EXECUTE)
          .withArgs(owner1.address, tx.id);
        tx.executed = true;

        const actualTx = await wallet.getTransaction(tx.id);
        await checkTxEquality(actualTx, tx);
      });

      it("Is reverted if it is called not by an owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(wallet.execute(tx.id)).to.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_UNAUTHORIZED_CALLER
        );
      });

      it("Is reverted if the transaction does not exist", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.connect(owner1).execute(tx.id)
        ).to.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_TRANSACTION_DOES_NOT_EXIST
        );
      });

      it("Is reverted if the transaction is already executed", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data)
        );
        await proveTx(wallet.connect(owner2).approveAndExecute(tx.id));

        await expect(
          wallet.connect(owner3).execute(tx.id)
        ).to.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_EXECUTED
        );
      });

      it("Is reverted if the transaction has not enough approvals", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data)
        );

        await expect(
          wallet.connect(owner1).execute(tx.id)
        ).to.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_TRANSACTION_HAS_NOT_ENOUGH_APPROVALS
        );
      });

      it("Is reverted if the internal transaction execution fails", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        tx.value = TX_VALUE_STUB;
        await proveTx(
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data)
        );
        await proveTx(wallet.connect(owner2).approve(tx.id));

        await expect(wallet.connect(owner1).execute(tx.id))
          .to.revertedWithCustomError(
            wallet,
            REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED
          )
          .withArgs(DEFAULT_ERROR_DATA);
      });
    });

    describe("Function 'revoke()'", () => {
      const tx: TestTx = {
        id: 0,
        to: ADDRESS_STUB,
        value: 0,
        data: TX_DATA_STUB,
      };

      it("Executes as expected and emits the correct event", async () => {
        let { wallet } = await setUpFixture(deployWallet);
        await proveTx(
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data)
        );
        expect(await wallet.getApprovalStatus(tx.id, owner1.address)).to.eq(
          true
        );

        await expect(wallet.connect(owner1).revoke(tx.id))
          .to.emit(wallet, EVENT_NAME_REVOKE)
          .withArgs(owner1.address, tx.id);

        expect(await wallet.getApprovalStatus(tx.id, owner1.address)).to.eq(
          false
        );
      });

      it("Is reverted if it is called not by an owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(wallet.revoke(tx.id)).to.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_UNAUTHORIZED_CALLER
        );
      });

      it("Is reverted if the transaction does not exist", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await expect(
          wallet.connect(owner1).revoke(tx.id)
        ).to.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_TRANSACTION_DOES_NOT_EXIST
        );
      });

      it("Is reverted if the transaction is already executed", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data)
        );
        await proveTx(wallet.connect(owner2).approveAndExecute(tx.id));

        await expect(
          wallet.connect(owner1).revoke(tx.id)
        ).to.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_TRANSACTION_IS_ALREADY_EXECUTED
        );
      });

      it("Is reverted if the transaction is not approved by the owner", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        await proveTx(
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data)
        );

        await expect(
          wallet.connect(owner2).revoke(tx.id)
        ).to.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_TRANSACTION_IS_NOT_APPROVED
        );
      });
    });

    describe("Functions 'getTransaction()' and 'getTransactions()'", () => {
      const txs: TestTx[] = [0, 1, 2, 3].map((id) => {
        return {
          id: id,
          to: ethers.utils.hexZeroPad(ethers.utils.hexValue(id + 1), 20),
          value: id,
          data: ethers.utils.hexlify(
            ethers.utils.toUtf8Bytes("Some data " + (id + 1))
          ),
        };
      });

      it("Execute as expected in different cases", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        for (let tx of txs) {
          await proveTx(
            wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data)
          );
        }
        await proveTx(wallet.connect(owner2).approveAndExecute(txs[0].id));
        txs[0].executed = true;

        expect(await wallet.transactionCount()).to.eq(txs.length);

        for (let tx of txs) {
          const actualTx = await wallet.getTransaction(tx.id);
          checkTxEquality(actualTx, tx);
        }

        if (network.name === "hardhat") {
          await expect(
            wallet.getTransaction(txs.length)
          ).to.revertedWithCustomError(
            wallet,
            REVERT_ERROR_IF_TRANSACTION_DOES_NOT_EXIST
          );
        } else {
          await expect(wallet.getTransaction(txs.length)).to.reverted;
        }

        let actualTxs: any[];

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
        data: TX_DATA_STUB,
      };

      async function wait(timeoutInSeconds: number) {
        if (network.name === "hardhat") {
          // A virtual wait through network time shifting
          await time.increase(timeoutInSeconds);
        } else {
          // A real wait through a promise
          const timeoutInMills = timeoutInSeconds * 1000;
          await new Promise((resolve) => setTimeout(resolve, timeoutInMills));
        }
      }

      async function executeWalletTx(params: {
        wallet: Contract;
        txData: string;
        txId?: number;
      }): Promise<number> {
        const { wallet, txData } = params;
        const txId = params.txId || 0;
        await proveTx(
          wallet.connect(owner1).submitAndApprove(wallet.address, txId, txData)
        );
        await proveTx(wallet.connect(owner2).approveAndExecute(txId));
        return txId + 1;
      }

      it("Submission of a transaction sets the cooldown and expiration fields properly", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const txData = encodeConfigureCooldownTimeFunctionData(ONE_MINUTE);
        const txId = await executeWalletTx({ wallet, txData });

        const txReceipt = await proveTx(
          wallet.connect(owner1).submit(tx.to, tx.value, tx.data)
        );

        const txStruct = await wallet.getTransaction(txId);
        const block = await wallet.provider.getBlock(txReceipt.blockNumber);
        const blockTimestamp: number = block.timestamp;
        expect(txStruct.cooldown).to.eq(blockTimestamp + ONE_MINUTE);
        expect(txStruct.expiration).to.eq(
          blockTimestamp + ONE_MINUTE + ONE_YEAR
        );
      });

      it("Execution of a transaction is reverted if the transaction is still on the cooldown", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const txData = encodeConfigureCooldownTimeFunctionData(ONE_MINUTE);
        const txId = await executeWalletTx({ wallet, txData });

        await proveTx(
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data)
        );

        await expect(
          wallet.connect(owner2).approveAndExecute(txId)
        ).to.be.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_TRANSACTION_ON_COOLDOWN
        );
      });

      it("Approval of a transaction is reverted if the transaction is already expired", async () => {
        const { wallet } = await setUpFixture(deployWallet);
        const txData =
          encodeConfigureExpirationTimeTimeFunctionData(ONE_SECOND);
        const txId = await executeWalletTx({ wallet, txData });

        await proveTx(
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data)
        );
        await wait(2 * ONE_SECOND);
        await expect(
          wallet.connect(owner2).approve(txId)
        ).to.be.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_TRANSACTION_EXPIRED
        );
      });

      async function prepareExecutionWithSingleApproval(): Promise<{
        wallet: Contract;
        txId: number;
      }> {
        const { wallet } = await setUpFixture(deployWallet);

        // Set only one required approval
        const requiredApprovals = 1;
        let txData = encodeConfigureOwnersFunctionData(
          ownerAddresses,
          requiredApprovals
        );
        let txId = await executeWalletTx({ wallet, txData });

        // Set the new expiration time
        txData = encodeConfigureExpirationTimeTimeFunctionData(ONE_SECOND);
        await proveTx(
          wallet.connect(owner1).submitAndApprove(wallet.address, 0, txData)
        );
        await proveTx(wallet.connect(owner1).execute(txId));

        ++txId;
        return { wallet, txId };
      }

      it("Execution of a transaction is reverted if the transaction is already expired", async () => {
        const { wallet, txId } = await prepareExecutionWithSingleApproval();
        await proveTx(
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data)
        );
        await wait(2 * ONE_SECOND);
        await expect(
          wallet.connect(owner1).execute(txId)
        ).to.be.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_TRANSACTION_EXPIRED
        );
      });

      it("Revocation of a transaction is reverted if the transaction is already expired", async () => {
        const { wallet, txId } = await prepareExecutionWithSingleApproval();

        await proveTx(
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data)
        );
        await wait(2 * ONE_SECOND);
        await expect(
          wallet.connect(owner1).revoke(txId)
        ).to.be.revertedWithCustomError(
          wallet,
          REVERT_ERROR_IF_TRANSACTION_EXPIRED
        );
      });
    });

    describe("Scenarios with sending transactions to another contract", () => {
      async function beforeExecution(params: {
        functionName: string;
        txValue: number;
      }): Promise<{
        wallet: Contract;
        testContractMock: Contract;
        tx: TestTx;
        amount: number;
      }> {
        const { wallet, testContractMock } = await setUpFixture(
          deployAllContracts
        );
        const tokenInterface = new ethers.utils.Interface([
          `function ${params.functionName}(uint256 amount)`,
        ]);
        const amount = 234;
        const tx: TestTx = {
          id: 0,
          to: testContractMock.address,
          value: params.txValue,
          data: tokenInterface.encodeFunctionData(params.functionName, [
            amount,
          ]),
        };
        await proveTx(
          wallet.connect(owner1).submitAndApprove(tx.to, tx.value, tx.data)
        );

        return {
          wallet,
          testContractMock,
          tx,
          amount,
        };
      }

      describe("Function 'approveAndExecute()' sends a transaction as expected if", () => {
        it("The function of another contract exists and other conditions are met", async () => {
          const { wallet, testContractMock, tx, amount } =
            await beforeExecution({
              functionName: "testFunction",
              txValue: TX_VALUE_STUB,
            });
          await proveTx(
            owner2.sendTransaction({
              to: wallet.address,
              value: tx.value,
            })
          );

          const txResponse: TransactionResponse = await wallet
            .connect(owner2)
            .approveAndExecute(tx.id);
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
            txValue: 0,
          });

          await expect(wallet.connect(owner2).approveAndExecute(tx.id))
            .to.revertedWithCustomError(
              wallet,
              REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED
            )
            .withArgs(DEFAULT_ERROR_DATA);
        });

        it("The function of another contract is reverted during execution", async () => {
          const { wallet, testContractMock, tx } = await beforeExecution({
            functionName: "testFunction",
            txValue: 0,
          });
          await proveTx(testContractMock.disable());

          await expect(wallet.connect(owner2).approveAndExecute(tx.id))
            .to.revertedWithCustomError(
              wallet,
              REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED
            )
            .withArgs(
              testContractMock.interface.encodeErrorResult("TestError", [
                "Contract is disabled",
              ])
            );
        });

        it("The wallet has not enough balance of the native tokens", async () => {
          const { wallet, tx } = await beforeExecution({
            functionName: "testFunction",
            txValue: TX_VALUE_STUB,
          });
          await proveTx(
            owner2.sendTransaction({
              to: wallet.address,
              value: tx.value - 1,
            })
          );

          await expect(wallet.connect(owner2).approveAndExecute(tx.id))
            .to.revertedWithCustomError(
              wallet,
              REVERT_ERROR_IF_INTERNAL_TRANSACTION_IS_FAILED
            )
            .withArgs(DEFAULT_ERROR_DATA);
        });
      });
    });
  });
});
