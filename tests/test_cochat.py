# Playwright-based browser automation tests will be used instead of Selenium.
# This file is now a placeholder.

import pytest

# No Selenium/WebDriver imports or code below

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
            driver_path = download_chromedriver()
            if not driver_path:
                pytest.fail("Failed to download ChromeDriver")
            
            service = Service(executable_path=driver_path)
            driver = webdriver.Chrome(service=service, options=chrome_options)
            driver.set_window_size(1920, 1080)  # Set consistent window size
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
            
            # Verify initial panel exists
            panels = driver.find_elements(By.CLASS_NAME, "chat-panel")
            assert len(panels) == 1, "Should start with one panel"
        except Exception as e:
            print(f"Error in test_app_loads: {str(e)}")
            raise

    def test_panel_management(self, driver):
        """Test adding and removing panels."""
        try:
            driver.get("http://localhost:5173")
            
            # Find the add panel button
            add_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Add Panel')]"))
            )
            
            # Add panels up to 6
            for i in range(5):  # Already starts with 1 panel
                add_button.click()
                time.sleep(0.5)  # Wait for animation
                panels = driver.find_elements(By.CLASS_NAME, "chat-panel")
                assert len(panels) == i + 2, f"Should have {i + 2} panels"
            
            # Verify max panels
            assert not add_button.is_enabled(), "Add button should be disabled at max panels"
            
            # Test panel height changes
            panels = driver.find_elements(By.CLASS_NAME, "chat-panel")
            for panel in panels:
                panel_height = panel.value_of_css_property("height")
                # Convert to pixels for comparison
                height_px = int(float(panel_height.replace('px', '')))
                assert height_px < 600, "Panels should be in collapsed mode with 6 panels"
            
            # Remove a panel
            remove_buttons = driver.find_elements(By.XPATH, "//button[@title='Remove panel']")
            remove_buttons[0].click()
            time.sleep(0.5)
            
            panels = driver.find_elements(By.CLASS_NAME, "chat-panel")
            assert len(panels) == 5, "Should have 5 panels after removal"
            
        except Exception as e:
            print(f"Error in test_panel_management: {str(e)}")
            raise

    def test_panel_height_behavior(self, driver):
        """Test panel height behavior with different numbers of panels."""
        try:
            driver.get("http://localhost:5173")
            
            add_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Add Panel')]"))
            )
            
            # Test with 1-3 panels (should be full height)
            for i in range(2):  # Add 2 more panels
                add_button.click()
                time.sleep(0.5)
                panels = driver.find_elements(By.CLASS_NAME, "chat-panel")
                panel_height = panels[0].value_of_css_property("height")
                height_px = int(float(panel_height.replace('px', '')))
                assert height_px > 600, f"Panels should be full height with {i + 2} panels"
            
            # Add fourth panel (should trigger height collapse)
            add_button.click()
            time.sleep(0.5)
            panels = driver.find_elements(By.CLASS_NAME, "chat-panel")
            panel_height = panels[0].value_of_css_property("height")
            height_px = int(float(panel_height.replace('px', '')))
            assert height_px < 600, "Panels should collapse with 4 panels"
            
        except Exception as e:
            print(f"Error in test_panel_height_behavior: {str(e)}")
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
            
            # Verify model selector is present in each panel when multiple panels exist
            add_button = driver.find_element(By.XPATH, "//button[contains(., 'Add Panel')]")
            add_button.click()
            time.sleep(0.5)
            
            model_selectors = driver.find_elements(By.CLASS_NAME, "model-selector")
            assert len(model_selectors) == 2, "Each panel should have a model selector"
            
        except Exception as e:
            print(f"Error in test_model_selector: {str(e)}")
            raise

    def test_chat_functionality(self, driver):
        """Test basic chat functionality."""
        try:
            driver.get("http://localhost:5173")
            
            # Wait for model selector and select a model first
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
            
            time.sleep(1)  # Wait for model selection to process
            
            # Wait for and find the message input
            message_input = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "textarea.mantine-Textarea-input"))
            )
            
            # Ensure the input is visible and interactable
            driver.execute_script("arguments[0].scrollIntoView(true);", message_input)
            WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "textarea.mantine-Textarea-input"))
            )
            
            # Type and send a test message
            test_message = "Hello, this is a test message"
            message_input.click()
            message_input.clear()
            message_input.send_keys(test_message)
            
            # Find and click the send button
            send_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.CLASS_NAME, "send-button"))
            )
            send_button.click()
            
            # Wait for the message to appear in the chat
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='chat-message']"))
            )
            
            # Verify message appears in correct panel
            messages = driver.find_elements(By.CSS_SELECTOR, "[data-testid='chat-message']")
            assert len(messages) >= 1, "Message should appear in chat"
            assert test_message in messages[0].text, "Message content should match"
            
        except Exception as e:
            print(f"Error in test_chat_functionality: {str(e)}")
            raise

    def test_send_message(self, driver):
        """Test sending a message in the chat."""
        try:
            driver.get("http://localhost:5173")
            
            # Wait for model selector to be present and select model
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
            
            time.sleep(1)  # Wait for model selection to process
            
            # Wait for and find the message input using the Mantine class
            message_input = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "textarea.mantine-Textarea-input"))
            )
            
            # Ensure the input is visible and interactable
            driver.execute_script("arguments[0].scrollIntoView(true);", message_input)
            WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "textarea.mantine-Textarea-input"))
            )
            
            # Type and send a test message
            test_message = "Hello, this is a test message"
            message_input.click()
            message_input.clear()
            message_input.send_keys(test_message)
            
            # Find and click the send button
            send_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.CLASS_NAME, "send-button"))
            )
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