// ============================================
// Neo4j Schema Constraints and Indexes
// Supply Chain Knowledge Graph
// ============================================

// ============ UNIQUE CONSTRAINTS ============

// Actor nodes - unique by address
CREATE CONSTRAINT actor_id_unique IF NOT EXISTS
FOR (a:Actor) REQUIRE a.id IS UNIQUE;

CREATE CONSTRAINT actor_id_exists IF NOT EXISTS
FOR (a:Actor) REQUIRE a.id IS NOT NULL;

// Product nodes - unique by ID
CREATE CONSTRAINT product_id_unique IF NOT EXISTS
FOR (p:Product) REQUIRE p.id IS UNIQUE;

CREATE CONSTRAINT product_id_exists IF NOT EXISTS
FOR (p:Product) REQUIRE p.id IS NOT NULL;

// Transfer nodes - unique by ID
CREATE CONSTRAINT transfer_id_unique IF NOT EXISTS
FOR (t:Transfer) REQUIRE t.id IS UNIQUE;

CREATE CONSTRAINT transfer_id_exists IF NOT EXISTS
FOR (t:Transfer) REQUIRE t.id IS NOT NULL;

// Recall nodes - composite unique key
CREATE CONSTRAINT recall_id_unique IF NOT EXISTS
FOR (r:Recall) REQUIRE r.id IS UNIQUE;

// ============ INDEXES FOR PERFORMANCE ============

// Index Actor by role for role-based queries
CREATE INDEX actor_role_index IF NOT EXISTS
FOR (a:Actor) ON (a.role);

// Index Actor by active status
CREATE INDEX actor_active_index IF NOT EXISTS
FOR (a:Actor) ON (a.active);

// Index Product by status
CREATE INDEX product_status_index IF NOT EXISTS
FOR (p:Product) ON (p.status);

// Index Product by category
CREATE INDEX product_category_index IF NOT EXISTS
FOR (p:Product) ON (p.category);

// Index Transfer by timestamp for time-based queries
CREATE INDEX transfer_timestamp_index IF NOT EXISTS
FOR (t:Transfer) ON (t.timestamp);

// Index Transfer by productId for product history
CREATE INDEX transfer_product_index IF NOT EXISTS
FOR (t:Transfer) ON (t.productId);

// Index Recall by timestamp
CREATE INDEX recall_timestamp_index IF NOT EXISTS
FOR (r:Recall) ON (r.timestamp);

// ============ FULLTEXT INDEXES ============

// Fulltext search on Actor names
CREATE FULLTEXT INDEX actor_name_fulltext IF NOT EXISTS
FOR (a:Actor) ON EACH [a.name, a.location];

// Fulltext search on Product names and descriptions
CREATE FULLTEXT INDEX product_name_fulltext IF NOT EXISTS
FOR (p:Product) ON EACH [p.name, p.category];
