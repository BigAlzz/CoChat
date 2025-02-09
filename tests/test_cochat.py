import pytest
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import os
import time
from setup_webdriver import setup_chromedriver, download_chromedriver

class TestCoChat:
    @pytest.fixture(scope="function")
    def driver(self):
        """Set up WebDriver instance."""
        chrome_options = Options()
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_experimental_option('excludeSwitches', ['enable-logging'])
        
        try:
            # Get ChromeDriver path
            driver_path = download_chromedriver()
            if not driver_path:
                pytest.fail("Failed to download ChromeDriver")
            
            service = Service(executable_path=driver_path)
            driver = webdriver.Chrome(service=service, options=chrome_options)
            driver.implicitly_wait(10)
            yield driver
        except Exception as e:
            print(f"Failed to initialize ChromeDriver: {str(e)}")
            raise
        finally:
            if 'driver' in locals():
                driver.quit()

    def test_app_loads(self, driver):
        """Test that the application loads successfully."""
        try:
            driver.get("http://localhost:5173")
            assert "CoChat" in driver.title
            
            # Wait for the main chat interface to load
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "chat-panel"))
            )
        except Exception as e:
            print(f"Error in test_app_loads: {str(e)}")
            raise

    def test_model_selector(self, driver):
        """Test the model selector functionality."""
        try:
            driver.get("http://localhost:5173")
            
            # Wait for model selector to be present
            model_selector = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "model-selector"))
            )
            assert model_selector.is_displayed()
        except Exception as e:
            print(f"Error in test_model_selector: {str(e)}")
            raise

    def test_send_message(self, driver):
        """Test sending a message in the chat."""
        try:
            driver.get("http://localhost:5173")
            
            # Wait for model selector to be present
            model_selector = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "model-selector"))
            )
            
            # Set the model value directly using JavaScript
            driver.execute_script("""
                const select = document.querySelector('.model-selector input');
                const event = new Event('change', { bubbles: true });
                select.value = 'gpt-3.5-turbo';
                select.dispatchEvent(event);
            """)
            
            # Wait for and find the message input
            message_input = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "[data-testid='message-input']"))
            )
            
            # Type and send a test message
            test_message = "Hello, this is a test message"
            message_input.click()  # Ensure the input is focused
            message_input.send_keys(test_message)
            
            # Find and click the send button
            send_button = driver.find_element(By.CLASS_NAME, "send-button")
            send_button.click()
            
            # Wait for the message to appear in the chat
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='chat-message']"))
            )
        except Exception as e:
            print(f"Error in test_send_message: {str(e)}")
            raise

    def test_parallel_chat(self, driver):
        """Test having multiple chat conversations."""
        try:
            driver.get("http://localhost:5173")
            
            # Wait for and click the new chat button
            new_chat_button = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "new-chat-button"))
            )
            new_chat_button.click()
            
            # Verify that a new chat is created by checking for a message input
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='message-input']"))
            )
        except Exception as e:
            print(f"Error in test_parallel_chat: {str(e)}")
            raise 