import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DLQ_DIR = path.join(__dirname, '..', '..', 'dlq');

/**
 * Dead Letter Queue for failed events
 * Stores events that failed processing for later analysis/retry
 */
export class DeadLetterQueue {
  constructor() {
    this.queue = [];
  }

  /**
   * Initialize DLQ directory
   */
  async init() {
    try {
      await fs.mkdir(DLQ_DIR, { recursive: true });
      console.log('[DLQ] Initialized dead letter queue');
    } catch (error) {
      console.error('[DLQ] Error creating DLQ directory:', error.message);
    }
  }

  /**
   * Add failed event to DLQ
   */
  async add(event, error) {
    const entry = {
      event,
      error,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    this.queue.push(entry);

    // Persist to file
    const filename = `failed-${Date.now()}.json`;
    const filepath = path.join(DLQ_DIR, filename);
    
    try {
      await fs.writeFile(filepath, JSON.stringify(entry, null, 2));
      console.log(`[DLQ] Added failed event to ${filename}`);
    } catch (writeError) {
      console.error('[DLQ] Error writing to DLQ:', writeError.message);
    }

    return filename;
  }

  /**
   * Get all failed events
   */
  getAll() {
    return this.queue;
  }

  /**
   * Count failed events
   */
  count() {
    return this.queue.length;
  }
}
