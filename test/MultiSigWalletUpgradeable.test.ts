import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { Contract, ContractFactory } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { connect, getAddress, proveTx } from "../test-utils/eth";
import { setUpFixture } from "../test-utils/common";

describe("Contract 'MultiSigWalletUpgradeable'", () => {
  const ADDRESS_ZERO = ethers.ZeroAddress;
  const REQUIRED_APPROVALS = 2;
  const DEFAULT_EXPIRATION_TIME = 3600 * 24 * 10;

  const REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED = "Initializable: contract is already initialized";

  const ERROR_NAME_IF_DUPLICATE_OWNER_ADDRESS = "DuplicateOwnerAddress";
  const ERROR_NAME_IF_EMPTY_OWNERS_ARRAY = "EmptyOwnersArray";
  const ERROR_NAME_IF_INVALID_REQUIRED_APPROVALS = "InvalidRequiredApprovals";
  const ERROR_NAME_IF_ZERO_OWNER_ADDRESS = "ZeroOwnerAddress";
  const ERROR_NAME_UNAUTHORIZED_CALLER = "UnauthorizedCaller";

  let walletUpgradeableFactory: ContractFactory;
  let walletFactory: ContractFactory;

  let owner1: HardhatEthersSigner;
  let owner2: HardhatEthersSigner;
  let owner3: HardhatEthersSigner;

  let ownerAddresses: string[];

  before(async () => {
    [, owner1, owner2, owner3] = await ethers.getSigners();
    ownerAddresses = [owner1.address, owner2.address, owner3.address];
    walletUpgradeableFactory = await ethers.getContractFactory("MultiSigWalletUpgradeable");
    walletFactory = await ethers.getContractFactory("MultiSigWallet");
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

  async function deployWalletUpgradeable(): Promise<{ wallet: Contract }> {
    const wallet =
      await upgrades.deployProxy(walletUpgradeableFactory, [ownerAddresses, REQUIRED_APPROVALS]) as Contract;
    await wallet.waitForDeployment();

    return {
      wallet
    };
  }

  async function deployWalletImplementation(): Promise<{
    walletImplementation: Contract;
  }> {
    const walletImplementation =
      await walletFactory.deploy(ownerAddresses, REQUIRED_APPROVALS) as Contract;
    await walletImplementation.waitForDeployment();

    return {
      walletImplementation
    };
  }

  async function deployAllContracts(): Promise<{
    wallet: Contract;
    walletImplementation: Contract;
  }> {
    const { wallet } = await deployWalletUpgradeable();
    const { walletImplementation } = await deployWalletImplementation();

    return {
      wallet,
      walletImplementation
    };
  }

  function encodeUpgradeFunctionData(newImplementationAddress: string) {
    const ABI = ["function upgradeTo(address newImplementation)"];
    const upgradeInterface = new ethers.Interface(ABI);
    return upgradeInterface.encodeFunctionData(
      "upgradeTo",
      [newImplementationAddress]
    );
  }

  describe("Function 'initialize()'", () => {
    it("Configures the contract as expected", async () => {
      const { wallet } = await setUpFixture(deployWalletUpgradeable);

      expect(await wallet.owners()).to.deep.eq(ownerAddresses);
      expect(await wallet.requiredApprovals()).to.eq(REQUIRED_APPROVALS);
      expect(await wallet.transactionCount()).to.eq(0);
      expect(await wallet.cooldownTime()).to.eq(0);
      expect(await wallet.expirationTime()).to.eq(DEFAULT_EXPIRATION_TIME);
      await checkOwnership(wallet, {
        ownerAddresses,
        expectedOwnershipStatus: true
      });
    });

    it("Is reverted if it is called a second time", async () => {
      const { wallet } = await setUpFixture(deployWalletUpgradeable);
      await expect(
        wallet.initialize(ownerAddresses, REQUIRED_APPROVALS)
      ).to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
    });

    it("Is reverted if the input owner array is empty", async () => {
      const uninitializedWallet =
        await upgrades.deployProxy(walletUpgradeableFactory, [], { initializer: false }) as Contract;
      await expect(
        uninitializedWallet.initialize([], 0)
      ).to.be.revertedWithCustomError(walletUpgradeableFactory, ERROR_NAME_IF_EMPTY_OWNERS_ARRAY);
    });

    it("Is reverted if the input number of required approvals is zero", async () => {
      const uninitializedWallet =
        await upgrades.deployProxy(walletUpgradeableFactory, [], { initializer: false }) as Contract;
      const requiredApprovals = 0;
      await expect(
        uninitializedWallet.initialize(ownerAddresses, requiredApprovals)
      ).to.be.revertedWithCustomError(walletUpgradeableFactory, ERROR_NAME_IF_INVALID_REQUIRED_APPROVALS);
    });

    it("Is reverted if the number of required approvals exceeds the length of the owner array", async () => {
      const uninitializedWallet =
        await upgrades.deployProxy(walletUpgradeableFactory, [], { initializer: false }) as Contract;
      const requiredApprovals = ownerAddresses.length + 1;
      await expect(
        uninitializedWallet.initialize(ownerAddresses, requiredApprovals)
      ).to.be.revertedWithCustomError(walletUpgradeableFactory, ERROR_NAME_IF_INVALID_REQUIRED_APPROVALS);
    });

    it("Is reverted if one of the input owners is the zero address", async () => {
      const uninitializedWallet =
        await upgrades.deployProxy(walletUpgradeableFactory, [], { initializer: false }) as Contract;
      const ownerAddressArray = [ownerAddresses[0], ownerAddresses[1], ADDRESS_ZERO];
      const requiredApprovals = ownerAddressArray.length - 1;
      await expect(
        uninitializedWallet.initialize(ownerAddressArray, requiredApprovals)
      ).to.be.revertedWithCustomError(walletUpgradeableFactory, ERROR_NAME_IF_ZERO_OWNER_ADDRESS);
    });

    it("Is reverted if there is a duplicate address in the input owner array", async () => {
      const uninitializedWallet =
        await upgrades.deployProxy(walletUpgradeableFactory, [], { initializer: false }) as Contract;
      const ownerAddressArray = [ownerAddresses[0], ownerAddresses[1], ownerAddresses[0]];
      const requiredApprovals = ownerAddresses.length - 1;
      await expect(
        uninitializedWallet.initialize(ownerAddressArray, requiredApprovals)
      ).to.be.revertedWithCustomError(walletUpgradeableFactory, ERROR_NAME_IF_DUPLICATE_OWNER_ADDRESS);
    });

    it("Is reverted for the contract implementation if it is called even for the first time", async () => {
      const wallet = await walletUpgradeableFactory.deploy() as Contract;
      await wallet.waitForDeployment();

      await expect(
        wallet.initialize(ownerAddresses, REQUIRED_APPROVALS)
      ).to.be.revertedWith(REVERT_MESSAGE_IF_CONTRACT_IS_ALREADY_INITIALIZED);
    });
  });

  describe("Scenarios with contract upgrades", () => {
    it("Upgrade is executed as expected when it is called by the wallet itself", async () => {
      const { wallet } = await setUpFixture(deployAllContracts);

      const newImplementation = await walletUpgradeableFactory.deploy([]) as Contract;
      await newImplementation.waitForDeployment();

      const oldImplementationAddress: string = await upgrades.erc1967.getImplementationAddress(getAddress(wallet));
      expect(oldImplementationAddress).not.to.be.equal(getAddress(newImplementation));

      await proveTx(connect(wallet, owner1).submitAndApprove(
        getAddress(wallet), // to
        0, // value
        encodeUpgradeFunctionData(getAddress(newImplementation)) // data
      ));
      await proveTx(connect(wallet, owner2).approveAndExecute(0));

      const newImplementationAddress: string = await upgrades.erc1967.getImplementationAddress(getAddress(wallet));
      expect(newImplementationAddress).to.be.equal(getAddress(newImplementation));
    });

    it("Upgrade is reverted if caller is not a multisig", async () => {
      const { wallet } = await setUpFixture(deployAllContracts);

      await expect(
        wallet.upgradeTo(getAddress(wallet))
      ).to.be.revertedWithCustomError(wallet, ERROR_NAME_UNAUTHORIZED_CALLER);
    });
  });
});
