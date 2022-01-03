const { ethers, network } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");

use(solidity);

describe("Eth Pool", function () {
  // quick fix to let gas reporter fetch data from gas station & coinmarketcap
  before((done) => {
    setTimeout(done, 2000);
  });

  describe("stake()", function () {
    let deployer, alice, ethPool, accountingToken;

    before(async () => {
      [deployer, alice] = await ethers.getSigners();

      const EthPoolFactory = await ethers.getContractFactory(
        "EthPool",
        deployer
      );
      const AccountingTokenFactory = await ethers.getContractFactory(
        "AccountingToken",
        deployer
      );

      ethPool = await EthPoolFactory.deploy();
      accountingToken = await AccountingTokenFactory.attach(
        await ethPool.accToken()
      );
    });
    it("User should be able to stake Eth", async function () {
      await ethPool
        .connect(alice)
        .stake({ value: ethers.utils.parseEther("3") });
      expect(
        ethers.utils.formatEther(await accountingToken.balanceOf(alice.address))
      ).to.be.eq("3.0");
    });
  });

  describe("depositRewards()", function () {
    let deployer, alice, bob, ethPool, accountingToken;

    beforeEach(async () => {
      await network.provider.send("hardhat_reset");
      [deployer, alice, bob] = await ethers.getSigners();

      const EthPoolFactory = await ethers.getContractFactory(
        "EthPool",
        deployer
      );
      const AccountingTokenFactory = await ethers.getContractFactory(
        "AccountingToken",
        deployer
      );

      ethPool = await EthPoolFactory.deploy();
      accountingToken = await AccountingTokenFactory.attach(
        await ethPool.accToken()
      );

      await ethPool
        .connect(alice)
        .stake({ value: ethers.utils.parseEther("3") });
    });

    it("Admin is able to deposit rewards", async function () {
      await ethPool
        .connect(deployer)
        .depositRewards({ value: ethers.utils.parseEther("10") });
      expect(
        ethers.utils.formatEther(
          await ethers.provider.getBalance(ethPool.address)
        )
      ).to.be.eq("13.0");
    });

    it("Non-Admin is not able to deposit rewards", async function () {
      await expect(
        ethPool
          .connect(bob)
          .depositRewards({ value: ethers.utils.parseEther("10") })
      ).to.be.reverted;
    });
  });

  describe("withdraw()", function () {
    let deployer, alice, bob, charlie, ethPool, accountingToken;
    let aliceOrigBalance, bobOrigBalance;

    beforeEach(async () => {
      await network.provider.send("hardhat_reset");
      [deployer, alice, bob, charlie] = await ethers.getSigners();

      const EthPoolFactory = await ethers.getContractFactory(
        "EthPool",
        deployer
      );
      const AccountingTokenFactory = await ethers.getContractFactory(
        "AccountingToken",
        deployer
      );

      ethPool = await EthPoolFactory.deploy();
      accountingToken = await AccountingTokenFactory.attach(
        await ethPool.accToken()
      );

      aliceOrigBalance = await ethers.provider.getBalance(alice.address);
      bobOrigBalance = await ethers.provider.getBalance(bob.address);
      charlieOrigBalance = await ethers.provider.getBalance(charlie.address);
    });

    it("calculates appropriate rewards", async function () {
      await ethPool
        .connect(alice)
        .stake({ value: ethers.utils.parseEther("3") });
      await ethPool.connect(bob).stake({ value: ethers.utils.parseEther("2") });
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 days
      await ethPool
        .connect(deployer)
        .depositRewards({ value: ethers.utils.parseEther("5") });
      await ethPool.connect(alice).withdraw();
      await ethPool.connect(bob).withdraw();
      const aliceNewBalance = await ethers.provider.getBalance(alice.address);
      const bobNewBalance = await ethers.provider.getBalance(bob.address);

      // The rewards should be just less than 3 ethers(considering gas fees)
      let delta = aliceNewBalance
        .sub(aliceOrigBalance)
        .sub(ethers.utils.parseEther("3"));
      expect(delta.abs()).to.be.lt(ethers.utils.parseUnits("1", 16));

      delta = bobNewBalance
        .sub(bobOrigBalance)
        .sub(ethers.utils.parseEther("2"));
      expect(delta.abs()).to.be.lt(ethers.utils.parseUnits("1", 16));
    });

    it("doesn't reward user who deposit later", async function () {
      await ethPool
        .connect(alice)
        .stake({ value: ethers.utils.parseEther("3") });
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 days
      await ethPool
        .connect(deployer)
        .depositRewards({ value: ethers.utils.parseEther("5") });
      // bob deposits one day later
      await ethers.provider.send("evm_increaseTime", [1 * 24 * 60 * 60]); // 7 days
      await ethPool.connect(bob).stake({ value: ethers.utils.parseEther("2") });
      await ethPool.connect(alice).withdraw();
      await ethPool.connect(bob).withdraw();
      const aliceNewBalance = await ethers.provider.getBalance(alice.address);
      const bobNewBalance = await ethers.provider.getBalance(bob.address);

      // The rewards should be just less than 5 ethers(considering gas fees)
      let delta = aliceNewBalance
        .sub(aliceOrigBalance)
        .sub(ethers.utils.parseEther("5"));
      expect(delta.abs()).to.be.lt(ethers.utils.parseUnits("1", 16));

      delta = bobNewBalance.sub(bobOrigBalance);
      expect(delta.abs()).to.be.lt(ethers.utils.parseUnits("1", 16));
    });

    it("generates cummulative rewards", async function () {
      await ethPool
        .connect(alice)
        .stake({ value: ethers.utils.parseEther("3") });
      await ethPool.connect(bob).stake({ value: ethers.utils.parseEther("2") });
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 days
      await ethPool
        .connect(deployer)
        .depositRewards({ value: ethers.utils.parseEther("5") });
      // move forward 1 days.
      await ethers.provider.send("evm_increaseTime", [1 * 24 * 60 * 60]); // 1 days
      await ethPool
        .connect(charlie)
        .stake({ value: ethers.utils.parseEther("5") });

      // move forward 6 days.
      await ethers.provider.send("evm_increaseTime", [6 * 24 * 60 * 60]); // 6 days
      await ethPool
        .connect(deployer)
        .depositRewards({ value: ethers.utils.parseEther("10") });

      // withdraw for each users.
      await ethPool.connect(alice).withdraw();
      await ethPool.connect(bob).withdraw();
      await ethPool.connect(charlie).withdraw();

      const aliceNewBalance = await ethers.provider.getBalance(alice.address);
      const bobNewBalance = await ethers.provider.getBalance(bob.address);
      const charlieNewBalance = await ethers.provider.getBalance(
        charlie.address
      );

      // The rewards accumulated over 2 rounds and should be just less than 6 ethers(considering gas fees)
      let delta = aliceNewBalance
        .sub(aliceOrigBalance)
        .sub(ethers.utils.parseEther("6"));
      expect(delta.abs()).to.be.lt(ethers.utils.parseUnits("1", 16));

      // The rewards accumulated over 2 rounds and should be just less than 4 ethers(considering gas fees)
      delta = bobNewBalance
        .sub(bobOrigBalance)
        .sub(ethers.utils.parseEther("4"));
      expect(delta.abs()).to.be.lt(ethers.utils.parseUnits("1", 16));

      // The rewards accumulated for one round.
      // The rewards accumulated over 2 rounds and should be just less than 4 ethers(considering gas fees)
      delta = charlieNewBalance
        .sub(charlieOrigBalance)
        .sub(ethers.utils.parseEther("5"));
      expect(delta.abs()).to.be.lt(ethers.utils.parseUnits("1", 16));
    });

    it("raises error on withdraw twice", async () => {
      await ethPool
        .connect(alice)
        .stake({ value: ethers.utils.parseEther("3") });
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 days
      await ethPool
        .connect(deployer)
        .depositRewards({ value: ethers.utils.parseEther("5") });
      // bob deposits one day later
      await ethers.provider.send("evm_increaseTime", [1 * 24 * 60 * 60]); // 7 days
      await ethPool.connect(alice).withdraw();

      await expect(ethPool.connect(alice).withdraw()).to.be.reverted;
    });
  });

  describe("totalStaked()", function () {
    beforeEach(async () => {
      await network.provider.send("hardhat_reset");
      [deployer, alice, bob] = await ethers.getSigners();

      const EthPoolFactory = await ethers.getContractFactory(
        "EthPool",
        deployer
      );
      const AccountingTokenFactory = await ethers.getContractFactory(
        "AccountingToken",
        deployer
      );

      ethPool = await EthPoolFactory.deploy();
      accountingToken = await AccountingTokenFactory.attach(
        await ethPool.accToken()
      );
    });

    it("calculates correct stake value", async function () {
      await ethPool
        .connect(alice)
        .stake({ value: ethers.utils.parseEther("3") });
      await ethPool.connect(bob).stake({ value: ethers.utils.parseEther("2") });
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 days
      await ethPool
        .connect(deployer)
        .depositRewards({ value: ethers.utils.parseEther("5") });

      expect(await ethPool.totalStaked()).to.be.eq(
        ethers.utils.parseEther("5")
      );
    });

    it("calculates correct stake value after withdraw", async function () {
      await ethPool
        .connect(alice)
        .stake({ value: ethers.utils.parseEther("3") });
      await ethPool.connect(bob).stake({ value: ethers.utils.parseEther("2") });
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 days
      await ethPool
        .connect(deployer)
        .depositRewards({ value: ethers.utils.parseEther("5") });
      await ethPool.connect(alice).withdraw();

      expect(await ethPool.totalStaked()).to.be.eq(
        ethers.utils.parseEther("2")
      );
    });
  });
});
