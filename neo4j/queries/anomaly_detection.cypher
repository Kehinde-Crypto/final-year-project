// ============================================
// Anomaly Detection Queries
// Supply Chain Knowledge Graph
// ============================================
// ============ RAPID TRANSFER DETECTION ============
// Find products transferred multiple times within a short period
// This could indicate wash trading or suspicious activity
// Query 1: Products with rapid successive transfers (< 1 hour)
MATCH (p:Product)<-[:TRANSFER_OF]-(t1:Transfer)
MATCH (p:Product)<-[:TRANSFER_OF]-(t2:Transfer)
WHERE
  t1.id < t2.id AND
  duration.inSeconds(datetime(t1.timestamp), datetime(t2.timestamp)).seconds <
  3600
RETURN
  p.id AS productId,
  p.name AS productName,
  t1.id AS firstTransferId,
  t2.id AS secondTransferId,
  t1.timestamp AS firstTime,
  t2.timestamp AS secondTime,
  duration.inSeconds(datetime(t1.timestamp), datetime(t2.timestamp)).seconds /
  60 AS minutesApart
ORDER BY minutesApart ASC
LIMIT 50;

// Query 2: Products transferred more than 3 times in 24 hours
MATCH (p:Product)<-[:TRANSFER_OF]-(t:Transfer)
WITH p, t
WHERE t.timestamp >= datetime() - duration('P1D')
WITH p, count(t) AS transferCount, collect(t) AS transfers
WHERE transferCount > 3
RETURN
  p.id AS productId,
  p.name AS productName,
  transferCount,
  [t IN transfers | {id: t.id, time: t.timestamp}] AS transferDetails
ORDER BY transferCount DESC;

// ============ BACKWARD TRANSFER DETECTION ============
// Find transfers that go against the supply chain flow
// Normal: Manufacturer → Supplier → Distributor → Retailer → Consumer

// Query 3: Identify backward transfers
MATCH (t:Transfer)-[:TRANSFERRED_FROM]->(from:Actor)
MATCH (t:Transfer)-[:TRANSFERRED_TO]->(to:Actor)
WHERE
  ((from.role = 'Supplier' AND to.role = 'Manufacturer') OR
    (from.role = 'Distributor' AND to.role IN ['Manufacturer', 'Supplier']) OR
    (from.role = 'Retailer' AND
      to.role IN ['Manufacturer', 'Supplier', 'Distributor']) OR
    (from.role = 'Consumer' AND
      to.role IN ['Manufacturer', 'Supplier', 'Distributor', 'Retailer']))
RETURN
  t.id AS transferId,
  t.productId,
  from.name AS fromName,
  from.role AS fromRole,
  to.name AS toName,
  to.role AS toRole,
  t.timestamp
ORDER BY t.timestamp DESC;

// ============ ORPHANED PRODUCTS ============
// Products without a current owner (data integrity issue)

// Query 4: Find products without CURRENTLY_OWNED_BY relationship
MATCH (p:Product)
WHERE NOT EXISTS { (p)-[:CURRENTLY_OWNED_BY]->(:Actor) }
RETURN p.id, p.name, p.status, p.createdAt
ORDER BY p.createdAt DESC;

// ============ RECALL IMPACT ANALYSIS ============
// Find all actors who handled a recalled product

// Query 5: Complete chain of custody for recalled products
MATCH (r:Recall)-[:RECALLED]->(p:Product)
OPTIONAL MATCH (p)<-[:TRANSFER_OF]-(t:Transfer)
OPTIONAL MATCH (t)-[:TRANSFERRED_FROM]->(from:Actor)
OPTIONAL MATCH (t)-[:TRANSFERRED_TO]->(to:Actor)
RETURN
  p.id AS productId,
  p.name AS productName,
  r.reason AS recallReason,
  r.timestamp AS recallTime,
  collect(DISTINCT from.name) AS previousHandlers,
  collect(DISTINCT to.name) AS recipients
ORDER BY r.timestamp DESC;

// ============ INACTIVE ACTOR ACTIVITY ============
// Transfers involving inactive actors

// Query 6: Find transfers involving inactive actors
MATCH (t:Transfer)-[:TRANSFERRED_FROM]->(from:Actor)
WHERE from.active = false
RETURN
  t.id AS transferId,
  t.productId AS productId,
  from.name AS inactiveActorName,
  from.role AS role,
  'SENDER' AS involvementType,
  t.timestamp AS timestamp
  UNION
MATCH (t:Transfer)-[:TRANSFERRED_TO]->(to:Actor)
WHERE to.active = false
RETURN
  t.id AS transferId,
  t.productId AS productId,
  to.name AS inactiveActorName,
  to.role AS role,
  'RECIPIENT' AS involvementType,
  t.timestamp AS timestamp
ORDER BY timestamp DESC;

// ============ SUPPLY CHAIN VELOCITY ============
// Products moving unusually fast or slow through the chain

// Query 7: Products with unusually fast full-chain traversal
// (< 1 day from Manufacturer to Consumer)
MATCH (p:Product)<-[:TRANSFER_OF]-(t:Transfer)
WITH p, min(t.timestamp) AS firstTransfer, max(t.timestamp) AS lastTransfer
WHERE
  duration.inSeconds(datetime(firstTransfer), datetime(lastTransfer)).seconds <
  86400 AND
  p.status = 'Sold'
RETURN
  p.id AS productId,
  p.name AS productName,
  firstTransfer,
  lastTransfer,
  duration.inSeconds(datetime(firstTransfer), datetime(lastTransfer)).seconds /
  3600 AS hoursInTransit
ORDER BY hoursInTransit ASC;

// ============ ACTOR CONCENTRATION ============
// Actors handling unusually high volume of products

// Query 8: Actors with high product concentration (potential bottleneck)
MATCH (a:Actor)<-[:CURRENTLY_OWNED_BY]-(p:Product)
WITH a, count(p) AS ownedProducts
WHERE ownedProducts > 10
RETURN a.name AS actorName, a.role AS actorRole, ownedProducts
ORDER BY ownedProducts DESC;

// ============ MISSING LINKS ============
// Products with gaps in their supply chain

// Query 9: Products that skipped a supply chain stage
// (e.g., went directly from Manufacturer to Retailer)
MATCH (t1:Transfer)-[:TRANSFERRED_FROM]->(from:Actor)
MATCH (t1:Transfer)-[:TRANSFERRED_TO]->(mid:Actor)
MATCH (t2:Transfer)-[:TRANSFERRED_FROM]->(mid:Actor)
MATCH (t2:Transfer)-[:TRANSFERRED_TO]->(to:Actor)
WHERE
  t1.productId = t2.productId AND
  t1.id < t2.id AND
  ((from.role = 'Manufacturer' AND mid.role = 'Distributor') OR
    (from.role = 'Manufacturer' AND mid.role = 'Retailer') OR
    (from.role = 'Supplier' AND mid.role = 'Retailer') OR
    (from.role = 'Distributor' AND mid.role = 'Consumer'))
RETURN
  t1.productId,
  from.role AS skippedFrom,
  mid.role AS expectedIntermediate,
  to.role AS skippedTo
LIMIT 20;