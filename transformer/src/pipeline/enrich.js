/**
 * Enriches event data with additional context
 * This could include geocoding, timestamps, or additional metadata
 */
export function enrichEvent(decodedEvent, context = {}) {
  const { type, data, meta } = decodedEvent;

  const enriched = {
    ...decodedEvent,
    enriched: {
      processedAt: new Date().toISOString(),
      chainId: context.chainId || 31337,
    },
  };

  switch (type) {
    case 'ActorRegistered':
      // Add location coordinates if geocoding available
      enriched.enriched.locationGeo = null; // TODO: Integrate geocoding service
      enriched.enriched.actorType = data.roleName;
      break;

    case 'ProductCreated':
      // Track first appearance
      enriched.enriched.isNewProduct = true;
      enriched.enriched.productLabel = `${data.name} (#${data.productId})`;
      break;

    case 'ProductTransferred':
      // Calculate transfer speed (if we have previous transfer)
      enriched.enriched.transferDirection = getTransferDirection(data.from, data.to);
      enriched.enriched.transferLabel = `${data.from.slice(0, 6)}... → ${data.to.slice(0, 6)}...`;
      break;

    case 'ProductRecalled':
      // Flag for immediate attention
      enriched.enriched.priority = 'high';
      enriched.enriched.alertType = 'recall';
      break;
  }

  return enriched;
}

/**
 * Determine transfer direction based on actor roles
 */
function getTransferDirection(from, to) {
  // This would be enhanced with actual actor role lookup
  return 'forward'; // or 'backward', 'lateral'
}
