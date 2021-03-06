import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { IStrategy__factory } from "../typechain";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { PieDaoEnvironmentBuilder } from "../src/piedao";
import { EnsoBuilder } from "@enso/contracts";
import { DEPOSIT_SLIPPAGE, INITIAL_STATE, UNISWAP_V2_ROUTER } from "../src/constants";
import { setupStrategyItems, estimateTokens, encodeStrategyData, increaseTime } from "../src/utils";

describe("PieDao: Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    this.signers.admin = signers[10];

    this.enso = await new EnsoBuilder(this.signers.admin).mainnet().build();

    this.pieDaoEnv = await new PieDaoEnvironmentBuilder(this.signers.default).connect();
    this.pieDaoTokens = await this.pieDaoEnv.pool.getTokens();

    const liquidityMigrationBuilder = new LiquidityMigrationBuilder(this.signers.admin, this.enso);
    liquidityMigrationBuilder.addAdapter(AcceptedProtocols.PieDao, this.pieDaoEnv.adapter);
    await liquidityMigrationBuilder.deploy();

    this.liquidityMigration = liquidityMigrationBuilder.liquidityMigration;
  });

  it("Token holder should be able to stake LP token", async function () {
    const pool = this.pieDaoEnv.pool;

    const tx = await this.pieDaoEnv.adapter.connect(this.signers.default).add(pool.address);
    await tx.wait();

    const holder = this.pieDaoEnv.holders[0];
    const holderAddress = await holder.getAddress();
    const holderBalance = await pool.balanceOf(holderAddress);
    expect(holderBalance).to.be.gt(BigNumber.from(0));
    await pool.connect(holder).approve(this.liquidityMigration.address, holderBalance);

    const totalSupply = await pool.totalSupply();
    console.log("Holder percent:", holderBalance.mul(1000).div(totalSupply).toString());

    await this.liquidityMigration
      .connect(holder)
      .stake(pool.address, holderBalance, this.pieDaoEnv.adapter.address);
    expect(await this.liquidityMigration.staked(holderAddress, pool.address)).to.equal(holderBalance);
  });

  it("Create strategy", async function () {
    // deploy strategy
    const pool = this.pieDaoEnv.pool;
    const strategyData = encodeStrategyData(
      this.signers.default.address,
      "PieDao",
      "PIE",
      await setupStrategyItems(
        this.enso.platform.oracles.ensoOracle,
        this.enso.adapters.uniswap.contract.address,
        await pool.getBPool(),
        this.pieDaoTokens,
      ),
      INITIAL_STATE,
      ethers.constants.AddressZero,
      "0x",
    );
    const tx = await this.liquidityMigration.createStrategy(pool.address, this.pieDaoEnv.adapter.address, strategyData);
    const receipt = await tx.wait();
    const strategyAddress = receipt.events.find((ev: Event) => ev.event === "Created").args.strategy;
    console.log("Strategy address: ", strategyAddress);
    this.strategy = IStrategy__factory.connect(strategyAddress, this.signers.default);
  });

  it("Should migrate tokens to strategy", async function () {
    const pool = this.pieDaoEnv.pool;
    const holder = this.pieDaoEnv.holders[0];
    const holderAddress = await holder.getAddress();
    // Migrate
    await increaseTime(10)
    await this.liquidityMigration
      .connect(holder)
      ["migrate(address,address,address,uint256)"](pool.address, this.pieDaoEnv.adapter.address, this.strategy.address, DEPOSIT_SLIPPAGE);
    const [total] = await estimateTokens(
      this.enso.platform.oracles.ensoOracle,
      this.strategy.address,
      this.pieDaoTokens
    );
    expect(total).to.gt(0);
    expect(await this.strategy.balanceOf(holderAddress)).to.gt(0);
  });

  it("Getting the output token list", async function () {
    const underlyingTokens = await this.pieDaoEnv.pool.getTokens();
    const outputTokens = await this.pieDaoEnv.adapter.outputTokens(this.pieDaoEnv.pool.address);
    expect(underlyingTokens).to.be.eql(outputTokens);
  });

  it("Should buy and stake", async function () {
    const defaultAddress = await this.signers.default.getAddress();

    expect(await this.pieDaoEnv.pool.balanceOf(defaultAddress)).to.be.eq(BigNumber.from(0));
    expect(await this.strategy.balanceOf(defaultAddress)).to.be.eq(BigNumber.from(0));
    expect(await this.liquidityMigration.staked(defaultAddress, this.pieDaoEnv.pool.address)).to.be.eq(
      BigNumber.from(0),
    );

    const ethAmount = ethers.constants.WeiPerEther;
    const expectedAmount = await this.pieDaoEnv.adapter.callStatic.getAmountOut(
      this.pieDaoEnv.pool.address,
      UNISWAP_V2_ROUTER,
      ethAmount,
    );
    console.log("Expected: ", expectedAmount.toString());

    await this.liquidityMigration.connect(this.signers.default).buyAndStake(
      this.pieDaoEnv.pool.address,
      this.pieDaoEnv.adapter.address,
      UNISWAP_V2_ROUTER,
      expectedAmount.mul(995).div(1000), //0.5% slippage
      ethers.constants.MaxUint256,
      { value: ethAmount },
    );

    const staked = await this.liquidityMigration.staked(defaultAddress, this.pieDaoEnv.pool.address);
    console.log("Staked: ", staked.toString());
    expect(staked).to.be.gt(BigNumber.from(0));
  });
});
