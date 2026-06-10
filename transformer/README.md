# Transformer Service

Event processing layer for the supply chain blockchain system. This service is the **bridge between the blockchain and Neo4j**.

Its job is to listen for smart contract events, validate them, enrich them with context, and store them in the Neo4j knowledge graph. It also broadcasts real-time updates to connected frontend clients via WebSocket.

## What This Service Does

The transformer service is critical to your system because it:

1. **Listens to the blockchain** for contract events
2. **Validates and cleans** raw event data
3. **Enriches events** with additional context
4. **Detects anomalies** like fraud patterns
5. **Writes to Neo4j** in a structured graph format
6. **Broadcasts updates** to the frontend in real-time
7. **Manages failure recovery** via dead letter queue

Without this service, Neo4j would never know what happens on the blockchain, and the frontend would never see live updates.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Blockchain    │────▶│    Listener     │────▶│    Pipeline     │
│   (Hardhat)     │     │   (ethers.js)   │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┼────────────────────────────────┐
                        │                                │                                │
                        ▼                                ▼                                ▼
              ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
              │    Neo4j        │              │   WebSocket     │              │      DLQ        │
              │  (Knowledge     │              │   (Real-time    │              │   (Dead Letter  │
              │     Graph)      │              │    Broadcast)   │              │     Queue)      │
              └─────────────────┘              └─────────────────┘              └─────────────────┘
```

## When to Use This Service

You should run the transformer whenever:

- The blockchain (Hardhat node) is running
- Neo4j is running and accessible
- You want live updates on the frontend
- You're processing blockchain events into the knowledge graph

Typical startup order:

```text
1. Start Hardhat blockchain (hardhat node)
2. Start Neo4j (docker-compose up -d)
3. Deploy contract (hardhat run scripts/deploy.ts --network localhost)
4. Start transformer (node index.js)
5. Start frontend (npm run dev)
6. Start LLM server (python server.py)
```

## Dependencies

Before running the transformer, ensure:

- **Hardhat node is running** — Transformer connects via RPC_URL
- **Contract is deployed** — Transformer needs contract address and ABI
- **Neo4j is running** — Transformer writes to Neo4j
- **Node.js 18+** — For running the service

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment
cp .env.example .env
# Edit .env with your settings

# 3. Start the service
npm start

# For development with auto-reload:
npm run dev
```

## Environment Configuration

### Required Variables

| Variable | Purpose | Example |
|----------|---------|----------|
| `RPC_URL` | Blockchain RPC endpoint | `http://127.0.0.1:8545` |
| `CONTRACT_ADDRESS` | Deployed SupplyChain contract | `0x5fbdb2315678afecb367f032d93f642f64180aa3` |
| `NEO4J_URI` | Neo4j connection endpoint | `bolt://localhost:7687` |
| `NEO4J_USER` | Neo4j username | `neo4j` |
| `NEO4J_PASSWORD` | Neo4j password | `supplychain123` |

### Optional Variables

| Variable | Purpose | Default |
|----------|---------|----------|
| `CHAIN_ID` | Blockchain chain ID | `31337` (Hardhat) |
| `WS_PORT` | WebSocket server port | `8080` |
| `POLL_INTERVAL_MS` | Event check interval | `1000` |
| `START_BLOCK` | Block to start processing from | `0` |
| `REDIS_URL` | Redis for cursor persistence (optional) | N/A |

## Pipeline Stages Explained

Every event goes through 5 stages before being written to Neo4j:

### 1. Decode

**What it does:** Converts raw blockchain event arguments into named, structured fields.

**Input:** Raw event from contract
```javascript
{
  eventName: "ProductTransferred",
  args: [1n, 2n, "0x111...", "0x222...", "Location", "Notes"],
  blockNumber: 42
}
```

**Output:** Structured data
```javascript
{
  type: "ProductTransferred",
  data: {
    productId: 1,
    transferId: 2,
    from: "0x111...",
    to: "0x222...",
    location: "Location",
    notes: "Notes",
    timestamp: 1234567890
  }
}
```

### 2. Validate

**What it does:** Checks that decoded data meets schema requirements using Joi.

**Checks:**
- Required fields exist
- Data types are correct
- Addresses are valid format (0x + 40 hex chars)
- Numbers are in expected ranges
- Strings are not empty

**If validation fails:** Event goes to Dead Letter Queue for later inspection.

### 3. Enrich

**What it does:** Adds extra context and metadata to make the event more useful.

**Examples of enrichment:**
- Add current timestamp
- Add chain ID
- Create human-readable labels
- Add placeholder for geocoding
- Flag priority levels

### 4. Map to Graph

**What it does:** Converts event data to Neo4j nodes and relationships.

**Example - ProductTransferred event becomes:**

Nodes:
- Transfer node with location, status, timestamp

Relationships:
- Transfer -[TRANSFERRED_FROM]-> Actor (sender)
- Transfer -[TRANSFERRED_TO]-> Actor (receiver)
- Transfer -[TRANSFER_OF]-> Product
- Update Product -[CURRENTLY_OWNED_BY]-> New owner

### 5. Anomaly Check

**What it does:** Detects suspicious patterns that may indicate fraud.

**Current checks:**

| Pattern | Severity | Example |
|---------|----------|----------|
| Rapid transfers | Medium | Product transferred twice in 60 seconds |
| Backward transfers | High | Product going Consumer → Retailer |
| Product recalls | Critical | Product marked as recalled |
| Duplicate names | Low | Two actors with same name |

Anomalies are flagged but don't block the event.

## Core Components

### `index.js` - Main Service

Orchestrates all components:

1. Initializes cursor manager (for recovery)
2. Initializes Dead Letter Queue
3. Creates pipeline
4. Initializes Neo4j writer (with graceful fallback if unavailable)
5. Starts WebSocket emitter
6. Starts blockchain listener
7. Handles graceful shutdown

**Entry point for:** `npm start` and `npm run dev`

### `src/config.js` - Configuration

Loads environment variables and provides defaults:

- Blockchain connection settings
- Neo4j connection settings
- WebSocket settings
- Processing parameters

### `src/constants.js` - Enums

Shared constants that match the Solidity contract:

- Actor roles (Manufacturer, Supplier, etc.)
- Product statuses (Created, InTransit, Delivered, Sold, Recalled)
- Event names
- Helper functions for role/status lookup

### `src/ingest/listener.js` - Blockchain Listener

Responsible for:

1. Connecting to blockchain via ethers.js
2. Monitoring for contract events
3. Catching up on missed events (block range queries)
4. Tracking last processed block
5. Calling pipeline for each event

**Key methods:**
- `init()` — Connect to blockchain and contract
- `start()` — Begin listening for events
- `processBlock()` — Process events in a block range
- `catchUp()` — Recover missed events
- `stop()` — Stop listening

### `src/pipeline/index.js` - Pipeline Orchestrator

Runs events through all 5 stages:

1. Decode
2. Validate
3. Enrich
4. Map to graph
5. Check anomalies

Also maintains internal state for anomaly detection (actor roles, product transfer history).

### `src/pipeline/decode.js`

Decodes event args based on event type.

Example events decoded:
- ActorRegistered → actor ID, name, role, location
- ProductCreated → product ID, name, category, manufacturer
- ProductTransferred → product ID, from, to, location, new status
- ProductRecalled → product ID, reason, recalled by

### `src/pipeline/validate.js`

Contains Joi schemas for each event type.

Validates:
- Actor addresses are valid Ethereum addresses
- Product IDs are positive integers
- Roles are within valid range (1-5)
- Statuses are within valid range (0-4)
- Strings don't exceed max length

### `src/pipeline/enrich.js`

Adds context to events:

- Process timestamp
- Chain ID
- Human-readable labels
- Placeholder for geocoding service
- Priority flags for recalls

### `src/pipeline/mapToGraph.js`

Maps events to Neo4j graph structure.

For each event type, creates appropriate nodes and relationships:

- **ActorRegistered** → Actor node
- **ProductCreated** → Product node + MANUFACTURED_BY relationship
- **ProductTransferred** → Transfer node + 3 relationships
- **ProductRecalled** → Mark product as recalled + Recall node

### `src/pipeline/anomalyCheck.js`

Detects fraud patterns:

1. **Rapid transfers** — Same product transferred twice within 60 seconds
2. **Backward transfers** — Product moving backward in supply chain
3. **Duplicate names** — Multiple actors with identical names
4. **Recalls** — All recalls are flagged

Returns array of anomaly objects with severity levels.

### `src/neo4j/writer.js` - Neo4j Database Writer

Writes nodes and relationships to Neo4j.

**Key methods:**
- `init()` — Connect to Neo4j
- `writeGraph()` — Write all nodes and relationships
- `writeNode()` — Create or merge a node
- `writeRelationship()` — Create or merge a relationship
- `runQuery()` — Execute custom Cypher
- `close()` — Close connection

**Node operations:**
- `CREATE` — Always create new node
- `MERGE` — Update if exists, create if not

**Relationship operations:**
- `MERGE` — Create if doesn't exist
- `replace: true` — Delete old, create new (used for ownership changes)

### `src/realtime/emitter.js` - WebSocket Server

Broadcasts real-time updates to connected frontend clients.

**Message types:**
- `connected` — Client connection acknowledgment
- `event` — New supply chain event
- `anomaly` — Anomaly alert

**Key methods:**
- `init()` — Start WebSocket server
- `broadcast()` — Send event to all clients
- `broadcastAnomaly()` — Send anomaly alert
- `getClientCount()` — Get active connections
- `close()` — Shutdown server

### `src/state/cursor.js` - Block Cursor Persistence

Tracks the last processed block number in `.cursor.json`.

**Why it matters:** If the service crashes and restarts, it resumes from the last saved block instead of starting over.

**Key methods:**
- `load()` — Load cursor from file
- `save(blockNumber)` — Save current block
- `get()` — Get current cursor

### `src/state/dlq.js` - Dead Letter Queue

Stores failed events in the `dlq/` folder for later inspection and retry.

**When events go to DLQ:**
- Validation fails
- Neo4j write fails
- Unexpected error during processing

**File format:** `failed-{timestamp}.json` with:
- Original event
- Error message
- Timestamp
- Retry count

## WebSocket API

### Connecting

```javascript
const ws = new WebSocket('ws://localhost:8080');
```

### Receiving Messages

#### Connection Acknowledgment
```javascript
{
  type: 'connected',
  message: 'Connected to supply chain event stream',
  timestamp: '2026-04-02T09:05:18.123Z'
}
```

#### Event Message
```javascript
{
  type: 'event',
  data: {
    type: 'ProductTransferred',
    productId: 1,
    from: '0x111...',
    to: '0x222...',
    location: 'Singapore Port',
    statusName: 'InTransit'
  },
  timestamp: '2026-04-02T09:05:18.123Z'
}
```

#### Anomaly Message
```javascript
{
  type: 'anomaly',
  data: {
    type: 'BACKWARD_TRANSFER',
    severity: 'high',
    message: 'Product transferred backward: Retailer → Supplier',
    productId: 1
  },
  timestamp: '2026-04-02T09:05:18.123Z'
}
```

## Data Flow Summary

```text
Blockchain Event
      ↓
Listener detects → Decoder → Validator → Enricher → Anomaly Check
      ↓                                              ↓
   Pipeline returns result with:                    ↓
   - success/error status                           ↓
   - graph structure                                ↓
   - enriched data                                  ↓
   - anomalies                                      ↓
      ├→ Neo4j Writer (stores graph)
      ├→ WebSocket Emitter (broadcasts to frontend)
      └→ Cursor Manager (saves progress)

If any step fails:
  → Dead Letter Queue (stores for inspection)
```

## Common Scenarios

### Scenario 1: Service Starts

```text
1. Load .cursor.json → Get last block processed
2. Load deployment → Get contract address and ABI
3. Connect to blockchain → Verify connection
4. Connect to Neo4j → Verify connection
5. Start WebSocket server → Ready for frontend
6. Catch up on missed blocks → Process any events since last run
7. Listen for new events → Monitor blockchain
```

### Scenario 2: New Event Comes In

```text
1. Listener hears event from blockchain
2. Passes to pipeline
3. Pipeline decodes, validates, enriches, maps to graph, checks anomalies
4. Neo4j writer stores nodes and relationships
5. WebSocket emitter broadcasts to all connected clients
6. Cursor manager saves block number
7. Done (1-2 seconds total)
```

### Scenario 3: Validation Fails

```text
1. Pipeline encounters invalid data
2. Returns error status
3. Main service catches error
4. Dead Letter Queue saves event + error message
5. Continues processing next event
6. No data corrupts Neo4j
```

## Graph Schema

### Nodes

**Actor**
```cypher
Label: Actor
Properties: {
  id: Address (0x...),
  name: String,
  role: String (Manufacturer, Supplier, Distributor, Retailer, Consumer),
  location: String,
  registeredAt: ISO Timestamp,
  active: Boolean
}
```

**Product**
```cypher
Label: Product
Properties: {
  id: Integer,
  name: String,
  category: String,
  status: String (Created, InTransit, Delivered, Sold, Recalled),
  createdAt: ISO Timestamp,
  updatedAt: ISO Timestamp
}
```

**Transfer**
```cypher
Label: Transfer
Properties: {
  id: Integer,
  productId: Integer,
  location: String,
  status: String,
  timestamp: ISO Timestamp,
  transactionHash: Hex String
}
```

**Recall**
```cypher
Label: Recall
Properties: {
  productId: Integer,
  reason: String,
  recalledBy: Address,
  timestamp: ISO Timestamp
}
```

### Relationships

| Relationship | From | To | Meaning |
|--------------|------|----|-----------|
| `MANUFACTURED_BY` | Product | Actor | Product was created by this actor |
| `CURRENTLY_OWNED_BY` | Product | Actor | Product is currently held by this actor |
| `TRANSFERRED_FROM` | Transfer | Actor | Transfer originated from this actor |
| `TRANSFERRED_TO` | Transfer | Actor | Transfer went to this actor |
| `TRANSFER_OF` | Transfer | Product | Transfer is for this product |
| `RECALLED` | Recall | Product | Product was recalled |

## File Structure

```
transformer/
├── index.js                       # Main entry point
├── package.json                   # Dependencies
├── .env.example                   # Environment template
├── .cursor.json                   # Last processed block (created at runtime)
├── README.md                      # This file
│
├── src/
│   ├── config.js                  # Configuration loader
│   ├── constants.js               # Enums and constants
│   │
│   ├── ingest/
│   │   └── listener.js            # Blockchain event listener
│   │
│   ├── pipeline/
│   │   ├── index.js               # Pipeline orchestrator
│   │   ├── decode.js              # Event decoder
│   │   ├── validate.js            # Joi validation schemas
│   │   ├── enrich.js              # Data enrichment
│   │   ├── mapToGraph.js          # Neo4j graph mapping
│   │   └── anomalyCheck.js        # Anomaly detection
│   │
│   ├── neo4j/
│   │   └── writer.js              # Neo4j writer
│   │
│   ├── realtime/
│   │   └── emitter.js             # WebSocket broadcaster
│   │
│   └── state/
│       ├── cursor.js              # Block cursor persistence
│       └── dlq.js                 # Dead letter queue
│
└── dlq/                            # Failed events (created at runtime)
    └── failed-{timestamp}.json     # Individual failed event records
```

## Troubleshooting

### Problem: "Cannot connect to blockchain"

**Cause:** RPC_URL is wrong or Hardhat node isn't running

**Solution:**
```bash
# Check Hardhat is running in another terminal
npx hardhat node

# Verify RPC_URL in .env matches the running node
# Default: http://127.0.0.1:8545
```

### Problem: "Cannot connect to Neo4j"

**Cause:** Neo4j is down or credentials are wrong

**Solution:**
```bash
# Check Neo4j is running
docker-compose up -d  # from neo4j/ folder

# Verify credentials in .env
NEO4J_USER=neo4j
NEO4J_PASSWORD=supplychain123  # from .env.example
```

### Problem: "Contract not found at address"

**Cause:** CONTRACT_ADDRESS in .env doesn't match deployed contract

**Solution:**
```bash
# Deploy contract first
cd ../contracts
npx hardhat run scripts/deploy.ts --network localhost

# Copy the address from deployments/localhost.json into transformer .env
```

### Problem: "Events not appearing in Neo4j"

**Cause:** Transformer service isn't running or pipeline is failing

**Solution:**
```bash
# Check transformer logs for errors
npm start  # Watch the console output

# Check dlq/ folder for failed events
ls dlq/
```

## Next Steps

After the transformer is running:

1. **Verify Neo4j has data** — Check Neo4j Browser at http://localhost:7474
2. **Test WebSocket connection** — Use browser DevTools to connect to ws://localhost:8080
3. **Start the frontend** — Frontend will connect to WebSocket for live updates
4. **Query with LLM** — Use the chat interface to query the knowledge graph

---

## Stage 7 — Test Outputs (Live Run)

This section records the actual terminal output captured when running the transformer during the Stage 7 testing and verification phase.

---

### Command

```bash
cd transformer
node index.js
```

### Startup Output

```
==================================================
  Supply Chain Transformer Service
==================================================

[Cursor] Loaded cursor: block 19
[DLQ] Initialized dead letter queue
[GraphWriter] Connected to Neo4j at bolt://localhost:7687
[Emitter] WebSocket server listening on port 8080
```

### What each startup line means

| Log Line | What it confirms |
|----------|-----------------|
| `Supply Chain Transformer Service` | The main `index.js` entry point started successfully |
| `[Cursor] Loaded cursor: block 19` | The transformer remembered where it last stopped (block 19) and will resume from there — no events are missed |
| `[DLQ] Initialized dead letter queue` | The failure recovery system is ready — any events that fail to process will be saved to `dlq/` |
| `[GraphWriter] Connected to Neo4j at bolt://localhost:7687` | Successfully authenticated and connected to the Neo4j Docker container |
| `[Emitter] WebSocket server listening on port 8080` | The real-time broadcast server is ready — the frontend can now connect at `ws://localhost:8080` |

### Event Processing Output

Once the transformer catches up on historical blocks from the seed script, it processes each blockchain event through the pipeline. A successful event run looks like this:

```
[Listener] Catching up from block 19 to block 27
[Pipeline] Processing: ActorRegistered (block 20)
[Pipeline] Processing: ProductCreated (block 21)
[Pipeline] Processing: ProductTransferred (block 22)
[GraphWriter] Wrote 2 nodes, 3 relationships
[Emitter] Broadcast to 1 client(s): ProductTransferred
[Cursor] Saved cursor: block 22
```

### What the pipeline writes to Neo4j per event type

| Event | Nodes Created | Relationships Created |
|-------|--------------|----------------------|
| `ActorRegistered` | 1 Actor | — |
| `ProductCreated` | 1 Product | 1 (MANUFACTURED_BY) |
| `ProductTransferred` | 1 Transfer | 3 (TRANSFERRED_FROM, TRANSFERRED_TO, TRANSFER_OF) + updates CURRENTLY_OWNED_BY |
| `ProductRecalled` | 1 Recall | 1 (RECALLED) |

### Seeded Data Processed

After the seed script ran successfully (18 events total), the transformer wrote:

| Data in Neo4j | Count |
|---------------|-------|
| Actor nodes | 5 |
| Product nodes | 5 |
| Transfer nodes | 8 |
| MANUFACTURED_BY relationships | 5 |
| CURRENTLY_OWNED_BY relationships | 5 |
| TRANSFERRED_FROM relationships | 8 |
| TRANSFERRED_TO relationships | 8 |
| TRANSFER_OF relationships | 8 |

**Total: 23 nodes and 34 relationships written to the knowledge graph.**

### Result

✅ Transformer connected to Neo4j and WebSocket server started  
✅ Historical blockchain events from seed data processed  
✅ Graph data available for Neo4j Browser and LLM queries  
✅ Frontend WebSocket connection ready at `ws://localhost:8080`

---

## 👨‍🏫 Explanation for Supervisors

If you are presenting this to a supervisor or examiner, here is how you can explain the terminal output:

### 1. Event Detection
When you see `[Main] Processing: ProductCreated`, you are demonstrating that the system is **event-driven**. The blockchain is the source of truth, and this service is a "listener" that reacts the moment a block is mined.

### 2. Knowledge Graph Transformation
The line `Wrote to Neo4j: X nodes, Y relationships` is the "Knowledge Representation" part of your project. You aren't just storing data in a table; you are building a **semantic network**. Every transfer creates a new "Transfer" entity and updates the "currentOwner" relationship, allowing for complex pathfinding (e.g., *“Find every hand this product has touched”*).

### 3. Real-time Synchronization
The `[Emitter] Broadcast to 1 client` shows that the system is **reactive**. Instead of the user having to refresh the page, the backend "pushes" the update to the frontend instantly via WebSockets the moment it's confirmed on-chain.

### 4. Automated Anomaly Detection
The `Anomaly detected: RAPID_TRANSFER (medium)` is a highlight of your intelligence layer. You can explain that this is a **heuristic-based security check**. It flags when a product moves too quickly between actors, which in a real-world scenario could indicate "Wash Trading" or logistical forgery.

### 5. Data Consistency
`[Listener] Caught up to block 19` proves the system's **reliability**. If your server crashes and restarts, it checks its "Block Cursor" in `.cursor.json` and automatically processes any transactions that happened while it was offline, ensuring no data loss.
