"""
FastAPI Server — LLM Query Interface for Supply Chain Knowledge Graph

This server provides the REST API that the frontend chat page consumes.
It receives natural language questions and returns answers by:
1. Taking raw JSON data + an action context from the frontend
  2. Formatting results into human-readable responses using Llama 3

Endpoints:
  POST /explain  — Explain raw supply chain data
  GET  /health   — Health check (verifies Neo4j + Ollama connectivity)
  GET  /schema   — Returns the current Neo4j graph schema

The frontend sends POST requests to /explain with:
  Request:  { "action": "Viewed Product #1", "data": { ...raw json... } }
  Response: { "response": "Product #1 is currently...", "success": true }

Usage:
  cd llm
  pip install -r requirements.txt
  python server.py
"""

import os
import logging

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any
from pydantic import BaseModel
import uvicorn

from chain import explain_data, create_neo4j_graph, create_llm, query_graph

# ── Configuration ────────────────────────────────────────
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── FastAPI App ──────────────────────────────────────────
app = FastAPI(
    title="Supply Chain LLM Server",
    description="Natural language query interface for the supply chain knowledge graph",
    version="1.0.0",
)

# CORS — Allow the Next.js frontend (localhost:3000) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response Models ────────────────────────────

class ExplainRequest(BaseModel):
    """Request body for the /explain endpoint."""
    action: str
    cypher_query: str


class ExplainResponse(BaseModel):
    """Response body for the /explain endpoint."""
    response: str
    success: bool = True


class ChatRequest(BaseModel):
    """Request body for the /chat endpoint."""
    query: str


class ChatResponse(BaseModel):
    """Response body for the /chat endpoint."""
    response: str
    success: bool = True


class HealthResponse(BaseModel):
    """Response body for the /health endpoint."""
    status: str
    neo4j: str
    ollama: str
    model: str


# ── Endpoints ────────────────────────────────────────────

@app.post("/explain", response_model=ExplainResponse)
async def explain(request: ExplainRequest):
    """
    Explain raw supply chain data using natural language.

    This is the main endpoint consumed by the frontend.
    The frontend passes the action the user took and the Cypher query.
    The server runs the query against Neo4j, gets the data, and the LLM explains it.

    Example:
        POST /explain
        {"action": "Viewed Product #1", "cypher_query": "MATCH (p:Product {id: '1'}) RETURN p"}

        Response:
        {"response": "Product #1 (Rolex) is currently In Transit.", "success": true}
    """
    if not request.action.strip() or not request.cypher_query.strip():
        raise HTTPException(status_code=400, detail="Action and cypher_query cannot be empty")

    logger.info(f"Explain request for action: {request.action}")

    try:
        # Run the cypher query to get raw data
        graph = create_neo4j_graph()
        raw_data = graph.query(request.cypher_query)
        
        # Send raw data to LLM to explain
        result = explain_data(request.action, raw_data)
        logger.info(f"Response: {result['response'][:100]}...")

        return ExplainResponse(
            response=result["response"],
            success=result.get("success", True),
        )

    except Exception as e:
        logger.error(f"Error processing explanation: {e}")
        return ExplainResponse(
            response=f"Sorry, I encountered an error processing the data: {str(e)}",
            success=False,
        )


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Experimental natural language query endpoint for the AI Assistant page.
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    logger.info(f"Chat request: {request.query}")

    try:
        result = query_graph(request.query)
        logger.info(f"Chat Response: {result['answer'][:100]}...")

        return ChatResponse(
            response=result["answer"],
            success=result.get("success", True),
        )

    except Exception as e:
        logger.error(f"Error processing chat: {e}")
        return ChatResponse(
            response=f"Sorry, I encountered an error: {str(e)}",
            success=False,
        )


@app.get("/health", response_model=HealthResponse)
async def health():
    """
    Health check — verifies connectivity to Neo4j and Ollama.

    Returns the status of each dependency so you can diagnose issues.
    """
    neo4j_status = "disconnected"
    ollama_status = "disconnected"
    model = os.getenv("OLLAMA_MODEL", "llama3")

    # Check Neo4j
    try:
        graph = create_neo4j_graph()
        graph.refresh_schema()
        neo4j_status = "connected"
        logger.info("Health check: Neo4j connected")
    except Exception as e:
        neo4j_status = f"error: {str(e)[:100]}"
        logger.warning(f"Health check: Neo4j failed - {e}")

    # Check Ollama
    try:
        llm = create_llm()
        llm.invoke("Hello")
        ollama_status = "connected"
        logger.info("Health check: Ollama connected")
    except Exception as e:
        ollama_status = f"error: {str(e)[:100]}"
        logger.warning(f"Health check: Ollama failed - {e}")

    overall = "healthy" if neo4j_status == "connected" and ollama_status == "connected" else "degraded"

    return HealthResponse(
        status=overall,
        neo4j=neo4j_status,
        ollama=ollama_status,
        model=model,
    )


@app.get("/schema")
async def schema():
    """
    Returns the current Neo4j graph schema.

    Useful for debugging — shows what node labels, relationship types,
    and properties exist in the knowledge graph.

    This schema is auto-detected by LangChain from the actual Neo4j data,
    which was written by the Transformer service from blockchain events.
    """
    try:
        graph = create_neo4j_graph()
        return {
            "schema": graph.schema,
            "structured_schema": graph.structured_schema,
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Cannot connect to Neo4j: {str(e)}",
        )


# ── Startup ──────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    """Log server configuration on startup."""
    logger.info("=" * 60)
    logger.info("Supply Chain LLM Server Starting")
    logger.info("=" * 60)
    logger.info(f"  Neo4j:  {os.getenv('NEO4J_URI', 'bolt://localhost:7687')}")
    logger.info(f"  Ollama: {os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')}")
    logger.info(f"  Model:  {os.getenv('OLLAMA_MODEL', 'llama3')}")
    logger.info(f"  Server: http://localhost:{os.getenv('PORT', '8000')}")
    logger.info("=" * 60)
    logger.info("")
    logger.info("Frontend should connect to: POST http://localhost:8000/explain")
    logger.info("")


# ── Entry Point ──────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")

    uvicorn.run(
        "server:app",
        host=host,
        port=port,
        reload=True,  # Auto-reload on code changes (development)
        log_level="info",
    )
