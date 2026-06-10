# Neo4j Knowledge Graph

Neo4j graph database configuration for the supply chain knowledge representation system.

## Quick Start

```bash
# Start Neo4j
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f neo4j

# Stop Neo4j
docker-compose down
```

## Access

| Service | URL | Credentials |
|---------|-----|-------------|
| Browser UI | http://localhost:7474 | neo4j / supplychain123 |
| Bolt Protocol | bolt://localhost:7687 | neo4j / supplychain123 |

## Schema Setup

After starting Neo4j, run the constraints and indexes:

```bash
# Using cypher-shell (inside container)
docker exec -it supplychain-neo4j cypher-shell -u neo4j -p supplychain123 -f /var/lib/neo4j/init-scripts/constraints.cypher
```

Or run the contents of `schema/constraints.cypher` in the Neo4j Browser.

## Graph Model

### Nodes

| Label | Properties | Description |
|-------|------------|-------------|
| **Actor** | id, name, role, location, active, registeredAt | Supply chain participant |
| **Product** | id, name, category, status, createdAt, updatedAt | Tracked item |
| **Transfer** | id, productId, location, status, timestamp, transactionHash | Transfer event |
| **Recall** | id, productId, reason, recalledBy, timestamp | Recall event |

### Relationships

| Type | From → To | Description |
|------|-----------|-------------|
| MANUFACTURED_BY | Product → Actor | Product manufacturer |
| CURRENTLY_OWNED_BY | Product → Actor | Current owner (single) |
| TRANSFERRED_FROM | Transfer → Actor | Transfer sender |
| TRANSFERRED_TO | Transfer → Actor | Transfer recipient |
| TRANSFER_OF | Transfer → Product | Transfer subject |
| RECALLED | Recall → Product | Recall target |

## File Structure

```
neo4j/
├── docker-compose.yml           # Docker configuration
├── README.md                    # This file
├── schema/
│   └── constraints.cypher       # Constraints and indexes
└── queries/
    ├── anomaly_detection.cypher # Anomaly detection queries
    └── sample_queries.cypher    # Example queries
```

## Sample Queries

### Get all products with their owners

```cypher
MATCH (p:Product)-[:CURRENTLY_OWNED_BY]->(a:Actor)
RETURN p.name AS product, a.name AS owner, a.role AS ownerRole;
```

### Find complete supply chain path for a product

```cypher
MATCH (p:Product {id: 1})<-[:TRANSFER_OF]-(t:Transfer)
MATCH (t)-[:TRANSFERRED_FROM]->(from:Actor)
MATCH (t)-[:TRANSFERRED_TO]->(to:Actor)
RETURN from.name, to.name, t.timestamp
ORDER BY t.timestamp;
```

### Detect rapid transfers (potential anomaly)

```cypher
MATCH (p:Product)<-[:TRANSFER_OF]-(t1:Transfer)
MATCH (p:Product)<-[:TRANSFER_OF]-(t2:Transfer)
WHERE t1.id < t2.id
AND duration.between(datetime(t1.timestamp), datetime(t2.timestamp)).minutes < 60
RETURN p.name, t1.timestamp, t2.timestamp;
```

## Integration with Transformer

The transformer service automatically:
1. Listens for blockchain events
2. Decodes and validates event data
3. Maps events to graph nodes/relationships
4. Writes to Neo4j via Bolt protocol

Configure in `transformer/.env`:

```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=supplychain123
```

## Troubleshooting

### Connection refused

```bash
# Check if Neo4j is running
docker-compose ps

# Check logs for errors
docker-compose logs neo4j
```

### Memory issues

Edit `docker-compose.yml` to increase heap size:

```yaml
NEO4J_dbms_memory_heap_max__size=2G
```

### Reset database

```bash
docker-compose down -v  # Remove volumes
docker-compose up -d    # Start fresh
```
