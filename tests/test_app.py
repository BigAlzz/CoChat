import os
import sys

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
import app as main_app  # Import the module
import json
from unittest.mock import patch

@pytest.fixture
def client():
    main_app.app.config['TESTING'] = True  # Access app instance via the module
    with main_app.app.test_client() as client:
        yield client

def mock_post_response(*args, **kwargs):
    """Mock the requests.post response for LM Studio API calls"""
    class MockResponse:
        def __init__(self, json_data, status_code):
            self.json_data = json_data
            self.status_code = status_code

        def json(self):
            return self.json_data

        def raise_for_status(self):
            if self.status_code != 200:
                raise Exception("API Error")

    # Mock response for chat completions
    if '/v1/chat/completions' in args[0]:
        return MockResponse({
            "choices": [{
                "message": {
                    "content": "This is a mock response from the AI assistant."
                }
            }]
        }, 200)

    return MockResponse(None, 404)

def test_index_route(client):
    """Test the index route returns correctly"""
    response = client.get('/')
    assert response.status_code == 200

@patch('requests.post', side_effect=mock_post_response)
def test_individual_chat(mock_post, client):
    """Test individual chat mode"""
    data = {
        'prompt': 'Hello, how are you?',
        'model': 'test-model',
        'posture': 'friendly',
        'role': 'assistant',
        'mode': 'individual'
    }
    
    response = client.post('/chat', data=data)
    assert response.status_code == 200
    
    response_data = json.loads(response.data)
    assert 'response' in response_data
    assert response_data['mode'] == 'individual'
    assert response_data['model'] == 'test-model'
    assert response_data['posture'] == 'friendly'
    assert response_data['role'] == 'assistant'

@patch('requests.post', side_effect=mock_post_response)
def test_sequential_chat(mock_post, client):
    """Test sequential chat mode"""
    # First message in sequence
    data1 = {
        'prompt': 'What is 2+2?',
        'model': 'test-model',
        'posture': 'professional',
        'role': 'math tutor',
        'mode': 'sequential'
    }
    
    response1 = client.post('/chat', data=data1)
    assert response1.status_code == 200
    response_data1 = json.loads(response1.data)
    
    # Second message using previous response
    data2 = {
        'prompt': 'Explain why that answer is correct',
        'model': 'test-model',
        'posture': 'educational',
        'role': 'teacher',
        'mode': 'sequential',
        'previous_response': response_data1['response']
    }
    
    response2 = client.post('/chat', data=data2)
    assert response2.status_code == 200
    response_data2 = json.loads(response2.data)
    assert response_data2['mode'] == 'sequential'

@patch('requests.post', side_effect=mock_post_response)
def test_parallel_chat(mock_post, client):
    """Test parallel chat mode"""
    # Send multiple parallel requests
    data = {
        'prompt': 'Analyze this text',
        'model': 'test-model',
        'posture': 'analytical',
        'role': 'analyst',
        'mode': 'parallel'
    }
    
    # Simulate multiple parallel assistants
    responses = []
    for role in ['critic', 'supporter', 'analyst']:
        data['role'] = role
        response = client.post('/chat', data=data)
        assert response.status_code == 200
        responses.append(json.loads(response.data))
    
    # Verify each response has unique role but same mode
    roles = [r['role'] for r in responses]
    assert len(set(roles)) == 3  # All roles should be different
    assert all(r['mode'] == 'parallel' for r in responses)

@patch('requests.post', side_effect=mock_post_response)
def test_chat_error_handling(mock_post, client):
    """Test chat endpoint error handling"""
    # Test with missing required fields
    data = {'prompt': 'Hello'}  # Missing other required fields
    response = client.post('/chat', data=data)
    assert response.status_code == 200  # The endpoint still returns 200 but with error message

def test_summarize_endpoint(client):
    """Test the summarize endpoint"""
    data = {
        'conversation': [
            {'role': 'user', 'content': 'Hello'},
            {'role': 'assistant', 'content': 'Hi there'},
        ],
        'model': 'test-model'
    }
    
    with patch('requests.post', side_effect=mock_post_response):
        response = client.post('/summarize', 
                             data=json.dumps(data),
                             content_type='application/json')
        assert response.status_code == 200
        response_data = json.loads(response.data)
        assert 'summary' in response_data 

def test_setup():
    """Basic test to verify test setup"""
    assert True 