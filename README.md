# CoChat

CoChat is a multi-panel chat interface for interacting with Large Language Models (LLMs) such as those served by LM Studio. It features a Flask backend and a modern JavaScript/CSS frontend, allowing you to connect to one or more LLM servers, manage multiple chat panels, and experiment with different models and roles in parallel.

## Features
- Connect to one or more LLM servers (e.g., LM Studio)
- Multi-panel chat: run several conversations in parallel
- Model selection per panel
- Customizable roles and postures
- Modern, dark-themed UI
- Settings modal for server management

## Setup

### Prerequisites
- Python 3.8+
- Node.js (for advanced frontend development, optional)
- [LM Studio](https://lmstudio.ai/) or another OpenAI-compatible LLM server

### Installation
1. Clone this repository:
   ```sh
   git clone https://github.com/BigAlzz/CoChat.git
   cd CoChat
   ```
2. Create and activate a virtual environment:
   ```sh
   python -m venv Venv
   # On Windows:
   .\Venv\Scripts\activate
   # On macOS/Linux:
   source Venv/bin/activate
   ```
3. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```
4. Start the Flask server:
   ```sh
   python app.py
   ```
5. Open your browser and go to [http://127.0.0.1:5000](http://127.0.0.1:5000)

## Usage
- Use the settings (gear icon) to add your LLM server URLs (e.g., LM Studio at `http://localhost:1234` or your network address)
- Add new chat panels to run multiple conversations
- Select models, roles, and postures per panel
- Interact with your LLMs in a flexible, multi-agent environment

## Contributing
Pull requests and issues are welcome! Please:
- Fork the repository
- Create a new branch for your feature or fix
- Submit a pull request with a clear description

## License
MIT License
