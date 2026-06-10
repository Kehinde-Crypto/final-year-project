import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CURSOR_FILE = path.join(__dirname, '..', '..', '.cursor.json');

/**
 * Simple file-based cursor persistence
 * Tracks last processed block for recovery
 */
export class CursorManager {
  constructor() {
    this.cursor = {
      lastBlock: 0,
      updatedAt: null,
    };
  }

  /**
   * Load cursor from file
   */
  async load() {
    try {
      const data = await fs.readFile(CURSOR_FILE, 'utf-8');
      this.cursor = JSON.parse(data);
      console.log(`[Cursor] Loaded cursor: block ${this.cursor.lastBlock}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[Cursor] No existing cursor file, starting fresh');
      } else {
        console.error('[Cursor] Error loading cursor:', error.message);
      }
    }
    return this.cursor.lastBlock;
  }

  /**
   * Save cursor to file
   */
  async save(blockNumber) {
    this.cursor = {
      lastBlock: blockNumber,
      updatedAt: new Date().toISOString(),
    };

    try {
      await fs.writeFile(CURSOR_FILE, JSON.stringify(this.cursor, null, 2));
    } catch (error) {
      console.error('[Cursor] Error saving cursor:', error.message);
    }
  }

  /**
   * Get current cursor
   */
  get() {
    return this.cursor.lastBlock;
  }
}
