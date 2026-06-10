import { decodeEvent } from './decode.js';
import { validateEvent } from './validate.js';
import { enrichEvent } from './enrich.js';
import { mapToGraph } from './mapToGraph.js';
import { checkAnomaly } from './anomalyCheck.js';

/**
 * Pipeline orchestrator
 * Processes events through all stages: decode → validate → enrich → mapToGraph → anomalyCheck
 */
export class Pipeline {
  constructor(context = {}) {
    this.context = context;
    this.state = {
      actorRoles: {},      // address -> role name
      actorNames: [],      // list of registered names
      productTransfers: {}, // productId -> array of transfers
    };
  }

  /**
   * Process a raw event through all pipeline stages
   * @returns { success: boolean, graph?: object, anomaly?: object, error?: string }
   */
  process(event) {
    try {
      // Stage 1: Decode
      const decoded = decodeEvent(event);
      
      // Stage 2: Validate
      const validation = validateEvent(decoded);
      if (!validation.valid) {
        return { success: false, error: validation.error, event: decoded };
      }
      decoded.data = validation.data;

      // Stage 3: Enrich
      const enriched = enrichEvent(decoded, this.context);

      // Stage 4: Map to graph
      const graph = mapToGraph(enriched);

      // Stage 5: Anomaly detection
      const withAnomaly = checkAnomaly(enriched, this.state);

      // Update internal state for anomaly detection
      this.updateState(decoded);

      return {
        success: true,
        graph,
        enriched: withAnomaly,
        anomalies: withAnomaly.anomalies,
      };
    } catch (error) {
      console.error('[Pipeline] Error processing event:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update internal state for anomaly detection
   */
  updateState(decoded) {
    const { type, data } = decoded;

    switch (type) {
      case 'ActorRegistered':
        this.state.actorRoles[data.actorId] = data.roleName;
        this.state.actorNames.push(data.name);
        break;

      case 'ProductTransferred':
        if (!this.state.productTransfers[data.productId]) {
          this.state.productTransfers[data.productId] = [];
        }
        this.state.productTransfers[data.productId].push({
          from: data.from,
          to: data.to,
          timestamp: data.timestamp,
        });
        break;
    }
  }
}
