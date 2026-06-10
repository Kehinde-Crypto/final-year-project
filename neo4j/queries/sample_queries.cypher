// ============================================
// Sample Queries for Testing & Exploration
// Supply Chain Knowledge Graph
// ============================================
// ============ OVERVIEW QUERIES ============
// Query 1: Get overall statistics
CALL () {
  MATCH (a:Actor)
  RETURN count(a) AS totalActors
}
CALL () {
  MATCH (p:Product)
  RETURN count(p) AS totalProducts
}
CALL () {
  MATCH (t:Transfer)
  RETURN count(t) AS totalTransfers
}
CALL () {
  MATCH (r:Recall)
  RETURN count(r) AS totalRecalls
}
RETURN totalActors, totalProducts, totalTransfers, totalRecalls;

// Query 2: Actors by role distribution
MATCH (a:Actor)
RETURN a.role AS role, count(a) AS count
ORDER BY count DESC;

// Query 3: Products by status distribution
MATCH (p:Product)
RETURN p.status AS status, count(p) AS count
ORDER BY count DESC;

// ============ PRODUCT QUERIES ============

// Query 4: Get full product history
MATCH (p:Product {id: '1'})
OPTIONAL MATCH (p)<-[:TRANSFER_OF]-(t:Transfer)
OPTIONAL MATCH (t)-[:TRANSFERRED_FROM]->(from:Actor)
OPTIONAL MATCH (t)-[:TRANSFERRED_TO]->(to:Actor)
RETURN
  p.id AS productId,
  p.name AS productName,
  p.status,
  collect({
    transferId: t.id,
    from: from.name,
    fromRole: from.role,
    to: to.name,
    toRole: to.role,
    location: t.location,
    timestamp: t.timestamp
  }) AS history
ORDER BY p.id;

// Query 5: Products currently owned by an actor
MATCH (a:Actor {id: '0x123'})<-[:CURRENTLY_OWNED_BY]-(p:Product)
RETURN p.id, p.name, p.status, p.category
ORDER BY p.createdAt DESC;

// Query 6: Products by category
MATCH (p:Product)
WHERE p.category CONTAINS 'Electronics'
RETURN p.id, p.name, p.status, p.createdAt
ORDER BY p.createdAt DESC
LIMIT 50;

// ============ ACTOR QUERIES ============

// Query 7: Get actor details with products
MATCH (a:Actor {id: '0x123'})
OPTIONAL MATCH (a)<-[:CURRENTLY_OWNED_BY]-(p:Product)
RETURN
  a.id,
  a.name,
  a.role,
  a.location,
  a.active,
  a.registeredAt,
  count(p) AS currentProductCount,
  collect(p.name) AS currentProducts;

// Query 8: Find actors by name (fuzzy search)
CALL
  db.index.fulltext.queryNodes(
    'actor_name_fulltext',
    'Global'
  )
  YIELD node AS a
RETURN a.id, a.name, a.role, a.location
LIMIT 20;

// Query 9: All transfers involving an actor
MATCH (a:Actor {id: '0x123'})
MATCH (t:Transfer)-[:TRANSFERRED_FROM|TRANSFERRED_TO]->(a)
MATCH (t)-[:TRANSFER_OF]->(p:Product)
RETURN
  t.id AS transferId,
  p.name AS product,
  t.timestamp,
  CASE
    WHEN (t)-[:TRANSFERRED_FROM]->(a) THEN 'OUTGOING'
    WHEN (t)-[:TRANSFERRED_TO]->(a) THEN 'INCOMING'
  END AS direction
ORDER BY t.timestamp DESC
LIMIT 50;

// ============ SUPPLY CHAIN FLOW ============

// Query 10: Complete supply chain path for a product
MATCH
  path =
    (m:Actor)-[:TRANSFERRED_FROM*1..10]-
    (t:Transfer)-[:TRANSFERRED_TO*1..10]->
    (c:Actor)
WHERE EXISTS { (t)-[:TRANSFER_OF]->(:Product {id: '1'}) }
RETURN
  [node IN nodes(path) WHERE node:Actor | node.name] AS actorPath,
  [node IN nodes(path) WHERE node:Transfer | node.timestamp] AS timestamps,
  [rel IN relationships(path) | type(rel)] AS relationships
ORDER BY timestamps[0];

// Query 11: Products that went through a specific location
MATCH (t:Transfer)
WHERE t.location CONTAINS 'Warehouse'
MATCH (t)-[:TRANSFER_OF]->(p:Product)
MATCH (t)-[:TRANSFERRED_FROM]->(from:Actor)
MATCH (t)-[:TRANSFERRED_TO]->(to:Actor)
RETURN
  p.id AS productId,
  p.name AS productName,
  from.name AS sender,
  to.name AS receiver,
  t.location,
  t.timestamp
ORDER BY t.timestamp DESC;

// ============ TIME-BASED QUERIES ============

// Query 12: Transfers in the last N hours
MATCH (t:Transfer)
WHERE t.timestamp >= datetime() - duration({hours: 24})
MATCH (t)-[:TRANSFER_OF]->(p:Product)
MATCH (t)-[:TRANSFERRED_FROM]->(from:Actor)
MATCH (t)-[:TRANSFERRED_TO]->(to:Actor)
RETURN
  t.id,
  p.name AS product,
  from.name AS fromActor,
  to.name AS toActor,
  t.timestamp
ORDER BY t.timestamp DESC
LIMIT 100;

// Query 13: Activity summary by day
MATCH (t:Transfer)
WITH date(t.timestamp) AS day, count(t) AS transfers
ORDER BY day DESC
RETURN day, transfers
LIMIT 30;

// ============ RECALL QUERIES ============

// Query 14: All recalled products with reasons
MATCH (r:Recall)-[:RECALLED]->(p:Product)
OPTIONAL MATCH (p)-[:MANUFACTURED_BY]->(m:Actor)
RETURN
  p.id AS productId,
  p.name AS productName,
  m.name AS manufacturer,
  r.reason,
  r.recalledBy,
  r.timestamp
ORDER BY r.timestamp DESC;

// Query 15: Products at risk (in same category as recalled products)
MATCH (r:Recall)-[:RECALLED]->(recalled:Product)
MATCH (atRisk:Product)
WHERE
  atRisk.category = recalled.category AND
  atRisk.status <> 'Recalled' AND
  atRisk.id <> recalled.id
OPTIONAL MATCH (atRisk)-[:CURRENTLY_OWNED_BY]->(owner:Actor)
RETURN DISTINCT
  atRisk.id AS productId,
  atRisk.name AS productName,
  atRisk.category,
  owner.name AS currentOwner,
  owner.role AS ownerRole
LIMIT 50;