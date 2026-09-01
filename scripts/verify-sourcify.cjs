// Verify a deployed contract on Sourcify (v2 API).
//
// Why this exists: @nomicfoundation/hardhat-verify 2.x still calls Sourcify's
// retired v1 endpoints, so `hardhat verify` with `sourcify: { enabled: true }`
// fails with an HTML parse error. This talks to the v2 API directly.
//
// Use it for chains Etherscan V2 does not cover — Robinhood Chain (4663) is
// the case this was written for, where the Blockscout explorer is also
// TLS-blocked on some networks.
//
//   node scripts/verify-sourcify.cjs <address> [creationTxHash]
//   node scripts/verify-sourcify.cjs <address> <creationTxHash> --chain 4663
//
// Reads the standard-JSON input straight out of artifacts/build-info, so run
// `npx hardhat compile` first and do not edit the sources in between.
const fs = require("fs");
const path = require("path");

const CONTRACT = "contracts/Multisender.sol:Multisender";
const SERVER = "https://sourcify.dev/server";

const args = process.argv.slice(2);
const chainIdx = args.indexOf("--chain");
const chainId = chainIdx === -1 ? "4663" : args[chainIdx + 1];
const positional = args.filter((_, i) => chainIdx === -1 || (i !== chainIdx && i !== chainIdx + 1));
const [address, creationTxHash] = positional;

if (!address) {
  console.error("usage: node scripts/verify-sourcify.cjs <address> [creationTxHash] [--chain <id>]");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    throw new Error(`${url} returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
}

async function main() {
  const dir = path.join(__dirname, "..", "artifacts", "build-info");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  if (files.length !== 1) {
    console.warn(`build-info has ${files.length} files; using ${files[0]}`);
  }
  const buildInfo = JSON.parse(fs.readFileSync(path.join(dir, files[0]), "utf8"));

  const payload = {
    stdJsonInput: buildInfo.input,
    compilerVersion: buildInfo.solcLongVersion,
    contractIdentifier: CONTRACT,
    ...(creationTxHash ? { creationTransactionHash: creationTxHash } : {}),
  };

  console.log(`Verifying ${CONTRACT}`);
  console.log(`  chain   ${chainId}`);
  console.log(`  address ${address}`);
  console.log(`  solc    ${buildInfo.solcLongVersion}\n`);

  const submit = await json(`${SERVER}/v2/verify/${chainId}/${address}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // Re-running against an already-verified address is a no-op, not a failure.
  if (submit.status === 409 && submit.body.customCode === "already_verified") {
    console.log(submit.body.message);
    console.log(`https://repo.sourcify.dev/${chainId}/${address}/`);
    return;
  }

  if (submit.status !== 202) {
    console.error("submit failed:", submit.status, JSON.stringify(submit.body));
    process.exitCode = 1;
    return;
  }

  const id = submit.body.verificationId;
  for (let i = 0; i < 30; i++) {
    await sleep(4000);
    const job = await json(`${SERVER}/v2/verify/${id}`);
    if (!job.body.isJobCompleted) continue;
    if (job.body.error) {
      console.error("verification failed:", JSON.stringify(job.body.error));
      process.exitCode = 1;
      return;
    }
    const result = await json(`${SERVER}/v2/contract/${chainId}/${address}`);
    const { match, creationMatch, runtimeMatch, verifiedAt } = result.body;
    console.log(`match:    ${match} (creation ${creationMatch}, runtime ${runtimeMatch})`);
    console.log(`verified: ${verifiedAt}`);
    console.log(`https://repo.sourcify.dev/${chainId}/${address}/`);
    return;
  }
  console.error("timed out waiting for the verification job");
  process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
