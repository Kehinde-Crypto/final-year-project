"""
LangChain Pipeline — Data to Explanation

This module creates a chain that:
1. Takes an action description and raw JSON data from Neo4j.
2. Uses Llama 3 (via Ollama) to format the raw results into a human-readable explanation.
"""

import os
import json
from dotenv import load_dotenv
from langchain_community.graphs import Neo4jGraph
from langchain_ollama import OllamaLLM
from langchain_core.prompts import PromptTemplate

# Load environment variables
load_dotenv()

def create_neo4j_graph() -> Neo4jGraph:
    """
    Connect to the Neo4j knowledge graph.
    Used for health checks and schema exploration.
    """
    uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    user = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "supplychain123")

    graph = Neo4jGraph(
        url=uri,
        username=user,
        password=password,
    )

    # Refresh the schema so the LLM knows the current graph structure
    graph.refresh_schema()
    return graph


def create_llm() -> OllamaLLM:
    """
    Create the Ollama LLM instance (Llama 3 running locally).
    """
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    model = os.getenv("OLLAMA_MODEL", "llama3")

    return OllamaLLM(
        base_url=base_url,
        model=model,
        temperature=0.2,  # Slight creativity for natural language generation
    )


def explain_data(action: str, data: dict) -> dict:
    """
    Ask the LLM to explain raw Neo4j JSON data.

    Args:
        action: Context of what the user clicked/did (e.g., "Viewed Product #1 History")
        data: Raw JSON dictionary from Neo4j

    Returns:
        dict with:
          - response: Human-readable explanation
          - success: boolean
    """
    llm = create_llm()
    
    template = """You are an expert supply chain assistant. 
The user just performed the following action: {action}

Here is the raw data returned from the blockchain knowledge graph:
{data}

Please write a clear, professional, and easy-to-read explanation of this data for the user.
Make sure to extract and explicitly mention:
- Product names, categories, and current statuses
- The actors involved (e.g., Manufacturer, Retailer) and their roles
- The timestamps and transaction flow (if present)

Do NOT output any JSON, and do NOT mention the Cypher query. Just write a beautiful natural language summary.

Answer:"""

    prompt = PromptTemplate(
        input_variables=["action", "data"],
        template=template,
    )
    
    chain = prompt | llm

    try:
        data_str = json.dumps(data, indent=2)
        response = chain.invoke({"action": action, "data": data_str})

        return {
            "response": response,
            "success": True,
        }

    except Exception as e:
        error_msg = str(e)
        if "Connection refused" in error_msg and "11434" in error_msg:
            return {
                "response": "⚠ Cannot connect to Ollama. Make sure it is running:\n\nollama serve",
                "success": False,
            }
        else:
            return {
                "response": f"⚠ Error generating explanation: {error_msg}",
                "success": False,
            }


def query_graph(question: str) -> dict:
    """
    Experimental Text-to-Cypher endpoint for the AI Assistant page.
    Translates natural language to Cypher, queries Neo4j, and returns an answer.
    """
    graph = create_neo4j_graph()
    llm = create_llm()
    
    chain = GraphCypherQAChain.from_llm(
        llm=llm,
        graph=graph,
        verbose=True,
        allow_dangerous_requests=True, # Required for execution
    )
    
    try:
        response = chain.invoke({"query": question})
        return {
            "answer": response["result"],
            "success": True,
        }
    except Exception as e:
        return {
            "answer": f"I couldn't process that query. Please try phrasing it differently or check the database. (Error: {str(e)})",
            "success": False,
        }
