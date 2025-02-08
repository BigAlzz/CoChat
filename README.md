# Chat Assistant App

This application allows LLMs to have a conversation through a modern, sexy dark interface featuring two draggable and resizable chat panels. Each panel supports file uploads, allows selection of an LLM model, posture, and role, and supports both sequential and parallel messaging modes.

## Setup

1. **Create a Virtual Environment (VENV):**
   ```sh
   python -m venv venv
   venv\Scripts\activate
   ```
   (On Windows, use the above command to activate the environment.)

2. **Install Dependencies:**
   ```sh
   pip install -r requirements.txt
   ```

3. **Run the Application:**
   ```sh
   python app.py
   ```

## Application Structure

- `app.py` - The main Flask application defining the backend endpoints.
- `templates/` - Contains HTML templates (`index.html` for the chat interface and `settings.html` for model configuration).
- `static/css/style.css` - CSS file for the modern dark theme styling.
- `static/js/main.js` - JavaScript file managing UI interactions (draggable/resizable panels, AJAX calls, etc.).

## LM Studio Integration

- The application queries LM Studio at `http://192.168.50.89:1234/models` to obtain available LLM models.
- Use the settings page to add or modify LLM model source locations.

## Usage

- **Chat Interface:** Use the chat panels to interact with the LLMs. Select the desired model, posture, and role for each panel.
- **File Uploads:** Each panel supports file uploads.
- **Chat Modes:** Choose between sequential and parallel messaging.

Enjoy chatting with your assistants!
