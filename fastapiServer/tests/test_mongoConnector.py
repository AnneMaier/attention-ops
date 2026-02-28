import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime
import sys
import os

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mongoConnector import MongoConnector

@pytest.fixture
def mock_mongo_client():
    with patch('mongoConnector.MongoClient') as mock_client:
        yield mock_client

@pytest.fixture
def mock_env_vars():
    with patch.dict(os.environ, {
        "MONGO_HOST": "localhost",
        "MONGO_PORT": "27017",
        "MONGO_USER": "user",
        "MONGO_PASSWORD": "password",
        "MONGO_DB_NAME": "test_db"
    }):
        yield

def test_mongo_connector_initialization(mock_env_vars, mock_mongo_client):
    connector = MongoConnector()
    assert connector.client is not None
    assert connector.db is not None
    mock_mongo_client.assert_called_once()

def test_get_session_data(mock_env_vars, mock_mongo_client):
    connector = MongoConnector()
    mock_db = connector.db
    
    # Mock find return value
    mock_cursor = MagicMock()
    mock_cursor.__iter__.return_value = [{"sessionId": "test_session", "event": "data"}]
    mock_db.session_events.find.return_value = mock_cursor
    
    result = connector.get_session_data("test_session")
    
    assert len(result) == 1
    assert result[0]["sessionId"] == "test_session"
    mock_db.session_events.find.assert_called_with({"sessionId": "test_session"}, {'_id': 0})

def test_create_report_metadata(mock_env_vars, mock_mongo_client):
    connector = MongoConnector()
    mock_db = connector.db
    
    report_data = {
        "reportTitle": "Test Report",
        "userId": "user123",
        "startDate": "2023-01-01",
        "endDate": "2023-01-31"
    }
    
    report_id = connector.createReportMetadata(report_data)
    
    assert report_id.startswith("report-")
    mock_db.reports.insert_one.assert_called_once()
    
    # Verify inserted document structure
    args, _ = mock_db.reports.insert_one.call_args
    inserted_doc = args[0]
    assert inserted_doc["_id"] == report_id
    assert inserted_doc["reportTitle"] == "Test Report"
    assert inserted_doc["status"] == "PENDING"

def test_get_sessions_by_user_id(mock_env_vars, mock_mongo_client):
    connector = MongoConnector()
    mock_db = connector.db
    
    # Mock aggregate return value
    mock_db.session_events.aggregate.return_value = [{
        "metadata": [{"total": 1}],
        "data": [{"sessionId": "session1", "userId": "user123"}]
    }]
    
    result = connector.getSessionsByUserId("user123")
    
    assert result["total"] == 1
    assert len(result["sessions"]) == 1
    assert result["sessions"][0]["sessionId"] == "session1"
