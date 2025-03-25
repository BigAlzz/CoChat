from flask import Flask, render_template, request, jsonify, redirect, url_for, send_from_directory, session, Response
import requests
import os
from werkzeug.utils import secure_filename
from datetime import datetime
import re
from PIL import Image
import io
import base64
import json

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'  # Add this near the top

# Default LM Studio server URL
LM_STUDIO_SERVER = 'http://192.168.50.10:3500'  # Updated to the correct IP address

# Add configuration for uploads
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Request timeout settings
REQUEST_TIMEOUT = 60  # Increased from 30 to 60 seconds
LONG_REQUEST_TIMEOUT = 300  # Increased from 120 to 300 seconds for model operations

# Ensure upload folder exists
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/settings', methods=['GET', 'POST'])
def settings():
    global LM_STUDIO_SERVER  # Move global declaration to top of function
    
    if request.method == 'POST':
        try:
            if request.is_json:
                data = request.json
                server_url = data.get('server_url', LM_STUDIO_SERVER)
                
                if server_url:
                    # Clean up the URL before saving
                    # Ensure it doesn't end with /v1 (we'll add that when needed)
                    if server_url.endswith('/v1'):
                        server_url = server_url[:-3]
                    # Ensure it doesn't end with a slash
                    if server_url.endswith('/'):
                        server_url = server_url[:-1]
                    
                    # Save to session
                    session['lm_studio_url'] = server_url
                    print(f"Saved LM Studio URL to session: {server_url}")
                    
                    # Also update the global variable for current requests
                    LM_STUDIO_SERVER = server_url
                    
                    # Clear cached models to force refresh
                    if 'cached_models' in session:
                        session.pop('cached_models')
                    
                    return jsonify({"success": True, "message": "Settings saved"})
                else:
                    return jsonify({"success": False, "message": "No server URL provided"}), 400
            else:
                return jsonify({"success": False, "message": "Expected JSON data"}), 400
        except Exception as e:
            print(f"Error saving settings: {str(e)}")
            return jsonify({"success": False, "message": f"Error: {str(e)}"}), 500
    
    # Get saved URL from session or use default
    lm_url = session.get('lm_studio_url', LM_STUDIO_SERVER)
    return render_template('settings.html', lm_url=lm_url)

@app.route('/models', methods=['GET', 'POST'])
def models():
    # Query LM Studio to retrieve available models
    try:
        # Get server URL from request or use default
        if request.method == 'POST' and request.is_json:
            data = request.json
            server_url = data.get('server_url', LM_STUDIO_SERVER)
        else:
            server_url = LM_STUDIO_SERVER
            
        print(f"Fetching models from: {server_url}")
        
        # Clean up the server URL to ensure proper format
        # Remove trailing /v1 if present as we'll add it
        if server_url.endswith('/v1'):
            server_url = server_url[:-3]
        # Remove trailing slash if present
        if server_url.endswith('/'):
            server_url = server_url[:-1]
            
        # Increase timeout to 120 seconds
        response = requests.get(f'{server_url}/v1/models', timeout=120)
        response.raise_for_status()
        models_data = response.json()
        
        if 'data' in models_data:
            # Store full model objects including parameters
            models_list = models_data['data']
            # Store models in session
            session['cached_models'] = models_list
            return jsonify({'models': models_list})
        else:
            # Try to return cached models from session
            cached_models = session.get('cached_models', [])
            if cached_models:
                return jsonify({'models': cached_models})
            return jsonify({'error': f'Unexpected response format from LM Studio'})
    except requests.exceptions.ConnectionError as e:
        # Return cached models on connection error
        print(f"Connection error fetching models: {str(e)}")
        cached_models = session.get('cached_models', [])
        if cached_models:
            return jsonify({'models': cached_models})
        return jsonify({'error': 'Could not connect to LM Studio'})
    except requests.exceptions.RequestException as e:
        print(f"Request exception fetching models: {str(e)}")
        cached_models = session.get('cached_models', [])
        if cached_models:
            return jsonify({'models': cached_models})
        return jsonify({'error': f'Error: {str(e)}'})
    except Exception as e:
        print(f"Unexpected error fetching models: {str(e)}")
        return jsonify({'error': f'Unexpected error: {str(e)}'})

def process_image_reference(match):
    """Process an image reference and return base64 encoded image"""
    try:
        filename = match.group(1)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        if not os.path.exists(filepath):
            print(f"Image file not found: {filepath}")
            return None
            
        # Open and process image
        with Image.open(filepath) as img:
            # Convert to RGB if necessary
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Calculate new dimensions while maintaining aspect ratio
            max_size = 512  # Reduced from 768 to 512
            ratio = min(max_size / img.width, max_size / img.height)
            new_size = (int(img.width * ratio), int(img.height * ratio))
            
            # Resize image if larger than max size
            if img.size[0] > max_size or img.size[1] > max_size:
                img = img.resize(new_size, Image.Resampling.LANCZOS)
            
            # Save to bytes with reduced quality
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='JPEG', quality=85, optimize=True)
            img_byte_arr = img_byte_arr.getvalue()
            
            # Convert to base64
            base64_image = base64.b64encode(img_byte_arr).decode('utf-8')
            
            # Return the image wrapped in HTML tag
            return f'<image>{base64_image}</image>'
            
    except Exception as e:
        print(f"Error processing image: {str(e)}")
        return None

@app.route('/chat', methods=['POST'])
def chat():
    try:
        prompt = request.form.get('prompt')
        model = request.form.get('model')
        posture = request.form.get('posture', '')
        role = request.form.get('role', '')
        stream_enabled = request.form.get('stream', 'false').lower() == 'true'

        # Debug logging
        print(f"Received chat request - Model: {model}, Stream: {stream_enabled}")
        print(f"Prompt: {prompt}")

        if not model:
            return jsonify({"error": "No model selected. Please select a model first."}), 400

        # Get server URL from session or use default
        server_url = session.get('lm_studio_url', LM_STUDIO_SERVER)
        
        # Verify server connection before proceeding
        try:
            health_check = requests.get(f"{server_url}/v1/models", timeout=REQUEST_TIMEOUT)
            health_check.raise_for_status()
        except requests.exceptions.RequestException as e:
            print(f"Server connection error: {str(e)}")
            return jsonify({"error": "Cannot connect to LM Studio server. Please check your connection and server settings."}), 503

        # Check if prompt contains image references
        image_pattern = r'\[Image:\s+([^\]]+)\]\(([^)]+)\)'
        processed_prompt = prompt
        image_references = []
        
        # Process all image references
        for match in re.finditer(image_pattern, prompt):
            image_data = process_image_reference(match)
            if image_data:
                image_references.append(image_data)
                # Replace the image reference with a placeholder
                processed_prompt = processed_prompt.replace(match.group(0), f'[Image {len(image_references)}]')
        
        # Debug logging for processed prompt
        print(f"Processed prompt length: {len(processed_prompt)}")
        print(f"Processed prompt preview: {processed_prompt[:50]}...")
        
        # Prepare messages array
        messages = [
            {
                "role": "system",
                "content": f"You are a {role} with a {posture} communication style. Respond appropriately to the user's message."
            }
        ]
        
        # Add user message with images if present
        user_message = {
            "role": "user",
            "content": processed_prompt
        }
        
        # Add images if present
        if image_references:
            user_message["content"] = processed_prompt + "\n\nImages:\n" + "\n".join(image_references)
        
        messages.append(user_message)
        
        # Prepare the API request
        data = {
            "model": model,
            "messages": messages,
            "max_tokens": 2000,
            "temperature": 0.7,
            "top_p": 0.95,
            "frequency_penalty": 0,
            "presence_penalty": 0,
            "stop": None,
            "timeout": LONG_REQUEST_TIMEOUT
        }
        
        print(f"Using LM Studio server: {server_url}")
        print(f"Request timeout: {LONG_REQUEST_TIMEOUT} seconds")
        
        response = requests.post(
            f"{server_url}/v1/chat/completions", 
            headers={"Content-Type": "application/json"}, 
            json=data, 
            stream=stream_enabled, 
            timeout=LONG_REQUEST_TIMEOUT
        )
        print(f"LM Studio response status: {response.status_code}")
        
        if stream_enabled:
            def generate():
                try:
                    for line in response.iter_lines():
                        if line:
                            line = line.decode('utf-8')
                            if line.startswith('data: '):
                                try:
                                    json_str = line[6:]  # Remove 'data: ' prefix
                                    if json_str == '[DONE]':
                                        yield 'data: {"type":"done"}\n\n'
                                        continue
                                        
                                    json_data = json.loads(json_str)
                                    if 'choices' in json_data and len(json_data['choices']) > 0:
                                        content = json_data['choices'][0].get('delta', {}).get('content', '')
                                        if content:
                                            yield f'data: {{"type":"content","content":{json.dumps(content)}}}\n\n'
                                except json.JSONDecodeError as e:
                                    print(f"Error parsing JSON: {str(e)}, Line: {line}")
                                    yield f'data: {{"type":"error","content":"Error parsing response"}}\n\n'
                                except Exception as e:
                                    print(f"Error processing stream: {str(e)}")
                                    yield f'data: {{"type":"error","content":"Error processing response"}}\n\n'
                except Exception as e:
                    print(f"Error in stream generation: {str(e)}")
                    yield f'data: {{"type":"error","content":"Error generating response"}}\n\n'
                finally:
                    yield 'data: {"type":"done"}\n\n'
            
            return Response(generate(), mimetype='text/event-stream')
        else:
            if response.status_code == 200:
                try:
                    data = response.json()
                    if 'choices' in data and len(data['choices']) > 0:
                        content = data['choices'][0].get('message', {}).get('content', '')
                        return jsonify({"response": content})
                    else:
                        return jsonify({"error": "No content in response"}), 500
                except Exception as e:
                    print(f"Error parsing non-streaming response: {str(e)}")
                    return jsonify({"error": f"Error parsing response: {str(e)}"}), 500
            else:
                error_msg = f"API request failed with status {response.status_code}"
                print(error_msg)
                return jsonify({"error": error_msg}), response.status_code
                
    except requests.exceptions.Timeout:
        error_msg = "Request timed out. The model is taking too long to respond."
        print(error_msg)
        return jsonify({"error": error_msg}), 504
    except requests.exceptions.ConnectionError:
        error_msg = "Cannot connect to LM Studio server. Please check your connection and server settings."
        print(error_msg)
        return jsonify({"error": error_msg}), 503
    except requests.exceptions.RequestException as e:
        error_msg = f"Error communicating with LM Studio: {str(e)}"
        print(error_msg)
        return jsonify({"error": error_msg}), 500
    except Exception as e:
        error_msg = f"Error in chat endpoint: {str(e)}"
        print(error_msg)
        return jsonify({"error": error_msg}), 500

@app.route('/summarize', methods=['POST'])
def summarize():
    """Generate a summary of the conversation"""
    conversation = request.json.get('conversation', [])
    model = request.json.get('model', '')
    summary_type = request.json.get('summary_type', 'concise')  # Default to concise
    
    if not conversation:
        return jsonify({'error': 'No conversation provided'})
    
    # Format the conversation for the summarizer
    conversation_text = "\n\n".join([
        f"Panel {msg['panel']} - {msg['panelTitle']}\n"
        f"{'Question' if msg['type'] == 'question' else 'Response'} ({msg['timestamp']}):\n"
        f"{msg['content']}"
        for msg in conversation
    ])
    
    # Define different summary prompts based on type
    summary_prompts = {
        'concise': (
            "Create a concise summary of the following conversation, focusing on the key points and main conclusions. "
            "Include the sequence of interactions and their timestamps."
        ),
        'detailed': (
            "Create a detailed summary of the following conversation, including all major points, supporting details, and conclusions. "
            "Maintain the chronological flow and include relevant timestamps."
        ),
        'whatsapp': (
            "Create a WhatsApp-style summary of the following conversation. Use emojis where appropriate and keep it casual and easy to read. "
            "Include timestamps and panel information to show the flow of conversation."
        ),
        'bullet': (
            "Create a bullet-point summary of the following conversation, organizing key points into clear categories. "
            "Include timestamps and maintain the sequence of interactions."
        ),
        'executive': (
            "Create an executive summary of the following conversation, focusing on decisions, action items, and key takeaways. "
            "Include the chronological progression with timestamps."
        )
    }
    
    # Get the appropriate prompt based on summary type
    summary_prompt = summary_prompts.get(summary_type, summary_prompts['concise'])
    
    # Prepare the summarization prompt
    messages = [
        {"role": "system", "content": summary_prompt},
        {"role": "user", "content": f"Please summarize this conversation:\n\n{conversation_text}"}
    ]
    
    try:
        # Get the current server URL from session or use default
        server_url = session.get('lm_studio_url', LM_STUDIO_SERVER)
        
        # Clean up the server URL
        if server_url.endswith('/v1'):
            server_url = server_url[:-3]
        if server_url.endswith('/'):
            server_url = server_url[:-1]
            
        response = requests.post(
            f'{server_url}/v1/chat/completions',
            json={
                "model": model,
                "messages": messages,
                "temperature": 0.3  # Lower temperature for more focused summary
            },
            timeout=120  # Add timeout
        )
        response.raise_for_status()
        summary_data = response.json()
        
        if 'choices' in summary_data and len(summary_data['choices']) > 0:
            summary = summary_data['choices'][0]['message']['content']
        else:
            summary = "Error: Could not generate summary"
            
    except requests.exceptions.Timeout:
        summary = "Error: Request timed out while generating summary"
    except requests.exceptions.ConnectionError:
        summary = "Error: Could not connect to the language model server. Please check your connection."
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

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        # Secure the filename and add timestamp
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
        filename = timestamp + filename
        
        # Save the file
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # Generate file URL
        file_url = url_for('uploaded_file', filename=filename, _external=True)
        
        # Check if file is an image
        is_image = file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))
        
        return jsonify({
            'message': 'File uploaded successfully',
            'filename': filename,
            'path': file_path,
            'url': file_url,
            'is_image': is_image
        })
    
    return jsonify({'error': 'File type not allowed'}), 400

@app.route('/save_settings', methods=['POST'])
def save_settings():
    global LM_STUDIO_SERVER
    if request.is_json:
        data = request.json
        server_url = data.get('lm_url', LM_STUDIO_SERVER)  # Changed from server_url to lm_url
        
        if server_url:
            # Clean up the URL before saving
            if server_url.endswith('/v1'):
                server_url = server_url[:-3]
            if server_url.endswith('/'):
                server_url = server_url[:-1]
            
            # Save to session
            session['lm_studio_url'] = server_url
            LM_STUDIO_SERVER = server_url
            print(f"Saved LM Studio URL to session: {server_url}")
            
            # Clear cached models to force refresh
            if 'cached_models' in session:
                session.pop('cached_models')
            
            return jsonify({"success": True, "message": "Settings saved"})
    
    return jsonify({"success": False, "message": "Invalid request"}), 400

@app.route('/generate', methods=['POST'])
def generate():
    """Generate a response based on the user's prompt"""
    data = request.json
    prompt = data.get('prompt', '')
    model = data.get('model', '')
    role = data.get('role', 'assistant')
    posture = data.get('posture', 'professional')
    temperature = data.get('temperature', 0.7)
    stream_enabled = data.get('stream', False)
    server_url = data.get('server_url', LM_STUDIO_SERVER)
    
    if not prompt:
        return jsonify({'error': 'No prompt provided'}), 400
    
    if not model:
        return jsonify({'error': 'No model selected'}), 400
    
    # Clean up the server URL to ensure proper format
    if server_url.endswith('/v1'):
        server_url = server_url[:-3]
    if server_url.endswith('/'):
        server_url = server_url[:-1]
    
    # Build system message based on role and posture
    system_message = f"You are an AI assistant with a {posture} posture, acting as a {role}."
    
    # Prepare messages for the model
    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": prompt}
    ]
    
    try:
        # Set streaming based on user preference
        should_stream = stream_enabled
        
        response = requests.post(
            f'{server_url}/v1/chat/completions',
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "stream": should_stream,
                "max_tokens": 2000
            },
            timeout=120,
            stream=should_stream
        )
        
        response.raise_for_status()
        
        if should_stream:
            # Handle streaming response
            def generate():
                try:
                    for line in response.iter_lines():
                        if line:
                            try:
                                decoded_line = line.decode('utf-8')
                                print(f"Debug - Raw line: {decoded_line}")  # Debug line
                                
                                if decoded_line.startswith('data:'):
                                    data_content = decoded_line[6:].strip()
                                    
                                    # Skip empty data or [DONE]
                                    if not data_content or data_content == '[DONE]':
                                        continue
                                    
                                    try:
                                        data = json.loads(data_content)
                                        if 'choices' in data and len(data['choices']) > 0:
                                            choice = data['choices'][0]
                                            if 'delta' in choice and 'content' in choice['delta']:
                                                content = choice['delta']['content']
                                                # Format the response as expected by the frontend
                                                response_data = {
                                                    "type": "content",
                                                    "content": content
                                                }
                                                yield f"data: {json.dumps(response_data)}\n\n"
                                    except json.JSONDecodeError:
                                        # If not valid JSON, send as raw content
                                        response_data = {
                                            "type": "content",
                                            "content": data_content
                                        }
                                        yield f"data: {json.dumps(response_data)}\n\n"
                            except Exception as e:
                                print(f"Error processing line: {str(e)}")
                                error_data = {
                                    "type": "error",
                                    "content": str(e)
                                }
                                yield f"data: {json.dumps(error_data)}\n\n"
                    
                    # Send done message
                    yield "data: {\"type\": \"done\"}\n\n"
                except Exception as e:
                    print(f"Stream error: {str(e)}")
                    error_data = {
                        "type": "error",
                        "content": str(e)
                    }
                    yield f"data: {json.dumps(error_data)}\n\n"
                    yield "data: {\"type\": \"done\"}\n\n"
            
            return Response(generate(), mimetype='text/event-stream')
        else:
            # Handle non-streaming response
            chat_data = response.json()
            
            if 'choices' in chat_data and len(chat_data['choices']) > 0:
                full_response = chat_data['choices'][0]['message']['content']
                return jsonify({'response': full_response})
            else:
                return jsonify({'error': 'No response from model'}), 500
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Request timed out. The model is taking too long to respond.'}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True)
