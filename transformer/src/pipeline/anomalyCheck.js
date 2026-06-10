/**
 * Anomaly detection for supply chain events
 * Detects suspicious patterns that may indicate fraud or issues
 */
export function checkAnomaly(enrichedEvent, state = {}) {
  const { type, data } = enrichedEvent;
  const anomalies = [];

  switch (type) {
    case 'ProductTransferred':
      // Check for rapid successive transfers (potential wash trading)
      const productTransfers = state.productTransfers?.[data.productId] || [];
      const lastTransfer = productTransfers[productTransfers.length - 1];
      
      if (lastTransfer) {
        const timeDiff = data.timestamp - lastTransfer.timestamp;
        if (timeDiff < 60) { // Less than 1 minute
          anomalies.push({
            type: 'RAPID_TRANSFER',
            severity: 'medium',
            message: `Product #${data.productId} transferred twice within ${timeDiff}s`,
            productId: data.productId,
          });
        }
      }

      // Check for backward transfers (Consumer -> Retailer, etc.)
      // This shouldn't happen in normal supply chain flow
      const expectedFlow = ['Manufacturer', 'Supplier', 'Distributor', 'Retailer', 'Consumer'];
      const fromRole = state.actorRoles?.[data.from];
      const toRole = state.actorRoles?.[data.to];
      
      if (fromRole && toRole) {
        const fromIndex = expectedFlow.indexOf(fromRole);
        const toIndex = expectedFlow.indexOf(toRole);
        
        if (toIndex < fromIndex) {
          anomalies.push({
            type: 'BACKWARD_TRANSFER',
            severity: 'high',
            message: `Product transferred backward: ${fromRole} → ${toRole}`,
            productId: data.productId,
            from: data.from,
            to: data.to,
          });
        }
      }
      break;

    case 'ProductRecalled':
      // All recalls are flagged as anomalies for attention
      anomalies.push({
        type: 'PRODUCT_RECALL',
        severity: 'critical',
        message: `Product #${data.productId} recalled: ${data.reason}`,
        productId: data.productId,
        reason: data.reason,
      });
      break;

    case 'ActorRegistered':
      // Check for duplicate names (potential impersonation)
      const existingNames = state.actorNames || [];
      if (existingNames.includes(data.name)) {
        anomalies.push({
          type: 'DUPLICATE_NAME',
          severity: 'low',
          message: `Actor registered with existing name: "${data.name}"`,
          actorId: data.actorId,
        });
      }
      break;
  }

  return {
    ...enrichedEvent,
    anomalies,
    hasAnomaly: anomalies.length > 0,
  };
}
