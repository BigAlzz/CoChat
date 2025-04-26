# CoChat User Guide

## Table of Contents
- [Overview](#overview)
- [Getting Started](#getting-started)
- [Chat Modes](#chat-modes)
- [Panels, Postures, and Roles](#panels-postures-and-roles)
- [How Postures and Roles Interact](#how-postures-and-roles-interact)
- [Summary Generation](#summary-generation)
- [Tips and Best Practices](#tips-and-best-practices)

---

## Overview
CoChat is a multi-panel, multi-agent chat application designed for collaborative, comparative, and exploratory conversations with AI assistants. You can configure multiple panels, each with its own assistant, role, and posture, and run conversations in various modes (individual, sequential, parallel, cyclic). The app also features advanced summary generation and export options.

## Getting Started
1. **Launch the App:** Start the backend server and open the frontend in your browser.
2. **Add Panels:** Use the "Add Panel" button to create up to 6 panels. Each panel represents a separate AI assistant.
3. **Select Mode:** Choose a chat mode from the dropdown:
   - **Individual:** Each panel operates independently.
   - **Sequential:** The conversation flows from one panel to the next, each building on the previous response.
   - **Parallel:** All panels respond to the same prompt simultaneously.
   - **Cyclic:** The conversation cycles through all panels for multiple rounds.
4. **Configure Assistants:** For each panel, select a model, role, and posture. You can also set a custom voice for text-to-speech.
5. **Start Chatting:** Enter your message in the input box and send. The conversation will proceed according to the selected mode.
6. **Export & Summarize:** Use the summary and export features to generate concise, detailed, or WhatsApp-style summaries, and export conversations as text, PDF, or JSON.

## Chat Modes
- **Individual:** Each panel is independent. Useful for comparing different models or configurations.
- **Sequential:** The user's message is sent to the first panel; each subsequent panel receives the previous panel's response. Great for stepwise reasoning or multi-perspective analysis.
- **Parallel:** All panels receive the same user message and respond in parallel. Useful for side-by-side comparison.
- **Cyclic:** The conversation cycles through all panels for a set number of rounds, allowing for iterative, evolving discussions.

## Panels, Postures, and Roles
- **Panel:** A container for an AI assistant. Each panel can have its own model, role, and posture.
- **Role:** The "persona" or function of the assistant (e.g., Researcher, Mentor, Critic, Creative, Technical Expert).
- **Posture:** The communication style or attitude of the assistant (e.g., Concise, Empathetic, Analytical, Socratic, Creative, Professional).

### Example Roles
- **Researcher:** Focuses on evidence, sources, and thorough analysis.
- **Mentor:** Offers guidance, encouragement, and step-by-step help.
- **Critic:** Points out flaws, challenges assumptions, and provides counterarguments.
- **Creative:** Suggests novel ideas, brainstorming, and out-of-the-box thinking.
- **Technical Expert:** Delivers precise, technical, and detailed explanations.

### Example Postures
- **Concise:** Short, direct, and to the point.
- **Empathetic:** Supportive, understanding, and emotionally aware.
- **Analytical:** Breaks down problems, uses logic and structure.
- **Socratic:** Asks probing questions to stimulate critical thinking.
- **Creative:** Uses metaphors, analogies, and imaginative language.
- **Professional:** Formal, respectful, and business-like.

## How Postures and Roles Interact
The combination of role and posture defines each assistant's unique voice. Here are some examples:

- **Researcher + Analytical:** Provides in-depth, logical breakdowns with references to studies or data.
- **Mentor + Empathetic:** Offers step-by-step help with encouragement and emotional support.
- **Critic + Socratic:** Challenges ideas by asking thought-provoking questions, prompting deeper reflection.
- **Creative + Concise:** Delivers imaginative ideas in a punchy, memorable way.
- **Technical Expert + Professional:** Gives detailed, accurate answers in a formal, business-like tone.

### Example Interaction
Suppose you ask: "How can we improve team productivity?"
- **Panel 1 (Researcher + Analytical):** "Studies show that clear goals and regular feedback increase productivity by 20%. Consider implementing weekly check-ins and SMART objectives."
- **Panel 2 (Mentor + Empathetic):** "It's great that you care about your team's growth! Start by listening to their concerns and celebrating small wins together."
- **Panel 3 (Critic + Socratic):** "What do you think is currently holding your team back? Are there any processes that create bottlenecks?"
- **Panel 4 (Creative + Concise):** "Gamify tasks! Try a leaderboard or creative challenges to boost engagement."

## Summary Generation
CoChat offers advanced summary generation with three styles:
- **Concise:** A brief overview with key points and conclusions.
- **Detailed:** A blow-by-blow transcript, panel-by-panel, showing each assistant's contributions and all user/assistant turns in order. Ends with key discussion points and insights.
- **WhatsApp Style:** A fun, emoji-rich summary formatted for easy sharing.

To generate a summary:
1. Click the "Generate Summary" button.
2. Choose the summary type and model.
3. Wait for the summary to be generated (streamed in real time).
4. Export or copy the summary as needed.

## Tips and Best Practices
- Experiment with different combinations of roles and postures for richer discussions.
- Use sequential or cyclic modes for multi-step reasoning or iterative brainstorming.
- Export and review summaries to capture key insights and action items.
- Adjust the number of panels and cycles to fit your workflow.

---

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
