// Read-only signer check. Run this BEFORE any deploy or state-changing task.
//
// Why: a past opBNB deploy in this repo signed a real mainnet transaction from
// a funded wallet even though .env PRIVATE_KEY was empty. Never assume a
// "dry run" is safe — confirm which address hardhat resolved, and its balance,
// before spending anything.
//
//   npx hardhat run scripts/whoami.cjs --network robinhood
const hre = require("hardhat");

async function main() {
  const { chainId } = await hre.ethers.provider.getNetwork();
  const signers = await hre.ethers.getSigners();

  console.log(`Network:   ${hre.network.name} (chainId ${chainId})`);
  console.log(`RPC:       ${hre.network.config.url || "(in-process)"}`);
  console.log(`Signers:   ${signers.length}`);

  if (signers.length === 0) {
    console.log("\nNo signer configured — PRIVATE_KEY is unset or invalid.");
    return;
  }

  for (const s of signers) {
    const bal = await hre.ethers.provider.getBalance(s.address);
    const nonce = await hre.ethers.provider.getTransactionCount(s.address);
    console.log(`\n  address: ${s.address}`);
    console.log(`  balance: ${hre.ethers.formatEther(bal)} ETH`);
    console.log(`  nonce:   ${nonce}`);
  }

  const gasPrice = (await hre.ethers.provider.getFeeData()).gasPrice;
  console.log(`\nGas price: ${hre.ethers.formatUnits(gasPrice ?? 0n, "gwei")} gwei`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
