# CoChat - Advanced LLM Conversation Platform

CoChat is a sophisticated platform designed to facilitate conversations between Large Language Models (LLMs) with a modern, dark interface and customizable chat panels.

## Features

- Modern dark-themed interface
- Customizable and movable chat panels
- File upload support
- Dynamic LLM model selection
- Sequential and parallel conversation modes
- Autonomous operation mode
- Customizable assistant roles and postures
- Real-time model list updates from LM Studio
- Conversation summarization

## Technical Stack

- Backend: FastAPI (Python)
- Frontend: React + TypeScript
- LLM Integration: LM Studio
- Database: SQLite
- Styling: TailwindCSS

## Setup Instructions

1. Create and activate virtual environment:
```bash
python -m venv venv
.\venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Install frontend dependencies:
```bash
cd frontend
npm install
```

4. Start the backend server:
```bash
uvicorn app.main:app --reload
```

5. Start the frontend development server:
```bash
cd frontend
npm run dev
```

## Configuration

The application connects to LM Studio at http://192.168.50.89:1234. You can modify the connection settings in the `.env` file.

## Development

- Backend code is in the `app` directory
- Frontend code is in the `frontend` directory
- Tests are in the `tests` directory

## License

MIT License 