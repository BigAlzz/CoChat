# CoChat - Collaborative AI Chat Interface

CoChat is a web-based collaborative chat interface that allows multiple AI assistants to work together in different modes: individual, sequential, and parallel. It supports various AI models and provides features like file uploads, image analysis, and conversation summarization.

## Features

- Multiple AI assistant panels
- Support for different chat modes (Individual, Sequential, Parallel)
- File and image upload capabilities
- Real-time streaming responses
- Conversation summarization
- Customizable assistant roles and postures
- Model selection and management
- Copy-to-clipboard functionality
- Responsive design

## Prerequisites

- Python 3.8 or higher
- Flask
- LM Studio server running locally or on a network

## Installation

1. Clone the repository:
```bash
git clone https://github.com/BigAlzz/CoChat.git
cd cochat
```

2. Create and activate a virtual environment:
```bash
python -m venv Venv
.\Venv\Scripts\activate  # On Windows
source Venv/bin/activate  # On Unix/MacOS
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create an uploads directory:
```bash
mkdir uploads
```

## Configuration

1. Start your LM Studio server
2. Update the server URL in the application settings if needed (default: http://192.168.50.10:3500)

## Usage

1. Start the Flask server:
```bash
.\start_server.bat  # On Windows
./start_server.sh   # On Unix/MacOS
```

2. Open your browser and navigate to `http://127.0.0.1:5000`

3. Select your desired AI model and start chatting!

## Chat Modes

- **Individual**: Each assistant works independently
- **Sequential**: Assistants process messages in sequence, building on previous responses
- **Parallel**: All assistants process messages simultaneously

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
