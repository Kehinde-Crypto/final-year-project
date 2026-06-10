export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x5fbdb2315678afecb367f032d93f642f64180aa3';

export const CONTRACT_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [{"name": "_actorId", "type": "address"}],
    "name": "getActor",
    "outputs": [
      {"name": "name", "type": "string"},
      {"name": "role", "type": "uint8"},
      {"name": "location", "type": "string"},
      {"name": "isActive", "type": "bool"},
      {"name": "registeredAt", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllActors",
    "outputs": [{"name": "", "type": "address[]"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllProductIds",
    "outputs": [{"name": "", "type": "uint256[]"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "_productId", "type": "uint256"}],
    "name": "getProduct",
    "outputs": [
      {"name": "id", "type": "uint256"},
      {"name": "name", "type": "string"},
      {"name": "description", "type": "string"},
      {"name": "category", "type": "string"},
      {"name": "manufacturer", "type": "address"},
      {"name": "currentOwner", "type": "address"},
      {"name": "status", "type": "uint8"},
      {"name": "createdAt", "type": "uint256"},
      {"name": "updatedAt", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getCounts",
    "outputs": [
      {"name": "totalProducts", "type": "uint256"},
      {"name": "totalTransfers", "type": "uint256"},
      {"name": "totalActors", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "_name", "type": "string"},
      {"name": "_description", "type": "string"},
      {"name": "_category", "type": "string"}
    ],
    "name": "createProduct",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "_name", "type": "string"},
      {"name": "_role", "type": "uint8"},
      {"name": "_location", "type": "string"}
    ],
    "name": "registerActor",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "_productId", "type": "uint256"},
      {"name": "_to", "type": "address"},
      {"name": "_location", "type": "string"},
      {"name": "_notes", "type": "string"}
    ],
    "name": "transferProduct",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "_productId", "type": "uint256"},
      {"name": "_reason", "type": "string"}
    ],
    "name": "recallProduct",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "productId", "type": "uint256"},
      {"indexed": false, "name": "name", "type": "string"},
      {"indexed": false, "name": "category", "type": "string"},
      {"indexed": true, "name": "manufacturer", "type": "address"},
      {"indexed": false, "name": "timestamp", "type": "uint256"}
    ],
    "name": "ProductCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "productId", "type": "uint256"},
      {"indexed": true, "name": "transferId", "type": "uint256"},
      {"indexed": true, "name": "from", "type": "address"},
      {"indexed": false, "name": "to", "type": "address"},
      {"indexed": false, "name": "location", "type": "string"},
      {"indexed": false, "name": "newStatus", "type": "uint8"},
      {"indexed": false, "name": "timestamp", "type": "uint256"}
    ],
    "name": "ProductTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "actorId", "type": "address"},
      {"indexed": false, "name": "name", "type": "string"},
      {"indexed": false, "name": "role", "type": "uint8"},
      {"indexed": false, "name": "location", "type": "string"},
      {"indexed": false, "name": "timestamp", "type": "uint256"}
    ],
    "name": "ActorRegistered",
    "type": "event"
  }
] as const;