$(document).ready(function() {
    let nextAssistantId = 2;  // Start from 2 since we have one assistant by default

    // Make chat panels draggable and resizable
    function initializePanelControls() {
        $('.chat-panel').draggable({ handle: '.panel-header' }).resizable();
    }

    // Status log function
    function logStatus(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const statusLog = $('#status-log');
        const logMessage = `[${timestamp}] ${message}\n`;
        
        if (type === 'error') {
            statusLog.append($('<span class="status-error"></span>').text(logMessage));
        } else if (type === 'success') {
            statusLog.append($('<span class="status-success"></span>').text(logMessage));
        } else {
            statusLog.append($('<span class="status-info"></span>').text(logMessage));
        }
        
        // Auto-scroll to bottom
        const statusContent = $('.status-content');
        statusContent.scrollTop(statusContent[0].scrollHeight);
    }

    // Function to create a new assistant panel
    function createAssistantPanel(id) {
        const panel = $(`
            <div class="chat-panel" id="chat-panel-${id}" data-assistant-id="${id}">
                <div class="panel-header">
                    <span>Assistant ${id}</span>
                    <div class="panel-controls">
                        <span class="sequence-number">${id}</span>
                        <button class="remove-assistant" title="Remove Assistant">×</button>
                    </div>
                </div>
                <div class="chat-history" id="chat-history-${id}"></div>
                <div class="controls">
                    <select class="model-select" id="model-${id}">
                        <option value="">Select Model</option>
                    </select>
                    <select class="posture-select" id="posture-${id}">
                        <option value="default">Default Posture</option>
                        <option value="formal">Formal</option>
                        <option value="casual">Casual</option>
                        <option value="summarizer">Summarizer</option>
                    </select>
                    <select class="role-select" id="role-${id}">
                        <option value="assistant">Assistant</option>
                        <option value="analyst">Analyst</option>
                        <option value="critic">Critic</option>
                        <option value="expert">Expert</option>
                    </select>
                    <input type="file" id="file-upload-${id}" />
                    <textarea class="prompt-input" id="prompt-${id}" placeholder="Enter your prompt..."></textarea>
                    <button class="send-btn" data-panel="${id}">Send</button>
                </div>
            </div>
        `);
        
        $('#assistants-container').append(panel);
        initializePanelControls();
        loadModelsForPanel(id);
    }

    // Function to load models for a specific panel
    function loadModelsForPanel(panelId) {
        const select = $(`#model-${panelId}`);
        select.empty();
        select.append('<option value="">Select Model</option>');
        
        if (window.availableModels) {
            window.availableModels.forEach(model => {
                select.append(`<option value="${model}">${model}</option>`);
            });
        }
    }

    // Function to load models from LM Studio
    function loadModels() {
        logStatus('Connecting to LM Studio...');
        
        $.ajax({
            url: '/models',
            method: 'GET',
            dataType: 'json',
            success: function(data) {
                if(data.error) {
                    logStatus('Error loading models: ' + data.error, 'error');
                    return;
                }
                
                const models = data.models || [];
                if (models.length === 0) {
                    logStatus('No models found in LM Studio', 'error');
                    return;
                }

                logStatus('Successfully connected to LM Studio', 'success');
                logStatus(`Found ${models.length} models:`, 'success');
                models.forEach(model => {
                    logStatus(`  • ${model}`, 'info');
                });
                
                // Store models globally
                window.availableModels = models;
                
                // Update all existing panels
                $('.chat-panel').each(function() {
                    const panelId = $(this).data('assistant-id');
                    loadModelsForPanel(panelId);
                });
            },
            error: function(err) {
                logStatus('Failed to connect to LM Studio: ' + err.statusText, 'error');
                console.error('Failed to fetch models:', err);
            }
        });
    }

    // Process chat sequentially
    async function processSequential(userInput) {
        const panels = $('.chat-panel').toArray();
        let currentInput = userInput;
        
        for (let panel of panels) {
            const panelId = $(panel).data('assistant-id');
            const model = $(`#model-${panelId}`).val();
            const posture = $(`#posture-${panelId}`).val();
            const role = $(`#role-${panelId}`).val();
            
            try {
                const response = await $.ajax({
                    url: '/chat',
                    method: 'POST',
                    data: {
                        prompt: currentInput,
                        model: model,
                        posture: posture,
                        role: role,
                        mode: 'sequential'
                    }
                });
                
                appendMessage(panelId, '<strong>Input:</strong> ' + currentInput, 'user');
                appendMessage(panelId, '<strong>Assistant:</strong> ' + response.response, 'assistant');
                
                // Use this response as input for the next assistant
                currentInput = response.response;
                
            } catch (error) {
                appendMessage(panelId, '<strong>Error:</strong> Failed to get response', 'error');
                break;
            }
        }
    }

    // Process chat in parallel
    function processParallel(userInput) {
        $('.chat-panel').each(function() {
            const panelId = $(this).data('assistant-id');
            const model = $(`#model-${panelId}`).val();
            const posture = $(`#posture-${panelId}`).val();
            const role = $(`#role-${panelId}`).val();
            
            appendMessage(panelId, '<strong>Input:</strong> ' + userInput, 'user');
            
            $.ajax({
                url: '/chat',
                method: 'POST',
                data: {
                    prompt: userInput,
                    model: model,
                    posture: posture,
                    role: role,
                    mode: 'parallel'
                },
                success: function(response) {
                    appendMessage(panelId, '<strong>Assistant:</strong> ' + response.response, 'assistant');
                },
                error: function() {
                    appendMessage(panelId, '<strong>Error:</strong> Failed to get response', 'error');
                }
            });
        });
    }

    // Function to append message to chat history
    function appendMessage(panelId, message, sender) {
        const history = $(`#chat-history-${panelId}`);
        const messageElement = $('<div></div>')
            .addClass('message')
            .addClass(sender)
            .html(message);
        history.append(messageElement);
        history.scrollTop(history[0].scrollHeight);
    }

    // Event Handlers
    $('#add-assistant').click(function() {
        createAssistantPanel(nextAssistantId++);
    });

    $(document).on('click', '.remove-assistant', function() {
        $(this).closest('.chat-panel').remove();
    });

    // Send button click event
    $(document).on('click', '.send-btn', function() {
        const mode = $('#processing-mode').val();
        const userInput = $('#prompt-1').val();  // Always use first panel's input
        
        if (!userInput) {
            alert('Please enter a prompt.');
            return;
        }
        
        if (mode === 'sequential') {
            processSequential(userInput);
        } else {
            processParallel(userInput);
        }
        
        // Clear the input
        $('#prompt-1').val('');
    });

    // File upload event
    $(document).on('change', 'input[type="file"]', function() {
        const panelId = $(this).attr('id').split('-')[2];
        const fileInput = this;
        const formData = new FormData();
        
        if (fileInput.files.length === 0) return;
        formData.append('file', fileInput.files[0]);

        $.ajax({
            url: '/upload',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(data) {
                appendMessage(panelId, '<strong>System:</strong> ' + data.message + ' (' + data.filename + ')', 'system');
            },
            error: function() {
                appendMessage(panelId, '<strong>Error:</strong> File upload failed.', 'error');
            }
        });
    });

    // Initialize
    loadModels();
    initializePanelControls();

    // Set up periodic refresh of models
    setInterval(loadModels, 60000);

    // Refresh button click handler
    $('#refresh-status').click(function() {
        $('#status-log').empty();
        loadModels();
    });
});
