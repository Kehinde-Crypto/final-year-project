import { network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const { viem } = await network.connect();
  
  // Get deployment info
  const deploymentPath = path.join(__dirname, "..", "deployments", "localhost.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  console.log("Using contract at:", deployment.address);
  
  // Get contract instance
  const supplyChain = await viem.getContractAt("SupplyChain", deployment.address);
  
  // Get wallet clients
  const walletClients = await viem.getWalletClients();
  const [deployer, manufacturer, supplier, distributor, retailer, consumer] = walletClients.slice(0, 6);
  
  console.log("\n=== Seeding Supply Chain Data ===\n");
  
  // 1. Register Actors
  console.log("1. Registering actors...");
  
  const actors = [
    { wallet: manufacturer, name: "Tech Manufacturer Inc", role: 1, location: "Shenzhen, China" },
    { wallet: supplier, name: "Global Components Ltd", role: 2, location: "Singapore" },
    { wallet: distributor, name: "FastLogistics Corp", role: 3, location: "Los Angeles, USA" },
    { wallet: retailer, name: "ElectroMart Store", role: 4, location: "New York, USA" },
    { wallet: consumer, name: "John Doe", role: 5, location: "Boston, USA" },
  ];
  
  for (const actor of actors) {
    try {
      const hash = await supplyChain.write.registerActor([
        actor.name,
        actor.role,
        actor.location
      ], { account: actor.wallet.account });
      console.log(`   ✓ Registered ${actor.name} (${["None", "Manufacturer", "Supplier", "Distributor", "Retailer", "Consumer"][actor.role]})`);
    } catch (e: any) {
      if (e.message?.includes("already registered")) {
        console.log(`   - ${actor.name} already registered`);
      } else {
        throw e;
      }
    }
  }
  
  // 2. Create Products
  console.log("\n2. Creating products...");
  
  const products = [
    { name: "Smartphone X200", description: "Latest smartphone model", category: "Electronics" },
    { name: "Laptop Pro 15", description: "Professional laptop", category: "Electronics" },
    { name: "Wireless Earbuds", description: "Noise-cancelling earbuds", category: "Accessories" },
    { name: "Smart Watch V3", description: "Fitness tracking watch", category: "Wearables" },
    { name: "Tablet Mini", description: "Compact tablet device", category: "Electronics" },
  ];
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const hash = await supplyChain.write.createProduct([
      product.name,
      product.description,
      product.category
    ], { account: manufacturer.account });
    console.log(`   ✓ Created: ${product.name}`);
  }
  
  // 3. Transfer Products through supply chain
  console.log("\n3. Transferring products through supply chain...");
  
  // Product 1: Manufacturer -> Supplier -> Distributor -> Retailer -> Consumer
  const transfers = [
    { productId: 1n, from: manufacturer, to: supplier, location: "Shenzhen Warehouse", notes: "Initial shipment" },
    { productId: 1n, from: supplier, to: distributor, location: "Singapore Port", notes: "Export clearance" },
    { productId: 1n, from: distributor, to: retailer, location: "LA Distribution Center", notes: "Domestic delivery" },
    { productId: 1n, from: retailer, to: consumer, location: "New York Store", notes: "Customer purchase" },
    
    { productId: 2n, from: manufacturer, to: supplier, location: "Shenzhen Warehouse", notes: "Bulk order" },
    { productId: 2n, from: supplier, to: distributor, location: "Singapore Port", notes: "In transit" },
    
    { productId: 3n, from: manufacturer, to: supplier, location: "Shenzhen Warehouse", notes: "Express shipment" },
    { productId: 3n, from: supplier, to: distributor, location: "Singapore Port", notes: "Express delivery" },
  ];
  
  for (const transfer of transfers) {
    const hash = await supplyChain.write.transferProduct([
      transfer.productId,
      transfer.to.account.address,
      transfer.location,
      transfer.notes
    ], { account: transfer.from.account });
    console.log(`   ✓ Product ${transfer.productId}: ${transfer.from.account.address.slice(0, 8)}... -> ${transfer.to.account.address.slice(0, 8)}...`);
  }
  
  console.log("\n=== Seeding Complete ===\n");
  console.log("Check Neo4j for the supply chain graph data!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
