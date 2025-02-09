import pytest
import os
from dotenv import load_dotenv

def pytest_configure(config):
    """Configure test environment."""
    load_dotenv()
    
    # Set default environment variables for testing if not already set
    os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")
    os.environ.setdefault("BACKEND_URL", "http://localhost:8000")
    os.environ.setdefault("LMSTUDIO_BASE_URL", "http://192.168.50.89:1234")

@pytest.fixture(scope="session")
def frontend_url():
    """Get frontend URL from environment."""
    return os.getenv("FRONTEND_URL")

@pytest.fixture(scope="session")
def backend_url():
    """Get backend URL from environment."""
    return os.getenv("BACKEND_URL")

@pytest.fixture(scope="session")
def lmstudio_url():
    """Get LM Studio URL from environment."""
    return os.getenv("LMSTUDIO_BASE_URL") 