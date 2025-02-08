from flask import Flask, render_template, request, jsonify, redirect, url_for, send_from_directory
import requests
import os
from werkzeug.utils import secure_filename
from datetime import datetime

app = Flask(__name__)

# Default LM Studio server URL
LM_STUDIO_SERVER = 'http://192.168.50.89:1234'  # Correct LM Studio address

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/settings', methods=['GET', 'POST'])
def settings():
    global LM_STUDIO_SERVER
    if request.method == 'POST':
        try:
            # Handle both form data and JSON data
            if request.is_json:
                data = request.get_json()
                lm_url = data.get('lm_url', LM_STUDIO_SERVER)
            else:
                lm_url = request.form.get('lm_url', LM_STUDIO_SERVER)
            
            # Validate URL format
            if not lm_url.startswith(('http://', 'https://')):
                return jsonify({'error': 'Invalid URL format. Must start with http:// or https://'}), 400
            
            # Test connection before saving
            test_response = requests.get(f'{lm_url}/v1/models', timeout=5)
            test_response.raise_for_status()
            
            # If we get here, the connection was successful
            LM_STUDIO_SERVER = lm_url
            return jsonify({'success': True, 'lm_url': lm_url})
            
        except requests.exceptions.RequestException as e:
            return jsonify({'error': f'Could not connect to LM Studio: {str(e)}'}), 400
        except Exception as e:
            return jsonify({'error': f'Unexpected error: {str(e)}'}), 500
    else:
        return render_template('settings.html', lm_url=LM_STUDIO_SERVER)

@app.route('/models')
def models():
    # Query LM Studio to retrieve available models
    try:
        response = requests.get(f'{LM_STUDIO_SERVER}/v1/models')
        response.raise_for_status()  # Raise an exception for bad status codes
        models_data = response.json()
        
        # Extract model IDs from the response
        if 'data' in models_data:
            models_list = [model['id'] for model in models_data['data']]
            return jsonify({'models': models_list})
        else:
            return jsonify({'error': f'Unexpected response format from LM Studio. Response: {models_data}'})
    except requests.exceptions.ConnectionError:
        return jsonify({'error': f'Could not connect to LM Studio at {LM_STUDIO_SERVER}. Please check if the server is running.'})
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Error connecting to LM Studio: {str(e)}'})
    except Exception as e:
        return jsonify({'error': f'Unexpected error: {str(e)}'})

@app.route('/chat', methods=['POST'])
def chat():
    prompt = request.form.get('prompt')
    model = request.form.get('model')
    posture = request.form.get('posture', '')
    role = request.form.get('role', '')
    mode = request.form.get('mode', 'parallel')

    # Build system message
    system_message = f"You are an AI assistant with a {posture} posture, acting as a {role}. Please provide your reasoning process first, then your final answer."

    # Prepare messages for DeepSeek
    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": prompt}
    ]

    try:
        # Increase timeout for DeepSeek models
        response = requests.post(
            f'{LM_STUDIO_SERVER}/v1/chat/completions',
            json={
                "model": model,
                "messages": messages,
                "temperature": 0.7,
                "stream": False,
                "max_tokens": 2000  # Increase token limit
            },
            timeout=60  # Increase timeout to 60 seconds
        )
        
        response.raise_for_status()
        chat_data = response.json()
        
        if 'choices' in chat_data and len(chat_data['choices']) > 0:
            full_response = chat_data['choices'][0]['message']['content']
            
            # Split response into reasoning and answer
            try:
                # Look for common separator patterns
                separators = ['Therefore,', 'Final answer:', 'In conclusion,', 'To answer your question,']
                reasoning = full_response
                answer = ''
                
                for separator in separators:
                    if separator.lower() in full_response.lower():
                        parts = full_response.split(separator, 1)
                        if len(parts) == 2:
                            reasoning = parts[0].strip()
                            answer = (separator + parts[1]).strip()
                            break
                
                # If no separator found, use the whole response as the answer
                if not answer:
                    answer = full_response
                    reasoning = "Direct response:"

                return jsonify({
                    'response': {
                        'reasoning': reasoning,
                        'answer': answer
                    }
                })
            except Exception as e:
                print(f"Error splitting response: {e}")
                return jsonify({
                    'response': {
                        'reasoning': 'Error processing reasoning.',
                        'answer': full_response
                    }
                })
    except requests.exceptions.Timeout:
        return jsonify({
            'error': 'Request timed out. The model is taking too long to respond.'
        })
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': f'Error: {str(e)}'
        })

@app.route('/summarize', methods=['POST'])
def summarize():
    """Generate a summary of the conversation"""
    conversation = request.json.get('conversation', [])
    model = request.json.get('model', '')
    
    if not conversation:
        return jsonify({'error': 'No conversation provided'})
    
    # Format the conversation for the summarizer
    conversation_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in conversation])
    
    # Prepare the summarization prompt
    messages = [
        {"role": "system", "content": "You are a conversation summarizer. Create a concise summary of the following conversation."},
        {"role": "user", "content": f"Please summarize this conversation:\n\n{conversation_text}"}
    ]
    
    try:
        response = requests.post(
            f'{LM_STUDIO_SERVER}/v1/chat/completions',
            json={
                "model": model,
                "messages": messages,
                "temperature": 0.3  # Lower temperature for more focused summary
            }
        )
        response.raise_for_status()
        summary_data = response.json()
        
        if 'choices' in summary_data and len(summary_data['choices']) > 0:
            summary = summary_data['choices'][0]['message']['content']
        else:
            summary = "Error: Could not generate summary"
            
    except requests.exceptions.RequestException as e:
        summary = f'Error generating summary: {str(e)}'
    
    return jsonify({'summary': summary})

@app.route('/export', methods=['POST'])
def export_conversation():
    """Export the conversation history"""
    conversation = request.json.get('conversation', [])
    
    if not conversation:
        return jsonify({'error': 'No conversation provided'})
    
    # Format the conversation for export
    export_data = {
        'timestamp': datetime.now().isoformat(),
        'conversation': conversation,
        'metadata': {
            'mode': request.json.get('mode', 'unknown'),
            'models_used': request.json.get('models_used', []),
            'num_assistants': request.json.get('num_assistants', 0)
        }
    }
    
    return jsonify(export_data)

@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    upload_folder = os.path.join(os.getcwd(), 'uploads')
    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder)
    file_path = os.path.join(upload_folder, file.filename)
    file.save(file_path)
    return jsonify({'message': 'File uploaded successfully', 'filename': file.filename})

if __name__ == '__main__':
    app.run(debug=True)
