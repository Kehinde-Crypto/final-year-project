# LLM Integration Layer — Stage 6

Natural language query interface for the supply chain knowledge graph. Users ask questions in plain English, and the system translates them into Cypher queries, runs them against Neo4j, and returns human-readable answers.

## Architecture

```
User: "Where is product #1?"
         │
         ▼
┌─────────────────────────────────────────────────┐
│  FastAPI Server (server.py)                     │
│  POST /chat ← Frontend sends questions here    │
│         │                                       │
│         ▼                                       │
│  LangChain Pipeline (chain.py)                  │
│    1. Load Neo4j schema automatically           │
│    2. Feed schema + question to Llama 3         │
│    3. Llama 3 generates Cypher query            │
│    4. Execute Cypher against Neo4j              │
│    5. Llama 3 formats results to English        │
│         │                                       │
│         ▼                                       │
│  Response: "Product #1 is currently held by..." │
└─────────────────────────────────────────────────┘
```

## Prerequisites

- **Python 3.10+** (you have 3.13)
- **Ollama** — Runs Llama 3 locally (https://ollama.com)
- **Docker** — Runs Neo4j database
- **Neo4j running** — `cd neo4j && docker-compose up -d`

## Setup

### 1. Pull the Llama 3 model (one-time)

```bash
ollama pull llama3
```

### 2. Install Python dependencies

```bash
cd llm
pip install -r requirements.txt
```

### 3. Configure environment

The `.env` file is pre-configured to match the Neo4j Docker container:

```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=supplychain123
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

### 4. Start the server

```bash
python server.py
```

The server starts at `http://localhost:8000`.

## API Reference

### POST /chat

Ask a natural language question about the supply chain.

**Request:**
```json
{
  "query": "Where is product #1?"
}
```

**Response:**
```json
{
  "response": "Product #1 (Galaxy S24) is currently held by Global Supplies Ltd, a Supplier located in Singapore.",
  "cypher": "MATCH (p:Product {id: 1})-[:CURRENTLY_OWNED_BY]->(a:Actor) RETURN p.name, a.name, a.role, a.location",
  "success": true
}
```

### GET /health

Check connectivity to Neo4j and Ollama.

**Response:**
```json
{
  "status": "healthy",
  "neo4j": "connected",
  "ollama": "connected",
  "model": "llama3"
}
```

### GET /schema

Returns the current Neo4j graph schema (node labels, relationships, properties).

## Example Questions

| Question | What it does |
|----------|-------------|
| "How many products are in the system?" | Counts all Product nodes |
| "Where is product #1?" | Finds current owner via CURRENTLY_OWNED_BY |
| "Show all manufacturers" | Filters Actors by role="Manufacturer" |
| "What is the journey of product #2?" | Follows Transfer chain for a product |
| "Are there any recalled products?" | Checks for Recall nodes |
| "Show all active actors" | Filters Actors by active=true |
| "Find any anomalies" | Looks for suspicious transfer patterns |

## How It Works

### The Query Pipeline

1. **User asks a question** via the frontend chat (`/chat` page)
2. **Frontend sends POST** to `http://localhost:8000/chat`
3. **LangChain reads the Neo4j schema** (node types, relationships, properties)
4. **Llama 3 generates a Cypher query** using the schema + question + system prompt
5. **Cypher query executes** against Neo4j (the knowledge graph built by the Transformer)
6. **Llama 3 formats the results** into a natural language answer
7. **Answer is returned** to the frontend and displayed in the chat

### The Knowledge Graph Data Source

The data in Neo4j comes from the **Transformer service** (Stage 3), which:
- Listens for blockchain events from `SupplyChain.sol`
- Processes them through a 5-stage pipeline (decode → validate → enrich → map → anomaly check)
- Writes structured nodes and relationships to Neo4j

So when you ask "Where is product #1?", the LLM queries data that originated from an actual blockchain transaction.

## File Structure

```
llm/
├── server.py                    # FastAPI server (entry point)
├── chain.py                     # LangChain QA pipeline
├── prompts/
│   └── cypher_prompt.txt        # System prompt for Cypher generation
├── requirements.txt             # Python dependencies
├── .env                         # Environment variables
├── .env.example                 # Environment template
└── README.md                    # This file
```

## Running the Full System

To see the LLM in action, you need all services running:

```bash
# Terminal 1: Hardhat blockchain
cd contracts && npx hardhat node

# Terminal 2: Deploy + seed data
cd contracts && npx hardhat run scripts/deploy.ts --network localhost
cd contracts && npx hardhat run scripts/seed.ts --network localhost

# Terminal 3: Neo4j database
cd neo4j && docker-compose up -d

# Terminal 4: Transformer (bridges blockchain → Neo4j)
cd transformer && node index.js

# Terminal 5: LLM server
cd llm && python server.py

# Terminal 6: Frontend
cd frontend && npm run dev
```

Then open `http://localhost:3000/chat` and start asking questions.

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Cannot connect to Neo4j" | Run `cd neo4j && docker-compose up -d` |
| "Cannot connect to Ollama" | Make sure Ollama is running (`ollama serve`) |
| "Model not found" | Run `ollama pull llama3` |
| "Empty responses" | The Neo4j database may be empty — run the Transformer + seed data first |
| CORS errors in browser | The server allows `localhost:3000` by default |
