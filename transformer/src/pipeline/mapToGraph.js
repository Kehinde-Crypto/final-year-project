/**
 * Maps event data to Neo4j graph structure (nodes and relationships)
 */
export function mapToGraph(enrichedEvent) {
  const { type, data, meta, enriched } = enrichedEvent;

  const graph = {
    nodes: [],
    relationships: [],
  };

  switch (type) {
    case 'ActorRegistered':
      graph.nodes.push({
        label: 'Actor',
        properties: {
          id: data.actorId,
          name: data.name,
          role: data.roleName,
          location: data.location,
          registeredAt: new Date(data.timestamp * 1000).toISOString(),
          active: true,
        },
      });
      break;

    case 'ActorDeactivated':
      graph.nodes.push({
        label: 'Actor',
        properties: {
          id: data.actorId,
          active: false,
          deactivatedAt: new Date(data.timestamp * 1000).toISOString(),
        },
        merge: true, // Update existing node
      });
      break;

    case 'ProductCreated':
      // Create Product node
      graph.nodes.push({
        label: 'Product',
        properties: {
          id: data.productId,
          name: data.name,
          category: data.category,
          status: 'Created',
          createdAt: new Date(data.timestamp * 1000).toISOString(),
        },
      });

      // Create MANUFACTURED_BY relationship
      graph.relationships.push({
        type: 'MANUFACTURED_BY',
        from: { label: 'Product', id: data.productId },
        to: { label: 'Actor', id: data.manufacturer },
        properties: {
          timestamp: new Date(data.timestamp * 1000).toISOString(),
          transactionHash: meta.transactionHash,
        },
      });

      // Create CURRENTLY_OWNED_BY relationship
      graph.relationships.push({
        type: 'CURRENTLY_OWNED_BY',
        from: { label: 'Product', id: data.productId },
        to: { label: 'Actor', id: data.manufacturer },
        properties: {
          since: new Date(data.timestamp * 1000).toISOString(),
        },
      });
      break;

    case 'ProductTransferred':
      // Create Transfer node
      graph.nodes.push({
        label: 'Transfer',
        properties: {
          id: data.transferId,
          productId: data.productId,
          location: data.location,
          status: data.statusName,
          timestamp: new Date(data.timestamp * 1000).toISOString(),
          transactionHash: meta.transactionHash,
        },
      });

      // Create TRANSFERRED_FROM relationship
      graph.relationships.push({
        type: 'TRANSFERRED_FROM',
        from: { label: 'Transfer', id: data.transferId },
        to: { label: 'Actor', id: data.from },
        properties: {},
      });

      // Create TRANSFERRED_TO relationship
      graph.relationships.push({
        type: 'TRANSFERRED_TO',
        from: { label: 'Transfer', id: data.transferId },
        to: { label: 'Actor', id: data.to },
        properties: {},
      });

      // Create TRANSFER_OF relationship
      graph.relationships.push({
        type: 'TRANSFER_OF',
        from: { label: 'Transfer', id: data.transferId },
        to: { label: 'Product', id: data.productId },
        properties: {},
      });

      // Update Product ownership (replace CURRENTLY_OWNED_BY)
      graph.relationships.push({
        type: 'CURRENTLY_OWNED_BY',
        from: { label: 'Product', id: data.productId },
        to: { label: 'Actor', id: data.to },
        properties: {
          since: new Date(data.timestamp * 1000).toISOString(),
        },
        replace: true,
      });

      // Update Product status
      graph.nodes.push({
        label: 'Product',
        properties: {
          id: data.productId,
          status: data.statusName,
          updatedAt: new Date(data.timestamp * 1000).toISOString(),
        },
        merge: true,
      });
      break;

    case 'ProductStatusUpdated':
      graph.nodes.push({
        label: 'Product',
        properties: {
          id: data.productId,
          status: data.newStatusName,
          updatedAt: new Date(data.timestamp * 1000).toISOString(),
        },
        merge: true,
      });
      break;

    case 'ProductRecalled':
      graph.nodes.push({
        label: 'Product',
        properties: {
          id: data.productId,
          status: 'Recalled',
          recallReason: data.reason,
          recalledBy: data.recalledBy,
          recalledAt: new Date(data.timestamp * 1000).toISOString(),
        },
        merge: true,
      });

      // Create Recall node for tracking
      graph.nodes.push({
        label: 'Recall',
        properties: {
          productId: data.productId,
          reason: data.reason,
          recalledBy: data.recalledBy,
          timestamp: new Date(data.timestamp * 1000).toISOString(),
          transactionHash: meta.transactionHash,
        },
      });

      graph.relationships.push({
        type: 'RECALLED',
        from: { label: 'Recall', id: `${data.productId}-${data.timestamp}` },
        to: { label: 'Product', id: data.productId },
        properties: {},
      });
      break;
  }

  return graph;
}
