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

ere is a comprehensive description and specification of all the features in each chat window of the CoChat application, focusing on both visible user interface behaviors and underlying logic:

CoChat Chat Window: Feature Specification
1. Chat Window Layout & Components
Message List Area:
Displays the conversation history, with each message clearly separated. Messages are visually grouped by sender (user, assistant, or system), and include timestamps, sender avatars/icons, and message status indicators (e.g., sent, pending, failed).
Input Area:
Text input box for composing messages.
“Send” button (can be triggered by Enter key).
Optional buttons for attachments, voice input, or special commands.
Toolbar/Settings:
Model selector (choose between different AI models).
Role selector (set system prompt or persona).
Posture selector (e.g., “creative”, “precise”, etc.).
Export/Import options for chat history (e.g., export to PDF).
Persistent Settings:
User preferences for model, role, posture, and other options are saved and automatically restored per chat.
2. Message Types & Handling
User Message:
Sent by the user.
Shows immediately in the chat window with a “pending” status until acknowledged by the backend.
If sending fails, displays an error and allows retry.
Assistant Message:
Sent by the AI assistant.
May be streamed in real-time (token-by-token or chunked), with partial content shown as it arrives.
Includes a “thinking” animation while the assistant is generating a response.
System Message:
Used for notifications, warnings, or status updates (e.g., “Model changed”, “Connection lost”).
Styled distinctly from user/assistant messages.
Error Message:
Clearly indicates errors (e.g., network issues, backend errors).
Provides actionable feedback or retry options.
3. Thinking & Animation Features
Thinking Animation:
When the assistant is generating a response, a dynamic animation is shown (e.g., animated dots, pulsing icon, or “AI is thinking…” message).
Animation is smooth and visually distinct, indicating the assistant is actively processing.
The animation persists until the first chunk of the assistant’s reply is received.
Streaming Output:
Assistant responses appear incrementally, simulating real-time typing.
Partial content is appended to the latest assistant message, updating as new chunks arrive.
The “thinking” animation transitions smoothly into the streaming text.
Completion & Status:
Once the assistant finishes, the message is marked as complete (animation stops).
If an error occurs during streaming, the partial message is preserved with an error indicator.
4. Message Metadata & Controls
Timestamps:
Each message displays a human-readable timestamp (e.g., “08:20”, “Yesterday 14:05”).
Sender Identification:
Avatars or icons for user/assistant/system, with clear sender names.
Copy/Export Controls:
Each message (or the entire chat) can be copied to clipboard or exported (e.g., PDF, markdown).
Exported files preserve message order, sender, and timestamps.
Edit/Retry/Delete:
Failed user messages can be retried or deleted.
(Optional) Allow editing of user messages before sending.
5. Special Features
Voice Output (TTS):
Option to play assistant replies via text-to-speech.
Handles cases where TTS is unavailable gracefully (shows a warning or disables the feature).
Persistent State:
Model, role, posture, and other settings are saved per chat and restored on reload.
Chat history is persisted locally (e.g., localStorage or IndexedDB).
Error Handling:
Robust error messages for network, backend, or TTS failures.
User-friendly explanations and recovery actions.
Accessibility:
Keyboard navigation for all controls.
Screen-reader friendly labels and ARIA attributes.
High-contrast and dark mode support.
6. Additional UX Details
Auto-Scroll:
Chat window auto-scrolls to the newest message, unless the user has manually scrolled up (in which case, a “jump to latest” button appears).
Message Grouping:
Consecutive messages from the same sender are visually grouped to reduce clutter.
Loading & Empty States:
Shows a friendly message or illustration when no messages are present.
Loading indicators when fetching chat history or initializing.
Summary Table
| Feature | Description | |---------------------------------|----------------------------------------------------------------------------------------------| | Thinking Animation | Animated indicator while assistant is generating a reply | | Streaming Output | Assistant messages appear incrementally, simulating typing | | Message Types | User, Assistant, System, Error | | Message Controls | Copy, Export, Retry, Delete, Edit (pre-send) | | Persistent Settings | Model, Role, Posture, Chat History | | Voice Output | Text-to-Speech for assistant replies, with graceful fallback | | Error Handling | User-friendly errors, retry options, robust diagnostics | | Accessibility | Keyboard navigation, screen-reader support, high-contrast/dark mode | | Auto-Scroll | Automatically scrolls to latest message, with manual override | | Message Grouping | Consecutive messages from same sender grouped visually | | Timestamps & Metadata | Human-readable timestamps, sender avatars/icons |

Example User Flow
User types a message and presses “Send”.
Message appears instantly as “pending”.
Assistant “thinking” animation starts.
Assistant reply streams in, replacing the animation.
User can copy, export, or play the reply via TTS.
All settings and chat history are persisted for future sessions.
If you need a more technical breakdown (e.g., React component structure, API contracts, or animation implementation details), let me know!