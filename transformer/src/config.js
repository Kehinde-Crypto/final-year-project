import 'dotenv/config';

export const config = {
  // Blockchain
  rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
  chainId: parseInt(process.env.CHAIN_ID || '31337'),
  contractAddress: process.env.CONTRACT_ADDRESS,
  
  // Neo4j
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password',
  },
  
  // Redis (optional)
  redisUrl: process.env.REDIS_URL,
  
  // WebSocket
  wsPort: parseInt(process.env.WS_PORT || '8080'),
  
  // Processing
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '1000'),
  startBlock: parseInt(process.env.START_BLOCK || '0'),
};
