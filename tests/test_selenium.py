import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
import time

@pytest.fixture
def driver():
    # Setup Chrome driver
    driver = webdriver.Chrome()
    driver.implicitly_wait(10)
    yield driver
    # Teardown
    driver.quit()

def test_initial_page_load(driver):
    """Test that the page loads with basic elements"""
    driver.get("http://localhost:5000")
    
    # Check main elements exist
    assert driver.find_element(By.ID, "processingMode")
    assert driver.find_element(By.ID, "connectionStatus")
    assert driver.find_element(By.ID, "addAssistant")
    assert driver.find_element(By.ID, "generateSummary")

def test_model_config_collapse(driver):
    """Test model configuration collapse/expand functionality"""
    driver.get("http://localhost:5000")
    
    # Find model config header and content
    config_header = driver.find_element(By.CLASS_NAME, "model-config-header")
    config_content = driver.find_element(By.CLASS_NAME, "model-config-content")
    
    # Initially content should be hidden
    assert not config_content.is_displayed()
    
    # Click to expand
    config_header.click()
    time.sleep(1)
    assert config_content.is_displayed()
    
    # Click to collapse
    config_header.click()
    time.sleep(1)
    assert not config_content.is_displayed()

def test_add_assistant(driver):
    """Test adding a new assistant panel"""
    driver.get("http://localhost:5000")
    
    # Count initial panels
    initial_panels = len(driver.find_elements(By.CLASS_NAME, "chat-panel"))
    
    # Click add assistant
    add_button = driver.find_element(By.ID, "addAssistant")
    add_button.click()
    
    # Verify new panel added
    time.sleep(1)
    new_panels = len(driver.find_elements(By.CLASS_NAME, "chat-panel"))
    assert new_panels == initial_panels + 1

def test_send_message(driver):
    """Test sending a message"""
    driver.get("http://localhost:5000")
    
    # Wait for model select and choose first model
    model_select = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.CLASS_NAME, "model-select"))
    )
    model_select.click()
    time.sleep(1)
    
    # Select first available model
    model_options = model_select.find_elements(By.TAG_NAME, "option")
    assert len(model_options) > 1, "No model options available"
    model_options[1].click()
    
    # Enter message
    textarea = driver.find_element(By.CLASS_NAME, "prompt-input")
    textarea.send_keys("Hello, how are you?")
    
    # Wait for send button to be clickable
    send_button = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.CLASS_NAME, "send-button"))
    )
    driver.execute_script("arguments[0].scrollIntoView(true);", send_button)
    time.sleep(1)
    send_button.click()
    
    # Wait for message to appear
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.CLASS_NAME, "message"))
    )
    
    messages = driver.find_elements(By.CLASS_NAME, "message")
    assert len(messages) >= 1, "No messages found"
    assert "Hello, how are you?" in messages[0].text

def test_settings_modal(driver):
    """Test settings modal functionality"""
    driver.get("http://localhost:5000")
    
    # Open settings using ID instead of CSS selector
    settings_button = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.ID, "settingsButton"))
    )
    settings_button.click()
    
    # Verify modal opens
    modal = WebDriverWait(driver, 10).until(
        EC.visibility_of_element_located((By.ID, "settingsModal"))
    )
    assert modal.is_displayed()
    
    # Check URL field
    url_input = driver.find_element(By.ID, "lmStudioUrl")
    assert "192.168.50.89:1234" in url_input.get_attribute("value")

def test_processing_modes(driver):
    """Test switching between processing modes"""
    driver.get("http://localhost:5000")
    
    # Switch to sequential mode
    mode_select = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.ID, "processingMode"))
    )
    mode_select.click()
    
    sequential_option = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, "//option[text()='Sequential Processing']"))
    )
    sequential_option.click()
    
    # Add second panel
    add_button = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.ID, "addAssistant"))
    )
    add_button.click()
    
    # Wait for second panel and check disabled state
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, ".chat-panel:nth-child(2)"))
    )
    
    second_input = driver.find_element(By.CSS_SELECTOR, ".chat-panel:nth-child(2) .prompt-input")
    assert second_input.get_property('disabled') is True, "Second panel input should be disabled"

def test_role_and_posture_selection(driver):
    """Test role and posture selection"""
    driver.get("http://localhost:5000")
    
    # Test role selection
    role_select = driver.find_element(By.CLASS_NAME, "role-select")
    role_select.click()
    time.sleep(1)
    roles = role_select.find_elements(By.TAG_NAME, "option")
    assert len(roles) > 1
    roles[1].click()
    
    # Test posture selection
    posture_select = driver.find_element(By.CLASS_NAME, "posture-select")
    posture_select.click()
    time.sleep(1)
    postures = posture_select.find_elements(By.TAG_NAME, "option")
    assert len(postures) > 1
    postures[1].click() 