import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import sys
import os
import httpx

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llmConnector import get_feedback_from_exaone

@pytest.fixture
def mock_env_vars():
    with patch.dict(os.environ, {"OLLAMA_HOST": "http://localhost:11434"}):
        yield

@pytest.mark.asyncio
async def test_get_feedback_from_exaone_success(mock_env_vars):
    # Mock response data
    mock_response_data = {"response": "Great job focusing!"}
    
    # Mock httpx.AsyncClient
    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock() # Use AsyncMock for the client
        mock_client_cls.return_value.__aenter__.return_value = mock_client
        
        # Mock post response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_response_data
        mock_response.raise_for_status.return_value = None
        
        mock_client.post.return_value = mock_response
        
        result = await get_feedback_from_exaone("User focused well.")
        
        assert result == "Great job focusing!"
        mock_client.post.assert_called_once()

@pytest.mark.asyncio
async def test_get_feedback_from_exaone_empty_response(mock_env_vars):
    # Mock response data with empty response
    mock_response_data = {"response": ""}
    
    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__.return_value = mock_client
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_response_data
        
        mock_client.post.return_value = mock_response
        
        result = await get_feedback_from_exaone("User focused well.")
        
        assert result == "AI 코칭 피드백을 생성할 수 없습니다."

@pytest.mark.asyncio
async def test_get_feedback_from_exaone_error(mock_env_vars):
    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__.return_value = mock_client
        
        # Simulate an exception
        mock_client.post.side_effect = Exception("Connection error")
        
        result = await get_feedback_from_exaone("User focused well.")
        
        assert result == "AI 코칭 피드백 생성 중 에러가 발생했습니다."
