from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import datetime
from typing import Dict, Any

class A2AMessage(BaseModel):
    """Structured message model representing a single Agent-to-Agent (A2A) interaction transaction."""
    
    sender: str = Field(
        ..., 
        description="The identifier of the sending agent, system, or user."
    )
    receiver: str = Field(
        ..., 
        description="The identifier of the target receiving agent, system, or user."
    )
    task: str = Field(
        ..., 
        description="The task name or purpose of the message (e.g. 'classify_ticket', 'search_knowledge')."
    )
    payload: Dict[str, Any] = Field(
        default_factory=dict, 
        description="The data payload containing variables and results."
    )
    timestamp: str = Field(
        default_factory=lambda: datetime.now().isoformat(), 
        description="ISO 8601 formatted timestamp of the transmission."
    )

    @field_validator('sender', 'receiver', 'task')
    @classmethod
    def validate_non_empty(cls, value: str) -> str:
        """Validates that text fields are non-empty and non-whitespace."""
        if not value or not value.strip():
            raise ValueError("Field cannot be empty or whitespace-only.")
        return value.strip()

    @field_validator('timestamp')
    @classmethod
    def validate_timestamp(cls, value: str) -> str:
        """Ensures the timestamp is in a valid ISO format."""
        try:
            datetime.fromisoformat(value)
        except ValueError:
            raise ValueError("Timestamp must be a valid ISO 8601 formatted string.")
        return value

    @model_validator(mode='after')
    def validate_sender_receiver(self) -> 'A2AMessage':
        """Validates that agents do not send messages to themselves."""
        if self.sender.lower() == self.receiver.lower():
            raise ValueError("Sender and receiver cannot be the same agent.")
        return self
