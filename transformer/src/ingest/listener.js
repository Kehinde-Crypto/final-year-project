import { ethers } from 'ethers';
import { config } from '../config.js';
import { EVENTS } from '../constants.js';
import deployment from '../../../contracts/deployments/localhost.json' with { type: 'json' };

/**
 * Blockchain event listener service
 * Listens for SupplyChain contract events and emits them for processing
 */
export class EventListener {
  constructor(onEvent) {
    this.provider = null;
    this.contract = null;
    this.onEvent = onEvent;
    this.isRunning = false;
    this.lastProcessedBlock = config.startBlock;
  }

  /**
   * Initialize connection to blockchain
   */
  async init() {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl, {
      chainId: config.chainId,
      name: 'localhost',
    });

    // Verify connection
    const network = await this.provider.getNetwork();
    console.log(`[Listener] Connected to network: ${network.name} (chainId: ${network.chainId})`);

    // Initialize contract
    const address = config.contractAddress || deployment.address;
    this.contract = new ethers.Contract(address, deployment.abi, this.provider);
    
    console.log(`[Listener] Watching contract at: ${address}`);
    console.log(`[Listener] Starting from block: ${this.lastProcessedBlock}`);
    
    return this;
  }

  /**
   * Start listening for events
   */
  async start() {
    this.isRunning = true;
    console.log('[Listener] Starting event listener...');
    
    // Listen for new blocks
    this.provider.on('block', async (blockNumber) => {
      if (!this.isRunning) return;
      
      try {
        await this.processBlock(blockNumber);
      } catch (error) {
        console.error(`[Listener] Error processing block ${blockNumber}:`, error.message);
      }
    });

    // Also catch up on missed events from last processed block
    await this.catchUp();
  }

  /**
   * Process events in a specific block range
   */
  async processBlock(blockNumber) {
    if (blockNumber <= this.lastProcessedBlock) return;

    const fromBlock = this.lastProcessedBlock + 1;
    const toBlock = blockNumber;

    // Query all event types
    const eventNames = Object.values(EVENTS);
    
    for (const eventName of eventNames) {
      const filter = this.contract.filters[eventName]();
      const events = await this.contract.queryFilter(filter, fromBlock, toBlock);

      for (const event of events) {
        await this.onEvent({
          eventName: event.fragment.name,
          args: event.args,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          logIndex: event.index,
        });
      }
    }

    this.lastProcessedBlock = toBlock;
  }

  /**
   * Catch up on missed events from start block
   */
  async catchUp() {
    const currentBlock = await this.provider.getBlockNumber();
    
    if (currentBlock > this.lastProcessedBlock) {
      console.log(`[Listener] Catching up from block ${this.lastProcessedBlock + 1} to ${currentBlock}`);
      
      // Process in chunks of 1000 blocks to avoid timeout
      const chunkSize = 1000;
      for (let from = this.lastProcessedBlock + 1; from <= currentBlock; from += chunkSize) {
        const to = Math.min(from + chunkSize - 1, currentBlock);
        
        const eventNames = Object.values(EVENTS);
        for (const eventName of eventNames) {
          const filter = this.contract.filters[eventName]();
          const events = await this.contract.queryFilter(filter, from, to);

          for (const event of events) {
            await this.onEvent({
              eventName: event.fragment.name,
              args: event.args,
              blockNumber: event.blockNumber,
              transactionHash: event.transactionHash,
              logIndex: event.index,
            });
          }
        }
      }
      
      this.lastProcessedBlock = currentBlock;
      console.log(`[Listener] Caught up to block ${currentBlock}`);
    }
  }

  /**
   * Stop listening
   */
  stop() {
    this.isRunning = false;
    this.provider.removeAllListeners('block');
    console.log('[Listener] Stopped');
  }

  /**
   * Get current block number
   */
  async getCurrentBlock() {
    return await this.provider.getBlockNumber();
  }
}
