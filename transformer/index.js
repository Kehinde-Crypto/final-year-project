import 'dotenv/config';
import { config } from './src/config.js';
import { EventListener } from './src/ingest/listener.js';
import { Pipeline } from './src/pipeline/index.js';
import { GraphWriter } from './src/neo4j/writer.js';
import { RealtimeEmitter } from './src/realtime/emitter.js';
import { CursorManager } from './src/state/cursor.js';
import { DeadLetterQueue } from './src/state/dlq.js';

/**
 * Transformer Service - Event Processing Layer
 * 
 * Listens for blockchain events, processes them through a pipeline,
 * and stores them in Neo4j knowledge graph.
 */

class TransformerService {
  constructor() {
    this.listener = null;
    this.pipeline = null;
    this.graphWriter = null;
    this.emitter = null;
    this.cursor = null;
    this.dlq = null;
    this.isRunning = false;
  }

  /**
   * Initialize all components
   */
  async init() {
    console.log('='.repeat(50));
    console.log('  Supply Chain Transformer Service');
    console.log('='.repeat(50));
    console.log('');

    // Initialize cursor manager
    this.cursor = new CursorManager();
    const startBlock = await this.cursor.load();
    config.startBlock = startBlock;

    // Initialize DLQ
    this.dlq = new DeadLetterQueue();
    await this.dlq.init();

    // Initialize pipeline
    this.pipeline = new Pipeline({ chainId: config.chainId });

    // Initialize graph writer (optional - will fail gracefully if Neo4j not available)
    this.graphWriter = new GraphWriter();
    try {
      await this.graphWriter.init();
    } catch (error) {
      console.warn('[Main] Neo4j not available, running in event-only mode');
      this.graphWriter = null;
    }

    // Initialize WebSocket emitter
    this.emitter = new RealtimeEmitter();
    this.emitter.init();

    // Initialize event listener
    this.listener = new EventListener(this.handleEvent.bind(this));
    await this.listener.init();

    console.log('');
    console.log('[Main] All components initialized');
    console.log('');

    return this;
  }

  /**
   * Handle incoming event from listener
   */
  async handleEvent(event) {
    console.log(`[Main] Processing: ${event.eventName} (block ${event.blockNumber})`);

    // Process through pipeline
    const result = this.pipeline.process(event);

    if (!result.success) {
      console.error(`[Main] Pipeline error: ${result.error}`);
      await this.dlq.add(event, result.error);
      return;
    }

    // Write to Neo4j (if available)
    if (this.graphWriter && result.graph) {
      try {
        await this.graphWriter.writeGraph(result.graph);
        console.log(`[Main] Wrote to Neo4j: ${result.graph.nodes.length} nodes, ${result.graph.relationships.length} relationships`);
      } catch (error) {
        console.error(`[Main] Neo4j write error: ${error.message}`);
        await this.dlq.add(event, error.message);
      }
    }

    // Broadcast to connected clients
    if (this.emitter) {
      this.emitter.broadcast(result.enriched);

      // Broadcast anomalies separately
      if (result.anomalies && result.anomalies.length > 0) {
        for (const anomaly of result.anomalies) {
          this.emitter.broadcastAnomaly(anomaly);
          console.log(`[Main] Anomaly detected: ${anomaly.type} (${anomaly.severity})`);
        }
      }
    }

    // Save cursor periodically
    await this.cursor.save(event.blockNumber);
  }

  /**
   * Start the service
   */
  async start() {
    this.isRunning = true;
    console.log('[Main] Starting transformer service...');
    console.log('');

    await this.listener.start();

    console.log('');
    console.log('[Main] Service running. Press Ctrl+C to stop.');
    console.log('');

    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  /**
   * Stop the service
   */
  async stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    console.log('');
    console.log('[Main] Shutting down...');

    this.listener.stop();

    if (this.graphWriter) {
      await this.graphWriter.close();
    }

    if (this.emitter) {
      this.emitter.close();
    }

    console.log('[Main] Service stopped');
    process.exit(0);
  }
}

// Start service
const service = new TransformerService();
service.init()
  .then(() => service.start())
  .catch((error) => {
    console.error('[Main] Fatal error:', error);
    process.exit(1);
  });
