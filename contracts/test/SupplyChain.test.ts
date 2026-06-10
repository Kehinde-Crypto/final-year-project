import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { network } from "hardhat";

describe("SupplyChain", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  
  let supplyChain: any;
  let manufacturer: any;
  let supplier: any;
  let distributor: any;
  let retailer: any;
  let consumer: any;
  
  const ActorRole = {
    None: 0,
    Manufacturer: 1,
    Supplier: 2,
    Distributor: 3,
    Retailer: 4,
    Consumer: 5,
  };
  
  const ProductStatus = {
    Created: 0,
    InTransit: 1,
    Delivered: 2,
    Sold: 3,
    Recalled: 4,
  };

  beforeEach(async function () {
    supplyChain = await viem.deployContract("SupplyChain");
    const wallets = await viem.getWalletClients();
    manufacturer = wallets[0];
    supplier = wallets[1];
    distributor = wallets[2];
    retailer = wallets[3];
    consumer = wallets[4];
  });

  describe("Actor Management", function () {
    it("Should register a manufacturer", async function () {
      await supplyChain.write.registerActor(
        ["Acme Manufacturing", ActorRole.Manufacturer, "Lagos, Nigeria"],
        { account: manufacturer.account }
      );
      
      const events = await publicClient.getContractEvents({
        address: supplyChain.address,
        abi: supplyChain.abi,
        eventName: "ActorRegistered",
      });
      
      assert.ok(events.length >= 1);
      assert.equal(events[0].args.name, "Acme Manufacturing");
      assert.equal(Number(events[0].args.role), ActorRole.Manufacturer);
    });

    it("Should register all supply chain actors", async function () {
      await supplyChain.write.registerActor(
        ["Acme Manufacturing", ActorRole.Manufacturer, "Lagos, Nigeria"],
        { account: manufacturer.account }
      );
      await supplyChain.write.registerActor(
        ["Global Supplies Ltd", ActorRole.Supplier, "Abuja, Nigeria"],
        { account: supplier.account }
      );
      await supplyChain.write.registerActor(
        ["FastDist Logistics", ActorRole.Distributor, "Port Harcourt, Nigeria"],
        { account: distributor.account }
      );
      await supplyChain.write.registerActor(
        ["MegaMart Store", ActorRole.Retailer, "Kano, Nigeria"],
        { account: retailer.account }
      );
      await supplyChain.write.registerActor(
        ["John Doe", ActorRole.Consumer, "Ibadan, Nigeria"],
        { account: consumer.account }
      );
      
      const allActors = await supplyChain.read.getAllActors();
      assert.equal(allActors.length, 5);
    });

    it("Should not allow duplicate registration", async function () {
      await supplyChain.write.registerActor(
        ["Acme Manufacturing", ActorRole.Manufacturer, "Lagos, Nigeria"],
        { account: manufacturer.account }
      );
      
      await viem.assertions.revertWith(
        supplyChain.write.registerActor(
          ["Another Name", ActorRole.Supplier, "Another Location"],
          { account: manufacturer.account }
        ),
        "Actor already registered"
      );
    });

    it("Should deactivate an actor (owner only)", async function () {
      await supplyChain.write.registerActor(
        ["Bad Actor Inc", ActorRole.Supplier, "Lagos, Nigeria"],
        { account: supplier.account }
      );
      
      await supplyChain.write.deactivateActor([supplier.account.address]);
      
      const [name, role, location, isActive, registeredAt] = await supplyChain.read.getActor([supplier.account.address]);
      assert.equal(isActive, false);
    });
  });

  describe("Product Management", function () {
    beforeEach(async function () {
      await supplyChain.write.registerActor(
        ["Acme Manufacturing", ActorRole.Manufacturer, "Lagos, Nigeria"],
        { account: manufacturer.account }
      );
    });

    it("Should create a product (manufacturer only)", async function () {
      await supplyChain.write.createProduct(
        ["Laptop X1", "High-performance laptop", "Electronics"],
        { account: manufacturer.account }
      );
      
      const events = await publicClient.getContractEvents({
        address: supplyChain.address,
        abi: supplyChain.abi,
        eventName: "ProductCreated",
      });
      
      assert.ok(events.length >= 1);
      assert.equal(events[0].args.name, "Laptop X1");
      assert.equal(events[0].args.category, "Electronics");
    });

    it("Should not allow non-manufacturer to create product", async function () {
      await supplyChain.write.registerActor(
        ["Supplier Co", ActorRole.Supplier, "Lagos, Nigeria"],
        { account: supplier.account }
      );
      
      await viem.assertions.revertWith(
        supplyChain.write.createProduct(
          ["Product", "Description", "Category"],
          { account: supplier.account }
        ),
        "Only active manufacturers can call this function"
      );
    });

    it("Should get product details", async function () {
      await supplyChain.write.createProduct(
        ["Laptop X1", "High-performance laptop", "Electronics"],
        { account: manufacturer.account }
      );
      
      const [id, name, description, category, productManufacturer, currentOwner, status, createdAt, updatedAt] = 
        await supplyChain.read.getProduct([1n]);
      
      assert.equal(name, "Laptop X1");
      assert.equal(description, "High-performance laptop");
      assert.equal(category, "Electronics");
      assert.equal(Number(status), ProductStatus.Created);
    });

    it("Should recall a product", async function () {
      await supplyChain.write.createProduct(
        ["Laptop X1", "High-performance laptop", "Electronics"],
        { account: manufacturer.account }
      );
      
      await supplyChain.write.recallProduct([1n, "Safety concern - battery issue"], 
        { account: manufacturer.account }
      );
      
      const product = await supplyChain.read.getProduct([1n]);
      assert.equal(Number(product[6]), ProductStatus.Recalled);
    });
  });

  describe("Product Transfer", function () {
    beforeEach(async function () {
      await supplyChain.write.registerActor(
        ["Acme Manufacturing", ActorRole.Manufacturer, "Lagos, Nigeria"],
        { account: manufacturer.account }
      );
      await supplyChain.write.registerActor(
        ["Global Supplies Ltd", ActorRole.Supplier, "Abuja, Nigeria"],
        { account: supplier.account }
      );
      await supplyChain.write.registerActor(
        ["FastDist Logistics", ActorRole.Distributor, "Port Harcourt, Nigeria"],
        { account: distributor.account }
      );
      await supplyChain.write.registerActor(
        ["MegaMart Store", ActorRole.Retailer, "Kano, Nigeria"],
        { account: retailer.account }
      );
      await supplyChain.write.registerActor(
        ["John Doe", ActorRole.Consumer, "Ibadan, Nigeria"],
        { account: consumer.account }
      );
      
      await supplyChain.write.createProduct(
        ["Smartphone Pro", "Latest smartphone model", "Electronics"],
        { account: manufacturer.account }
      );
    });

    it("Should transfer product from Manufacturer to Supplier", async function () {
      await supplyChain.write.transferProduct(
        [1n, supplier.account.address, "Lagos Warehouse", "Initial transfer to supplier"],
        { account: manufacturer.account }
      );
      
      const product = await supplyChain.read.getProduct([1n]);
      assert.equal(product[5].toLowerCase(), supplier.account.address.toLowerCase());
      assert.equal(Number(product[6]), ProductStatus.InTransit);
    });

    it("Should enforce supply chain flow", async function () {
      await viem.assertions.revertWith(
        supplyChain.write.transferProduct(
          [1n, distributor.account.address, "Lagos", "Invalid transfer"],
          { account: manufacturer.account }
        ),
        "Invalid transfer: must follow supply chain path (Manufacturer->Supplier->Distributor->Retailer->Consumer)"
      );
    });

    it("Should complete full supply chain flow", async function () {
      // Manufacturer -> Supplier
      await supplyChain.write.transferProduct(
        [1n, supplier.account.address, "Lagos Warehouse", "To supplier"],
        { account: manufacturer.account }
      );
      let product = await supplyChain.read.getProduct([1n]);
      assert.equal(Number(product[6]), ProductStatus.InTransit);
      
      // Supplier -> Distributor
      await supplyChain.write.transferProduct(
        [1n, distributor.account.address, "Abuja Hub", "To distributor"],
        { account: supplier.account }
      );
      product = await supplyChain.read.getProduct([1n]);
      assert.equal(Number(product[6]), ProductStatus.InTransit);
      
      // Distributor -> Retailer
      await supplyChain.write.transferProduct(
        [1n, retailer.account.address, "Port Harcourt Depot", "To retailer"],
        { account: distributor.account }
      );
      product = await supplyChain.read.getProduct([1n]);
      assert.equal(Number(product[6]), ProductStatus.Delivered);
      
      // Retailer -> Consumer
      await supplyChain.write.transferProduct(
        [1n, consumer.account.address, "Kano Store", "Sold to consumer"],
        { account: retailer.account }
      );
      product = await supplyChain.read.getProduct([1n]);
      assert.equal(Number(product[6]), ProductStatus.Sold);
      assert.equal(product[5].toLowerCase(), consumer.account.address.toLowerCase());
    });

    it("Should track transfer history", async function () {
      await supplyChain.write.transferProduct(
        [1n, supplier.account.address, "Lagos", "To supplier"],
        { account: manufacturer.account }
      );
      await supplyChain.write.transferProduct(
        [1n, distributor.account.address, "Abuja", "To distributor"],
        { account: supplier.account }
      );
      
      const history = await supplyChain.read.getProductTransferHistory([1n]);
      assert.equal(Number(history.length), 2);
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await supplyChain.write.registerActor(
        ["Acme Manufacturing", ActorRole.Manufacturer, "Lagos, Nigeria"],
        { account: manufacturer.account }
      );
    });

    it("Should return correct counts", async function () {
      await supplyChain.write.createProduct(
        ["Product 1", "Desc 1", "Cat 1"],
        { account: manufacturer.account }
      );
      await supplyChain.write.createProduct(
        ["Product 2", "Desc 2", "Cat 2"],
        { account: manufacturer.account }
      );
      
      const counts = await supplyChain.read.getCounts();
      assert.equal(Number(counts[0]), 2); // totalProducts
      assert.equal(Number(counts[1]), 0); // totalTransfers
      assert.equal(Number(counts[2]), 1); // totalActors
    });

    it("Should get products by owner", async function () {
      await supplyChain.write.createProduct(
        ["Product 1", "Desc 1", "Cat 1"],
        { account: manufacturer.account }
      );
      
      const products = await supplyChain.read.getProductsByOwner([manufacturer.account.address]);
      assert.equal(Number(products.length), 1);
    });
  });

  describe("Edge Cases", function () {
    it("Should not transfer non-existent product", async function () {
      await viem.assertions.revertWith(
        supplyChain.write.transferProduct(
          [999n, supplier.account.address, "Location", "Notes"],
          { account: manufacturer.account }
        ),
        "Product does not exist"
      );
    });

    it("Should not allow transfer of recalled product", async function () {
      await supplyChain.write.registerActor(
        ["Acme Manufacturing", ActorRole.Manufacturer, "Lagos, Nigeria"],
        { account: manufacturer.account }
      );
      await supplyChain.write.registerActor(
        ["Supplier Co", ActorRole.Supplier, "Abuja, Nigeria"],
        { account: supplier.account }
      );
      
      await supplyChain.write.createProduct(
        ["Product", "Desc", "Cat"],
        { account: manufacturer.account }
      );
      
      await supplyChain.write.recallProduct([1n, "Safety issue"], 
        { account: manufacturer.account }
      );
      
      await viem.assertions.revertWith(
        supplyChain.write.transferProduct(
          [1n, supplier.account.address, "Location", "Notes"],
          { account: manufacturer.account }
        ),
        "Cannot transfer recalled product"
      );
    });

    it("Should not allow non-owner to transfer product", async function () {
      await supplyChain.write.registerActor(
        ["Acme Manufacturing", ActorRole.Manufacturer, "Lagos, Nigeria"],
        { account: manufacturer.account }
      );
      await supplyChain.write.registerActor(
        ["Supplier Co", ActorRole.Supplier, "Abuja, Nigeria"],
        { account: supplier.account }
      );
      
      await supplyChain.write.createProduct(
        ["Product", "Desc", "Cat"],
        { account: manufacturer.account }
      );
      
      await viem.assertions.revertWith(
        supplyChain.write.transferProduct(
          [1n, distributor.account.address, "Location", "Notes"],
          { account: supplier.account }
        ),
        "Not the product owner"
      );
    });
  });
});
