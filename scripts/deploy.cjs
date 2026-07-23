const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const { chainId, name } = await hre.ethers.provider.getNetwork();

  console.log(`Network:  ${name} (chainId ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${hre.ethers.formatEther(balance)}\n`);

  if (balance === 0n) {
    throw new Error("Deployer has zero balance on this network — fund it first.");
  }

  const Multisender = await hre.ethers.getContractFactory("Multisender");
  const multisender = await Multisender.deploy();
  await multisender.waitForDeployment();

  const address = await multisender.getAddress();
  console.log(`Multisender deployed: ${address}`);
  console.log(`\nAdd to src/contract.js MULTISENDER_ADDRESSES:`);
  console.log(`  ${chainId}: "${address}",`);
  console.log(`\nVerify with:`);
  console.log(`  npx hardhat verify --network ${hre.network.name} ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
