import neo4j from 'neo4j-driver';
import { config } from '../config.js';

/**
 * Neo4j graph database writer
 * Handles writing nodes and relationships to the knowledge graph
 */
export class GraphWriter {
  constructor() {
    this.driver = null;
    this.session = null;
  }

  /**
   * Initialize Neo4j connection
   */
  async init() {
    this.driver = neo4j.driver(
      config.neo4j.uri,
      neo4j.auth.basic(config.neo4j.user, config.neo4j.password)
    );

    // Verify connection
    try {
      await this.driver.verifyConnectivity();
      console.log(`[GraphWriter] Connected to Neo4j at ${config.neo4j.uri}`);
    } catch (error) {
      console.error('[GraphWriter] Failed to connect to Neo4j:', error.message);
      throw error;
    }

    return this;
  }

  /**
   * Write graph data (nodes and relationships) to Neo4j
   */
  async writeGraph(graph) {
    const session = this.driver.session();
    
    try {
      // Write nodes
      for (const node of graph.nodes) {
        await this.writeNode(session, node);
      }

      // Write relationships
      for (const rel of graph.relationships) {
        await this.writeRelationship(session, rel);
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Write a single node
   */
  async writeNode(session, node) {
    const { label, properties, merge = false } = node;
    
    const query = merge
      ? `MERGE (n:${label} {id: $props.id}) SET n += $props`
      : `CREATE (n:${label} $props)`;
    
    await session.run(query, { props: properties });
  }

  /**
   * Write a single relationship
   */
  async writeRelationship(session, rel) {
    const { type, from, to, properties, replace = false } = rel;

    let query;
    
    if (replace) {
      // Delete existing relationship of same type, then create new one
      query = `
        MATCH (from:${from.label} {id: $fromId})-[old:${type}]->(to:any)
        DELETE old
        WITH from
        MATCH (to:${to.label} {id: $toId})
        MERGE (from)-[r:${type}]->(to)
        SET r += $props
      `;
    } else {
      query = `
        MATCH (from:${from.label} {id: $fromId})
        MATCH (to:${to.label} {id: $toId})
        MERGE (from)-[r:${type}]->(to)
        SET r += $props
      `;
    }

    await session.run(query, {
      fromId: from.id,
      toId: to.id,
      props: properties || {},
    });
  }

  /**
   * Run a custom Cypher query
   */
  async runQuery(query, params = {}) {
    const session = this.driver.session();
    try {
      const result = await session.run(query, params);
      return result.records.map(record => record.toObject());
    } finally {
      await session.close();
    }
  }

  /**
   * Close connection
   */
  async close() {
    if (this.driver) {
      await this.driver.close();
      console.log('[GraphWriter] Connection closed');
    }
  }
}
