from flask import Flask, render_template, request, jsonify, redirect, url_for, send_from_directory, session, Response
import requests
import os
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import re
from PIL import Image
import io
import base64
import json
import time
import numpy as np
import torch
import torchvision.transforms as transforms
import pdf2image
import pytesseract
from pathlib import Path
import uuid
import tiktoken  # Add this import at the top if not present
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User, ChatHistory, UserSettings

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'  # Add this near the top
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///yourdb.sqlite3'

db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Default LM Studio server URL
LM_STUDIO_SERVER = 'http://192.168.50.10:3500'  # Updated to the correct IP address

# Add configuration for uploads
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'heic', 'heif'}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_IMAGE_DIMENSION = 1024  # Maximum dimension for vision models
IMAGE_QUALITY = 85  # JPEG quality setting

# Request timeout settings
REQUEST_TIMEOUT = 60  # Increased from 30 to 60 seconds
LONG_REQUEST_TIMEOUT = 300  # Increased from 120 to 300 seconds for model operations

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Add these variables after other global variables
MODEL_CACHE = {
    'models': [],
    'last_fetch': None
}
MODEL_CACHE_DURATION = 60  # seconds

CHAT_DIR = "chat_history"
os.makedirs(CHAT_DIR, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/settings', methods=['GET', 'POST'])
@login_required
def settings():
    if request.method == 'GET':
        settings = UserSettings.query.filter_by(user_id=current_user.id).all()
        return jsonify({s.key: s.value for s in settings})
    elif request.method == 'POST':
        data = request.json
        for key, value in data.items():
            s = UserSettings.query.filter_by(user_id=current_user.id, key=key).first()
            if s:
                s.value = value
            else:
                s = UserSettings(user_id=current_user.id, key=key, value=value)
                db.session.add(s)
        db.session.commit()
        return jsonify({'success': True})

@app.route('/models', methods=['GET', 'POST'])
def models():
    """Query LM Studio to retrieve available models with caching"""
    try:
        current_time = datetime.now()
        # Check if we need to refresh the cache
        if (
            MODEL_CACHE['last_fetch'] is None or
            (current_time - MODEL_CACHE['last_fetch']).total_seconds() > MODEL_CACHE_DURATION
        ):
            # Get server URL from request or use default
            if request.method == 'POST' and request.is_json:
                data = request.json
                server_url = data.get('server_url', LM_STUDIO_SERVER)
            else:
                server_url = LM_STUDIO_SERVER
            print(f"Fetching models from: {server_url}")
            # Clean up the server URL to ensure proper format
            if server_url.endswith('/v1'):
                server_url = server_url[:-3]
            if server_url.endswith('/'):
                server_url = server_url[:-1]
            # Fetch new models
            response = requests.get(f'{server_url}/v1/models', timeout=120)
            response.raise_for_status()
            models_data = response.json()
            if 'data' in models_data:
                # Update cache
                MODEL_CACHE['models'] = models_data['data']
                MODEL_CACHE['last_fetch'] = current_time
                return jsonify({'models': models_data['data']})
            else:
                # If no data in response but we have cached models, return those
                if MODEL_CACHE['models']:
                    return jsonify({'models': MODEL_CACHE['models']})
                return jsonify({'error': 'Unexpected response format from LM Studio'})
        else:
            # Return cached models if they're still fresh
            print("Returning cached models")
            return jsonify({'models': MODEL_CACHE['models']})
    except requests.exceptions.ConnectionError as e:
        print(f"Connection error fetching models: {str(e)}")
        # Return cached models on connection error if available
        if MODEL_CACHE['models']:
            return jsonify({'models': MODEL_CACHE['models']})
        return jsonify({'error': 'Could not connect to LM Studio'})
    except requests.exceptions.RequestException as e:
        print(f"Request exception fetching models: {str(e)}")
        # Return cached models on request error if available
        if MODEL_CACHE['models']:
            return jsonify({'models': MODEL_CACHE['models']})
        return jsonify({'error': f'Error: {str(e)}'})
    except Exception as e:
        print(f"Unexpected error fetching models: {str(e)}")
        # Return cached models on unexpected error if available
        if MODEL_CACHE['models']:
            return jsonify({'models': MODEL_CACHE['models']})
        return jsonify({'error': f'Unexpected error: {str(e)}'})

def optimize_image(img, max_size=MAX_IMAGE_DIMENSION):
    """Optimize image for vision models while maintaining quality"""
    try:
        # Convert to RGB if necessary (including RGBA)
        if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
            # Create a white background
            background = Image.new('RGB', img.size, (255, 255, 255))
            # Paste the image using alpha channel as mask
            background.paste(img, mask=img.split()[-1])
            img = background
        elif img.mode not in ('RGB', 'RGBA'):
            img = img.convert('RGB')
        
        # Calculate new dimensions while maintaining aspect ratio
        ratio = min(max_size / img.width, max_size / img.height)
        new_size = (int(img.width * ratio), int(img.height * ratio))
        
        # Resize image if larger than max size
        if img.size[0] > max_size or img.size[1] > max_size:
                img = img.resize(new_size, Image.Resampling.LANCZOS)
            
        # Optimize image quality and memory usage
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='JPEG', quality=IMAGE_QUALITY, optimize=True)
        img_byte_arr.seek(0)
        
        # Clear memory
        img.close()
        
        return Image.open(img_byte_arr)
    except Exception as e:
        print(f"Error optimizing image: {e}")
        raise

def process_image_references(message):
    """Process any image references in the message and return processed message"""
    try:
        # Check for image references in the format [Image:image_id]
        image_pattern = r'\[Image:([^\]]+)\]'
        processed_message = message
        
        # Process all image references
        for match in re.finditer(image_pattern, message):
            image_id = match.group(1)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], f"{image_id}.png")
            
            if os.path.exists(filepath):
                try:
                    # Open and process image
                    with Image.open(filepath) as img:
                        # Optimize image for vision models
                        optimized_img = optimize_image(img)
                        
                        # Save to bytes with optimized quality
                        img_byte_arr = io.BytesIO()
                        optimized_img.save(img_byte_arr, format='JPEG', quality=IMAGE_QUALITY, optimize=True)
                        img_byte_arr = img_byte_arr.getvalue()
                        
                        # Convert to base64
                        base64_image = base64.b64encode(img_byte_arr).decode('utf-8')
                        
                        # Replace the image reference with a placeholder
                        processed_message = processed_message.replace(match.group(0), f'[Image {base64_image}]')
                        
                        # Clear memory
                        optimized_img.close()
                except Exception as e:
                    print(f"Error processing image {image_id}: {e}")
                    # Replace failed image with error message
                    processed_message = processed_message.replace(match.group(0), '[Image processing failed]')
            
        return processed_message
    except Exception as e:
        print(f"Error in process_image_references: {e}")
        return message  # Return original message if processing fails

def prepare_prompt(message, mode, posture, role, previous_messages=None):
    """Prepare the prompt based on mode, posture, and role"""
    try:
        # Base system message
        system_message = f"You are a {role} with a {posture} communication style. "
        # Add English-only instruction
        system_message += "Always respond in English, regardless of the user's input language. "
        
        # Add mode-specific instructions
        if mode == 'sequential':
            system_message += (
                "You are part of a sequential conversation where each assistant builds upon previous responses. "
                "Structure your response in this format:\n"
                "1. First, analyze the previous response (if any) and show your thinking process with <analysis>your analysis here</analysis>\n"
                "2. Then, provide your own insights with <insights>your insights here</insights>\n"
                "3. Finally, give your response with <response>your detailed response here</response>\n"
                "Make sure to acknowledge and build upon any previous responses."
            )
        elif mode == 'parallel':
            system_message += (
                "You are part of a parallel conversation where multiple assistants provide different perspectives. "
                "Structure your response in this format:\n"
                "<perspective>your unique perspective</perspective>\n"
                "<response>your detailed response</response>"
            )
        else:
            system_message += (
                "Structure your response in this format:\n"
                "<think>your thought process</think>\n"
                "<answer>your clear and structured response</answer>"
            )
        
        # Add role-specific instructions
        if role == 'researcher':
            system_message += "Focus on providing well-researched, factual information with appropriate citations. "
        elif role == 'teacher':
            system_message += "Focus on explaining concepts clearly and providing educational context. "
        elif role == 'assistant':
            system_message += "Focus on being helpful and providing practical assistance. "
        
        # Add posture-specific instructions
        if posture == 'concise':
            system_message += "Keep your responses brief and to the point. "
        elif posture == 'detailed':
            system_message += "Provide comprehensive, detailed responses. "
        elif posture == 'friendly':
            system_message += "Maintain a friendly and approachable tone. "
        
        # Prepare messages array
        messages = [{"role": "system", "content": system_message}]
        
        # Add previous messages for sequential mode
        if mode == 'sequential' and previous_messages:
            for prev_msg in previous_messages:
                if prev_msg.get('type') == 'question':
                    messages.append({
                        "role": "user",
                        "content": prev_msg.get('content', '')
                    })
                else:
                    messages.append({
                        "role": "assistant",
                        "content": prev_msg.get('content', '')
                    })
        
        # Add current message
        messages.append({"role": "user", "content": message})
        
        return messages
    except Exception as e:
        print(f"Error preparing prompt: {e}")
        return [{"role": "user", "content": message}]

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        message = data.get('message', '')
        model = data.get('model', '')
        stream = data.get('stream', True)
        temperature = data.get('temperature', 0.7)
        max_tokens = data.get('max_tokens', 2000)
        top_p = data.get('top_p', 1.0)
        frequency_penalty = data.get('frequency_penalty', 0.0)
        presence_penalty = data.get('presence_penalty', 0.0)
        stop = data.get('stop', [])
        mode = data.get('mode', 'individual')
        posture = data.get('posture', 'neutral')
        role = data.get('role', 'assistant')
        previous_messages = data.get('previous_messages', [])

        if not message or not model:
            return jsonify({'error': 'Message and model are required'}), 400

        # Get server URL from session or use default
        server_url = session.get('lm_studio_url', LM_STUDIO_SERVER)

        # Clean up the server URL
        if server_url.endswith('/v1'):
            server_url = server_url[:-3]
        if server_url.endswith('/'):
            server_url = server_url[:-1]

        # Verify server connection before proceeding
        try:
            health_check = requests.get(f"{server_url}/v1/models", timeout=REQUEST_TIMEOUT)
            health_check.raise_for_status()
        except requests.exceptions.RequestException as e:
            print(f"Server connection error: {str(e)}")
            return jsonify({"error": "Cannot connect to LM Studio server. Please check your connection and server settings."}), 503

        # Process any image references in the message
        try:
            processed_message = process_image_references(message)
        except Exception as e:
            print(f"Error processing image references: {e}")
            processed_message = message

        # Prepare the messages array with system message and conversation history
        messages = prepare_prompt(processed_message, mode, posture, role, previous_messages)

        # Prepare the request to LM Studio
        headers = {'Content-Type': 'application/json'}
        payload = {
            'model': model,
            'messages': messages,
            'temperature': temperature,
            'max_tokens': max_tokens,
            'top_p': top_p,
            'frequency_penalty': frequency_penalty,
            'presence_penalty': presence_penalty,
            'stop': stop,
            'stream': stream
        }

        print(f"Sending request to {server_url}/v1/chat/completions")

        if stream:
            def generate():
                full_response = ""  # Track the complete response
                response_id = str(uuid.uuid4())  # Generate unique ID for this response
                try:
                    response = requests.post(
                        f"{server_url}/v1/chat/completions",
                        headers=headers,
                        json=payload,
                        stream=True,
                        timeout=LONG_REQUEST_TIMEOUT
                    )
                    if not response.ok:
                        error_data = response.json()
                        yield f"data: {json.dumps({'error': error_data.get('error', 'Unknown error')})}\n\n"
                        return
                    for line in response.iter_lines():
                        if line:
                            try:
                                line = line.decode('utf-8')
                                if line.startswith('data: '):
                                    data = line[6:]
                                    if data == '[DONE]':
                                        if mode == 'sequential':
                                            complete_data = {
                                                'id': f'chatcmpl-{response_id}',
                                                'object': 'chat.completion.chunk',
                                                'created': int(time.time()),
                                                'model': model,
                                                'choices': [{
                                                    'index': 0,
                                                    'delta': {
                                                        'role': 'assistant',
                                                        'content': full_response
                                                    },
                                                    'finish_reason': 'stop'
                                                }],
                                                'complete_response': True,
                                                'sequential_mode': True
                                            }
                                            yield f"data: {json.dumps(complete_data)}\n\n"
                                        yield 'data: [DONE]\n\n'
                                    else:
                                        try:
                                            json_data = json.loads(data)
                                            if 'choices' in json_data and json_data['choices']:
                                                delta = json_data['choices'][0].get('delta', {})
                                                if 'content' in delta:
                                                    content = delta['content']
                                                    full_response += content
                                                    response_data = {
                                                        'id': f'chatcmpl-{response_id}',
                                                        'object': 'chat.completion.chunk',
                                                        'created': int(time.time()),
                                                        'model': model,
                                                        'choices': [{
                                                            'index': 0,
                                                            'delta': {
                                                                'content': content
                                                            },
                                                            'finish_reason': None
                                                        }]
                                                    }
                                                    yield f"data: {json.dumps(response_data)}\n\n"
                                        except json.JSONDecodeError as e:
                                            print(f"Error parsing JSON: {data}")
                                            yield f"data: {json.dumps({'error': f'JSON parse error: {str(e)}'})}\n\n"
                                        except Exception as e:
                                            print(f"Error processing line: {e}")
                                            yield f"data: {json.dumps({'error': f'Stream processing error: {str(e)}'})}\n\n"
                            except Exception as e:
                                print(f"Error processing line: {e}")
                                yield f"data: {json.dumps({'error': f'Stream processing error: {str(e)}'})}\n\n"
                except Exception as e:
                    print(f"Error in stream generation: {e}")
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"
                    yield 'data: [DONE]\n\n'

            return Response(generate(), mimetype='text/event-stream')
        else:
            try:
                response = requests.post(
                    f"{server_url}/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=LONG_REQUEST_TIMEOUT
                )
                
                if not response.ok:
                    error_data = response.json()
                    return jsonify({'error': error_data.get('error', 'Unknown error')}), response.status_code

                data = response.json()
                return jsonify(data)
            except Exception as e:
                print(f"Error in non-streaming request: {e}")
                return jsonify({'error': str(e)}), 500

    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/summarize', methods=['POST'])
def summarize():
    """Generate a summary of the conversation"""
    conversation = request.json.get('conversation', [])
    model = request.json.get('model', '')
    summary_type = request.json.get('summary_type', 'concise')  # Default to concise
    
    if not conversation:
        print("Error: No conversation provided")
        return jsonify({'error': 'No conversation provided'})
    
    if not model:
        print("Error: No model specified")
        return jsonify({'error': 'No model specified'})
    
    print(f"Generating {summary_type} summary using model: {model}")
    print(f"Conversation length: {len(conversation)} messages")
    
    # Format the conversation for the summarizer
    try:
        # --- Tokenizer logic ---
        # Set a safe token limit for your model (adjust as needed)
        MAX_TOKENS = 8000
        truncated = False
        tokenizer = None
        try:
            tokenizer = tiktoken.encoding_for_model(model)
        except Exception:
            try:
                tokenizer = tiktoken.get_encoding('cl100k_base')
            except Exception:
                tokenizer = None
        
        def count_tokens(text):
            if tokenizer:
                return len(tokenizer.encode(text))
            return len(text) // 4  # fallback estimate
        
        # Build conversation text, starting with the question and working back from the end
        conversation_text = ""
        tokens_used = 0
        # Always include the first question
        if conversation:
            first = conversation[0]
            first_block = (
                f"Panel {first['panel']} - {first['panelTitle']}\n"
                f"{'Question' if first['type'] == 'question' else 'Response'} ({first['timestamp']}):\n"
                f"{first['content']}\n\n"
            )
            tokens_used += count_tokens(first_block)
            conversation_text += first_block
        # Now add as many messages as possible from the end
        for msg in reversed(conversation[1:]):
            block = (
        f"Panel {msg['panel']} - {msg['panelTitle']}\n"
        f"{'Question' if msg['type'] == 'question' else 'Response'} ({msg['timestamp']}):\n"
                f"{msg['content']}\n\n"
            )
            block_tokens = count_tokens(block)
            if tokens_used + block_tokens > MAX_TOKENS:
                truncated = True
                break
            conversation_text = block + conversation_text
            tokens_used += block_tokens
    except KeyError as e:
        print(f"Error formatting conversation: {str(e)}")
        return jsonify({'error': f'Invalid conversation format: missing {str(e)}'})
    
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
        print(f"Using server URL: {server_url}")
        
        # Clean up the server URL
        if server_url.endswith('/v1'):
            server_url = server_url[:-3]
        if server_url.endswith('/'):
            server_url = server_url[:-1]
            
        print(f"Making request to: {server_url}/v1/chat/completions")
            
        response = requests.post(
            f'{server_url}/v1/chat/completions',
            json={
                "model": model,
                "messages": messages,
                "temperature": 0.3  # Lower temperature for more focused summary
            },
            timeout=120  # Add timeout
        )
        
        print(f"Response status code: {response.status_code}")
        response.raise_for_status()
        
        summary_data = response.json()
        print(f"Response data: {json.dumps(summary_data, indent=2)}")
        
        if 'choices' in summary_data and len(summary_data['choices']) > 0:
            summary = summary_data['choices'][0]['message']['content']
            print("Successfully generated summary")
        else:
            print("Error: No choices in response")
            summary = "Error: Could not generate summary - no response from model"
            
    except requests.exceptions.Timeout:
        print("Error: Request timed out")
        summary = "Error: Request timed out while generating summary. Please try again."
    except requests.exceptions.ConnectionError as e:
        print(f"Connection error: {str(e)}")
        summary = "Error: Could not connect to the language model server. Please check your connection and server status."
    except requests.exceptions.RequestException as e:
        print(f"Request error: {str(e)}")
        summary = f'Error generating summary: {str(e)}'
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        summary = f'Unexpected error while generating summary: {str(e)}'
    
    # After getting the summary:
    if 'summary' in locals() and truncated:
        summary = "Note: The summary was truncated due to input length limits.\n\n" + summary
    
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

def process_image_with_gpu(image):
    """Process image using GPU if available"""
    try:
        # Check if CUDA is available
        if torch.cuda.is_available():
            # Convert PIL image to tensor
            transform = transforms.ToTensor()
            img_tensor = transform(image).unsqueeze(0).cuda()
            
            # Process on GPU
            # Example: resize using GPU
            if img_tensor.size(2) > 512 or img_tensor.size(3) > 512:
                img_tensor = torch.nn.functional.interpolate(
                    img_tensor, 
                    size=(512, 512), 
                    mode='bilinear', 
                    align_corners=False
                )
            
            # Convert back to PIL image
            img_array = img_tensor.squeeze(0).permute(1, 2, 0).cpu().numpy()
            img_array = (img_array * 255).astype(np.uint8)
            return Image.fromarray(img_array)
        else:
            # Fallback to CPU processing
            if image.size[0] > 512 or image.size[1] > 512:
                ratio = min(512 / image.width, 512 / image.height)
                new_size = (int(image.width * ratio), int(image.height * ratio))
                return image.resize(new_size, Image.Resampling.LANCZOS)
            return image
    except Exception as e:
        print(f"GPU processing error: {e}")
        return image

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    # Check file extension
    file_extension = file.filename.lower().split('.')[-1]
    if file_extension not in ALLOWED_EXTENSIONS:
        return jsonify({'error': f'Invalid file type. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'}), 400
    
    try:
        # Create a unique filename
        filename = f"file_{int(time.time())}_{os.urandom(4).hex()}"
        
        # Handle PDF files
        if file_extension == 'pdf':
            pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{filename}.pdf")
            file.save(pdf_path)
            try:
                # Process PDF with OCR model
                extracted_text = process_pdf(pdf_path)
                if extracted_text:
                    # Save extracted text
                    text_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{filename}.txt")
                    with open(text_path, 'w', encoding='utf-8') as f:
                        f.write(extracted_text)
                    # Clean up PDF file
                    os.remove(pdf_path)
                    return jsonify({
                        'success': True,
                        'filename': f"{filename}.txt",
                        'file_id': filename,
                        'type': 'pdf',
                        'content': extracted_text
                    })
                else:
                    return jsonify({'error': 'Failed to process PDF'}), 500
            except Exception as e:
                print(f"Error processing PDF: {e}")
                return jsonify({'error': f'Error processing PDF: {str(e)}'}), 500
            finally:
                # Clean up PDF file if it still exists
                if os.path.exists(pdf_path):
                    os.remove(pdf_path)
        # Handle image files
        else:
            try:
                # Process image with optimization
                with Image.open(file) as img:
                    # Optimize image for vision models
                    optimized_img = optimize_image(img)
                    # Save processed image as PNG to preserve quality
                    img_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{filename}.png")
                    optimized_img.save(img_path, format='PNG', optimize=True)
                    # Get image dimensions for response
                    width, height = optimized_img.size
                    # Clear memory
                    optimized_img.close()
                    return jsonify({
                        'success': True,
                        'filename': f"{filename}.png",
                        'file_id': filename,
                        'type': 'image',
                        'dimensions': {
                            'width': width,
                            'height': height
                        }
                    })
            except Exception as e:
                print(f"Error processing image: {e}")
                return jsonify({'error': f'Error processing image: {str(e)}'}), 500
                
    except Exception as e:
        print(f"Error in upload_file: {e}")
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

def process_pdf(file_path):
    """Process PDF file using Qwen2-VL-OCR model"""
    try:
        # Convert PDF to images with optimized settings
        images = pdf2image.convert_from_path(
            file_path,
            dpi=200,  # Reduced DPI for faster processing
            thread_count=2,  # Use multiple threads
            grayscale=True,  # Convert to grayscale for faster OCR
            size=(None, 1000)  # Limit height to 1000px
        )
        
        # Process each page with the OCR model
        extracted_text = []
        for i, image in enumerate(images):
            # Convert PIL image to base64 with optimization
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='PNG', optimize=True)
            img_byte_arr = img_byte_arr.getvalue()
            base64_image = base64.b64encode(img_byte_arr).decode('utf-8')
            
            # Prepare the OCR prompt
            ocr_prompt = "Please perform OCR on this image and extract all text. Format the output clearly with proper spacing and line breaks. Include any tables, lists, or structured content while maintaining their format."
            
            # Create the message with the image
            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": ocr_prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ]
            
            # Get server URL from session or use default
            server_url = session.get('lm_studio_url', LM_STUDIO_SERVER)
            
            # Clean up the server URL
            if server_url.endswith('/v1'):
                server_url = server_url[:-3]
            if server_url.endswith('/'):
                server_url = server_url[:-1]
            
            # Send request to the model with optimized settings
            response = requests.post(
                f"{server_url}/v1/chat/completions",
                json={
                    "model": "qwen2-vl-ocr-2b-instruct-i1",
                    "messages": messages,
                    "temperature": 0.1,  # Low temperature for more accurate OCR
                    "max_tokens": 4000
                },
                timeout=60  # Reduced timeout for faster feedback
            )
            
            if response.ok:
                result = response.json()
                if 'choices' in result and len(result['choices']) > 0:
                    page_text = result['choices'][0]['message']['content']
                    extracted_text.append(f"Page {i+1}:\n{page_text}")
                else:
                    extracted_text.append(f"Page {i+1}: Error extracting text")
            else:
                error_msg = response.text if response.text else "Unknown error"
                print(f"OCR model error: {error_msg}")
                extracted_text.append(f"Page {i+1}: Error processing with OCR model - {error_msg}")
        
        return "\n\n".join(extracted_text)
    except Exception as e:
        print(f"PDF processing error: {e}")
        return None

@app.route('/file/<file_id>')
def get_file(file_id):
    try:
        # Find the file
        for filename in os.listdir(app.config['UPLOAD_FOLDER']):
            if file_id in filename:
                return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
        return "File not found", 404
    except Exception as e:
        print(f"Error retrieving file: {e}")
        return "Error retrieving file", 500

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

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    user = User(username=data['username'], password_hash=generate_password_hash(data['password']))
    db.session.add(user)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data['username']).first()
    if user and check_password_hash(user.password_hash, data['password']):
        login_user(user)
        return jsonify({'success': True})
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'success': True})

@app.route('/chat_history', methods=['GET', 'POST', 'DELETE'])
@login_required
def chat_history():
    if request.method == 'GET':
        history = ChatHistory.query.filter_by(user_id=current_user.id).all()
        return jsonify([{
            'id': h.id,
            'panel': h.panel,
            'sender': h.sender,
            'content': h.content,
            'timestamp': h.timestamp.isoformat()
        } for h in history])
    elif request.method == 'POST':
        data = request.json
        h = ChatHistory(
            user_id=current_user.id,
            panel=data.get('panel'),
            sender=data.get('sender'),
            content=data.get('content')
        )
        db.session.add(h)
        db.session.commit()
        return jsonify({'success': True})
    elif request.method == 'DELETE':
        ChatHistory.query.filter_by(user_id=current_user.id).delete()
        db.session.commit()
        return jsonify({'success': True})

@app.route('/save_chat', methods=['POST'])
@login_required
def save_chat():
    data = request.json
    chat_name = data.get('name')
    messages = data.get('messages')
    timestamp = datetime.utcnow().isoformat()
    username = current_user.username
    filename = f"chat_{timestamp}_{username}.json"
    chat_data = {
        "name": chat_name,
        "username": username,
        "timestamp": timestamp,
        "messages": messages
    }
    with open(os.path.join(CHAT_DIR, filename), 'w', encoding='utf-8') as f:
        json.dump(chat_data, f, ensure_ascii=False, indent=2)
    return jsonify({"success": True, "filename": filename})

@app.route('/list_chats', methods=['GET'])
@login_required
def list_chats():
    chats = []
    for fname in os.listdir(CHAT_DIR):
        if fname.endswith('.json'):
            with open(os.path.join(CHAT_DIR, fname), 'r', encoding='utf-8') as f:
                chat = json.load(f)
                if chat.get("username") == current_user.username:
                    chats.append({
                        "name": chat["name"],
                        "username": chat["username"],
                        "timestamp": chat["timestamp"],
                        "filename": fname
                    })
    chats.sort(key=lambda x: x["timestamp"], reverse=True)
    return jsonify(chats)

@app.route('/load_chat', methods=['GET'])
@login_required
def load_chat():
    filename = request.args.get('filename')
    filepath = os.path.join(CHAT_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "Chat not found"}), 404
    with open(filepath, 'r', encoding='utf-8') as f:
        chat = json.load(f)
    if chat.get("username") != current_user.username:
        return jsonify({"error": "Unauthorized"}), 403
    return jsonify(chat)

@app.route('/delete_chat', methods=['POST'])
@login_required
def delete_chat():
    filename = request.json.get('filename')
    filepath = os.path.join(CHAT_DIR, filename)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            chat = json.load(f)
        if chat.get("username") != current_user.username:
            return jsonify({"error": "Unauthorized"}), 403
        os.remove(filepath)
        return jsonify({"success": True})
    return jsonify({"error": "File not found"}), 404

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
