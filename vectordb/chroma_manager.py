import os
import glob
import json
import logging
import numpy as np
import chromadb
from chromadb.api.types import EmbeddingFunction, Documents, Embeddings
from typing import Dict, Any, List, Optional

# Load centralized logging configurations
from logs.logging_config import mcp_logger

# Paths configurations
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VECTORDB_DIR = os.path.join(BASE_DIR, "vectordb", "chroma")
KNOWLEDGE_DIR = os.path.join(BASE_DIR, "knowledge")

# --- EMBEDDING FUNCTIONS ---

class LocalHashEmbeddingFunction(EmbeddingFunction):
    """Fallback embedding function that generates deterministic 768-dim vectors 
    from text hashes when Gemini API is unavailable.
    """
    def __call__(self, input: Documents) -> Embeddings:
        embeddings = []
        for text in input:
            # Deterministic seed from character sum
            char_sum = sum(ord(char) * (i + 1) for i, char in enumerate(text))
            np.random.seed(char_sum % (2**32 - 1))
            
            # Generate 768 float values (normalized to unit length)
            vec = np.random.normal(0.0, 1.0, 768)
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            embeddings.append(vec.tolist())
        return embeddings

class GeminiEmbeddingFunction(EmbeddingFunction):
    """Google GenAI SDK wrapper to generate semantic embeddings using the 
    'text-embedding-004' model. Falls back to hashing if credentials fail.
    """
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.fallback = LocalHashEmbeddingFunction()
        try:
            from google.genai import Client
            self.client = Client(api_key=api_key)
        except Exception as e:
            mcp_logger.warning(f"Could not initialize GenAI Client for embeddings: {e}")
            self.client = None

    def __call__(self, input: Documents) -> Embeddings:
        if not self.client:
            return self.fallback(input)
            
        embeddings = []
        for text in input:
            try:
                response = self.client.models.embed_content(
                    model="text-embedding-004",
                    contents=text
                )
                
                # Extract values from response (structure inspection)
                if hasattr(response, "embeddings") and response.embeddings:
                    val = response.embeddings[0].values
                elif hasattr(response, "embedding") and response.embedding:
                    val = response.embedding.values
                elif hasattr(response, "values"):
                    val = response.values
                else:
                    # In case values are stored inside list
                    val = getattr(response, "values", [])
                    
                if not val and isinstance(response, dict):
                    val = response.get("values", [])
                    
                embeddings.append(val)
            except Exception as e:
                # Fall back to local hash rather than raising exception
                mcp_logger.warning(f"Gemini embedding API failed, falling back to local hashing: {e}")
                fallback_vec = self.fallback([text])[0]
                embeddings.append(fallback_vec)
        return embeddings

# --- KNOWLEDGE PARSER ---

def parse_knowledge_file(filepath: str) -> List[Dict[str, Any]]:
    """Parses a structured helpdesk guide file into distinct section dictionaries.
    
    Looks for [Section: Title] markers and matches content, titles, and categories.
    """
    filename = os.path.basename(filepath)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    lines = content.splitlines()
    title = ""
    category = "Unknown"
    sections = []
    
    current_section = None
    current_content = []
    
    for line in lines:
        line_strip = line.strip()
        if line_strip.startswith("=== Document:"):
            continue
        elif line_strip.startswith("Title:"):
            title = line_strip.replace("Title:", "").strip()
        elif line_strip.startswith("Category:"):
            category = line_strip.replace("Category:", "").strip()
        elif line_strip.startswith("[Section:"):
            # Save previous section if exists
            if current_section and current_content:
                sections.append({
                    "document": filename,
                    "doc_title": title,
                    "category": category,
                    "section": current_section,
                    "content": "\n".join(current_content).strip()
                })
            # Start new section
            current_section = line_strip.replace("[Section:", "").replace("]", "").strip()
            current_content = []
        else:
            if current_section is not None:
                current_content.append(line)
                
    # Save the trailing section
    if current_section and current_content:
        sections.append({
            "document": filename,
            "doc_title": title,
            "category": category,
            "section": current_section,
            "content": "\n".join(current_content).strip()
        })
        
    return sections

# --- CHROMA DATABASE MANAGER ---

def get_embedding_function() -> EmbeddingFunction:
    """Instantiates the embedding function based on environmental settings."""
    mode = os.environ.get("MODE", "mock").lower()
    api_key = os.environ.get("GEMINI_API_KEY")
    
    if mode == "gemini" and api_key:
        return GeminiEmbeddingFunction(api_key)
    return LocalHashEmbeddingFunction()

def initialize_vectordb() -> None:
    """Parses files in knowledge/ and populates the persistent ChromaDB collection."""
    embedding_func = get_embedding_function()
    
    # 1. Initialize persistent client
    client = chromadb.PersistentClient(path=VECTORDB_DIR)
    
    # 2. Clear old collection to enforce clean imports
    try:
        client.delete_collection("kb_articles")
    except Exception:
        pass
        
    # 3. Create active collection
    collection = client.create_collection(
        name="kb_articles",
        embedding_function=embedding_func,
        metadata={"hnsw:space": "cosine"} # Enforce cosine distance
    )
    
    # 4. Find and ingest all guide files
    search_path = os.path.join(KNOWLEDGE_DIR, "*.txt")
    guide_files = glob.glob(search_path)
    
    documents = []
    metadatas = []
    ids = []
    
    for filepath in guide_files:
        sections = parse_knowledge_file(filepath)
        for sec in sections:
            doc_id = f"{sec['document']}_{sec['section'].replace(' ', '_').lower()}"
            documents.append(sec["content"])
            metadatas.append({
                "document": sec["document"],
                "doc_title": sec["doc_title"],
                "category": sec["category"],
                "section": sec["section"]
            })
            ids.append(doc_id)
            
    if documents:
        # Add batches to collection
        collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        print(f"ChromaDB initialized. Indexed {len(documents)} knowledge guide sections.")
    else:
        print("Warning: No knowledge guides found in knowledge/ to index.")

def semantic_search(query: str, limit: int = 3) -> List[Dict[str, Any]]:
    """Performs a semantic lookup query against the ChromaDB vector database.
    
    Args:
        query: User problem description or search query.
        limit: Number of matches to return.
        
    Returns:
        List of matching guides containing content, document, and confidence.
    """
    embedding_func = get_embedding_function()
    client = chromadb.PersistentClient(path=VECTORDB_DIR)
    
    try:
        collection = client.get_collection(
            name="kb_articles",
            embedding_function=embedding_func
        )
    except Exception:
        # If collection does not exist, initialize first
        initialize_vectordb()
        collection = client.get_collection(
            name="kb_articles",
            embedding_function=embedding_func
        )
        
    results = collection.query(
        query_texts=[query],
        n_results=limit
    )
    
    citations = []
    if results and "documents" in results and results["documents"]:
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        distances = results["distances"][0] if "distances" in results else [0.5] * len(docs)
        
        for i in range(len(docs)):
            dist = distances[i]
            # Convert cosine distance (0.0 identical, 1.0 orthogonal) to confidence
            confidence = max(0.0, min(1.0, 1.0 - dist))
            
            citations.append({
                "document": metas[i].get("document", "unknown"),
                "doc_title": metas[i].get("doc_title", "unknown"),
                "category": metas[i].get("category", "unknown"),
                "section": metas[i].get("section", "unknown"),
                "content": docs[i],
                "confidence": round(confidence, 2)
            })
            
    return citations
