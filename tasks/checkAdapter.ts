import { task } from "hardhat/config";
import { CHECK_ADAPTER } from "./task-names";
import { getOwner } from "./whitelistStrategy";
const LIQUIDITY_FRAGMENT = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_adapter",
        type: "address",
      },
    ],
    name: "adapters",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

task(CHECK_ADAPTER, "Check Adapter")
  .addParam("adapterAddress", "Adapter address")
  .addParam("migrationAddress", "Migration Contract")
  .setAction(async ({ adapterAddress, migrationAddress }, hre) => {
    const owner = await getOwner(hre);
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [owner],
    });
    const secondSigner = await hre.ethers.getSigner(owner);
    const liquidityMigrationContract = await new hre.ethers.Contract(
      migrationAddress,
      LIQUIDITY_FRAGMENT,
      secondSigner,
    );
    const isAdapter = await liquidityMigrationContract.adapters(adapterAddress);
    console.log(`${adapterAddress} is${isAdapter ? "" : "not"} an adapter`);
  });
