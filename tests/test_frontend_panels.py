import pytest
from playwright.sync_api import sync_playwright, expect

BASE_URL = "http://127.0.0.1:5000/"
USERNAME = "al"
PASSWORD = "ikldx123"

@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()

@pytest.fixture
def page(browser):
    context = browser.new_context()
    page = context.new_page()
    yield page
    context.close()

def login_or_register(page):
    page.goto(BASE_URL)
    page.wait_for_selector("#authModal")
    page.fill("#authUsername", USERNAME)
    page.fill("#authPassword", PASSWORD)
    page.click("#authSubmitBtn")
    # Wait for either modal to disappear or error to show
    try:
        page.wait_for_selector("#authModal", state="hidden", timeout=15000)
        # Wait for main UI to appear
        page.wait_for_selector(".chat-panel", timeout=10000)
        return  # Success!
    except Exception as e:
        # Modal still open, check for error and switch to login if needed
        if page.locator("#authError").is_visible() and page.locator("#showLogin").is_visible():
            page.click("#showLogin")
            page.fill("#authUsername", USERNAME)
            page.fill("#authPassword", PASSWORD)
            page.click("#authSubmitBtn")
            try:
                page.wait_for_selector("#authModal", state="hidden", timeout=15000)
                page.wait_for_selector(".chat-panel", timeout=10000)
                return
            except Exception as e2:
                print("Login failed after retry. Page content:\n", page.content())
                raise e2
        else:
            print("Login failed. Page content:\n", page.content())
            raise e


def test_sequential_and_cyclic_panels(page):
    login_or_register(page)
    # Add a second panel
    page.click("#addAssistant")
    # Select model for both panels
    for i in range(2):
        panel = page.locator(".chat-panel").nth(i)
        panel.locator(".model-select").select_option(value="qwen2.5-7b-instruct-1m")
    
    # Switch to Sequential mode
    page.click("#currentMode")
    page.click(".dropdown-item[data-mode='sequential']")
    # Send a message in the first panel
    first_panel = page.locator(".chat-panel").nth(0)
    first_panel.locator(".prompt-input").fill("Explain the concept of entropy in physics.")
    first_panel.locator(".send-button").click()
    # Wait for both panels to have an assistant message
    page.wait_for_timeout(5000)
    answers = []
    for i in range(2):
        panel = page.locator(".chat-panel").nth(i)
        panel.locator(".assistant-message .message-content").wait_for(timeout=60000)
        answer = panel.locator(".assistant-message .message-content").last.text_content()
        answers.append(answer)
    assert answers[0] and answers[1], "Both panels should have answers"
    assert answers[0] != answers[1], "Sequential panels should produce different answers"
    assert not (answers[0] in answers[1] or answers[1] in answers[0]), "No unnecessary repetition in sequential mode"

    # Switch to Cyclic mode
    page.click("#currentMode")
    page.click(".dropdown-item[data-mode='cyclic']")
    # Send a message in the first panel
    first_panel.locator(".prompt-input").fill("Brainstorm ideas for a science fiction story.")
    first_panel.locator(".send-button").click()
    page.wait_for_timeout(5000)
    answers = []
    for i in range(2):
        panel = page.locator(".chat-panel").nth(i)
        panel.locator(".assistant-message .message-content").wait_for(timeout=60000)
        answer = panel.locator(".assistant-message .message-content").last.text_content()
        answers.append(answer)
    assert answers[0] and answers[1], "Both panels should have answers in cyclic mode"
    assert answers[0] != answers[1], "Cyclic panels should produce different answers"
    assert not (answers[0] in answers[1] or answers[1] in answers[0]), "No unnecessary repetition in cyclic mode" 