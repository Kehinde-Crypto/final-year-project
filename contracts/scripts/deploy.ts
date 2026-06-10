import { network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const { viem } = await network.connect();
  
  console.log("Deploying SupplyChain contract...");
  
  // Deploy the contract
  const supplyChain = await viem.deployContract("SupplyChain");
  
  console.log("✅ SupplyChain deployed to:", supplyChain.address);
  
  // Get deployer info
  const publicClient = await viem.getPublicClient();
  const deployer = (await viem.getWalletClients())[0];
  
  console.log("Deployer:", deployer.account.address);
  
  // Read ABI from artifacts
  const artifactsPath = path.join(__dirname, "..", "artifacts", "contracts", "SupplyChain.sol", "SupplyChain.json");
  const artifact = JSON.parse(fs.readFileSync(artifactsPath, "utf8"));
  
  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  // Save deployment info
  const deploymentInfo = {
    network: "localhost",
    chainId: Number(await publicClient.getChainId()),
    contractName: "SupplyChain",
    address: supplyChain.address,
    abi: artifact.abi,
    deployer: deployer.account.address,
    deployedAt: new Date().toISOString(),
    blockNumber: Number(await publicClient.getBlockNumber()),
  };
  
  const outputPath = path.join(deploymentsDir, "localhost.json");
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("📄 Deployment info saved to:", outputPath);
  
  // Print summary
  console.log("\n=== Deployment Summary ===");
  console.log("Contract: SupplyChain");
  console.log("Address:", supplyChain.address);
  console.log("Network: localhost (Hardhat)");
  console.log("Deployer:", deployer.account.address);
  console.log("========================\n");
  
  return supplyChain;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
