# 1. Import FastMCP first (while sys.path is clean) to load the official mcp package
from fastmcp import FastMCP

# 2. Add project root to sys.path to enable local imports
import sys
import os
root_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_path not in sys.path:
    sys.path.insert(0, root_path)

# 3. Load local modules
import vectordb.chroma_manager as cm

# Initialize FastMCP Server for Knowledge Base
mcp = FastMCP("Knowledge Base MCP")

@mcp.tool()
def search_documents(query: str, limit: int = 3) -> list:
    """Perform a semantic search query against the organizational knowledge base.
    
    Args:
        query: The problem description or keywords to search.
        limit: The maximum number of relevant citations to return (default 3).
    """
    try:
        results = cm.semantic_search(query, limit=limit)
        return results
    except Exception as e:
        return [{"error": f"Failed to perform semantic document search: {str(e)}"}]

@mcp.tool()
def semantic_search(query: str) -> list:
    """Perform a default semantic search query returning the top matches.
    
    Args:
        query: The search query string.
    """
    try:
        results = cm.semantic_search(query, limit=3)
        return results
    except Exception as e:
        return [{"error": f"Failed to perform semantic search: {str(e)}"}]

@mcp.tool()
def retrieve_articles(category: str) -> list:
    """Retrieve all guide articles matching a specific issue category.
    
    Args:
        category: The ticket category to filter by (e.g. 'VPN Issue', 'Password Reset').
    """
    articles = []
    
    try:
        # Connect to ChromaDB
        embedding_func = cm.get_embedding_function()
        client = cm.chromadb.PersistentClient(path=cm.VECTORDB_DIR)
        collection = client.get_collection(
            name="kb_articles",
            embedding_function=embedding_func
        )
        
        # Query with metadata filter
        results = collection.get(where={"category": category})
        
        if results and "documents" in results and results["documents"]:
            docs = results["documents"]
            metas = results["metadatas"]
            for i in range(len(docs)):
                articles.append({
                    "document": metas[i].get("document", "unknown"),
                    "doc_title": metas[i].get("doc_title", "unknown"),
                    "category": metas[i].get("category", "unknown"),
                    "section": metas[i].get("section", "unknown"),
                    "content": docs[i]
                })
        
    except Exception:
        # Fallback: Parse the raw guide text files directly from directory if DB collection fails
        try:
            import glob
            search_path = os.path.join(cm.KNOWLEDGE_DIR, "*.txt")
            guide_files = glob.glob(search_path)
            for filepath in guide_files:
                sections = cm.parse_knowledge_file(filepath)
                for sec in sections:
                    if sec["category"].lower() == category.lower():
                        articles.append(sec)
        except Exception as e:
            return [{"error": f"Failed to retrieve fallback articles: {str(e)}"}]
            
    return articles

if __name__ == "__main__":
    # Boot the MCP stdio server
    mcp.run()
