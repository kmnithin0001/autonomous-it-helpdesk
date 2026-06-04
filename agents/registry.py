from typing import Dict, Any, List

# In-memory global storage mapping agent names to their instances
_REGISTRY: Dict[str, Any] = {}

def register_agent(name: str, agent: Any) -> None:
    """Registers an agent instance with the global registry.
    
    Args:
        name: Name of the agent (e.g. 'CoordinatorAgent', 'ClassificationAgent').
        agent: The instanced agent wrapper or ADK class to register.
    """
    key = name.lower().strip()
    _REGISTRY[key] = agent

def get_agent(name: str) -> Any:
    """Retrieves a registered agent instance by name.
    
    Args:
        name: Name of the agent to lookup.
        
    Returns:
        The registered agent instance.
        
    Raises:
        ValueError: If the agent is not registered.
    """
    key = name.lower().strip()
    if key not in _REGISTRY:
        raise ValueError(f"Agent '{name}' is not registered in the global registry.")
    return _REGISTRY[key]

def list_agents() -> List[str]:
    """Returns a list of all registered agent names in the registry.
    
    Returns:
        A list of registered agent names.
    """
    return list(_REGISTRY.keys())
