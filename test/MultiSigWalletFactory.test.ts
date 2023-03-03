import { ethers, network } from "hardhat";
import { expect } from "chai";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

async function setUpFixture(func: any) {
  if (network.name === "hardhat") {
    return loadFixture(func);
  } else {
    return func();
  }
}

describe("Contract 'MultisigWalletFactory'", () => {
  const REQUIRED_APPROVALS = 2;
  const ONE_YEAR = 3600 * 24 * 365;

  const EVENT_NAME_NEW_WALLET_DEPLOYED_BY_FACTORY = "NewWallet";

  const REVERT_ERROR_IF_DUPLICATE_OWNER_ADDRESS = "DuplicateOwnerAddress";
  const REVERT_ERROR_IF_EMPTY_OWNERS_ARRAY = "EmptyOwnersArray";
  const REVERT_ERROR_IF_INVALID_REQUIRED_APPROVALS = "InvalidRequiredApprovals";
  const REVERT_ERROR_IF_ZERO_OWNER_ADDRESS = "ZeroOwnerAddress";


  let walletFactory: ContractFactory;
  let factoryContractFactory: ContractFactory;

  let deployer: SignerWithAddress;
  let owner1: SignerWithAddress;
  let owner2: SignerWithAddress;
  let owner3: SignerWithAddress;


  let ownerAddresses: string[];

  before(async () => {
    [deployer, owner1, owner2, owner3] = await ethers.getSigners();
    ownerAddresses = [owner1.address, owner2.address, owner3.address];
    walletFactory = await ethers.getContractFactory("MultiSigWallet");
    factoryContractFactory = await ethers.getContractFactory(
      "MultiSigWalletFactory"
    );
  });

  async function deployFactory(): Promise<{ factory: Contract }> {
    const factory = await factoryContractFactory.deploy();
    await factory.deployed();
    return {
      factory,
    };
  }

  describe("Function 'deployNewWallet()'", () => {
    it("Creates new wallet instance with selected parameters", async () => {
      const { factory } = await setUpFixture(deployFactory);

      await expect(
        await factory.deployNewWallet(ownerAddresses, REQUIRED_APPROVALS)
      ).to.emit(factory, EVENT_NAME_NEW_WALLET_DEPLOYED_BY_FACTORY);

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
        REVERT_ERROR_IF_EMPTY_OWNERS_ARRAY
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
        REVERT_ERROR_IF_ZERO_OWNER_ADDRESS
      );
    });

    it("Deployment is reverted if there is a duplicate address in the input owner array", async () => {
      const { factory } = await setUpFixture(deployFactory);
      const ownerAddressArray = [
        ownerAddresses[0],
        ownerAddresses[1],
        ownerAddresses[0]
      ];
      const requiredApprovals = ownerAddresses.length - 1;
      await expect(
        factory.deployNewWallet(ownerAddressArray, requiredApprovals)
      ).to.be.revertedWithCustomError(
        walletFactory,
        REVERT_ERROR_IF_DUPLICATE_OWNER_ADDRESS
      );
    });
  });

  describe("Function 'getWalletsCount()'", async () => {
    it("Returns the amount of deployed wallets", async () => {
      const { factory } = await setUpFixture(deployFactory);

      expect(await factory.walletsCount()).to.eq(0);
      await factory.deployNewWallet(ownerAddresses, REQUIRED_APPROVALS);
      expect(await factory.walletsCount()).to.eq(1);
    });
  });
});
