import * as vscode from 'vscode';

/**
 * Generates the webview HTML content
 * Extracted to separate file for better maintainability
 */
export function getWebviewContent(webview: vscode.Webview, markedUri?: vscode.Uri): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource} 'unsafe-inline'; style-src ${webview.cspSource} 'unsafe-inline';">
    <title>My Code Assistant</title>
    <style>
        * { box-sizing: border-box; }
        
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 15px;
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        
        .header {
            text-align: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .header h2 {
            margin: 0;
            color: var(--vscode-textLink-foreground);
            font-size: 16px;
            font-weight: 600;
        }

        .tabs {
            display: flex;
            margin-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .tab {
            padding: 8px 16px;
            cursor: pointer;
            border: none;
            background: transparent;
            color: var(--vscode-foreground);
            border-bottom: 2px solid transparent;
            font-size: 13px;
            transition: all 0.2s ease;
        }

        .tab:hover {
            background-color: var(--vscode-toolbar-hoverBackground);
        }

        .tab.active {
            border-bottom-color: var(--vscode-textLink-foreground);
            color: var(--vscode-textLink-foreground);
            font-weight: 500;
        }

        .tab-content {
            display: none;
            flex: 1;
            flex-direction: column;
        }

        .tab-content.active {
            display: flex;
        }

        .model-selection {
            margin-bottom: 15px;
            padding: 12px;
            background-color: var(--vscode-textBlockQuote-background);
            border-radius: 4px;
            border-left: 3px solid var(--vscode-textLink-foreground);
        }

        .model-status {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            font-size: 12px;
        }

        .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: var(--vscode-errorForeground);
        }

        .status-indicator.connected {
            background-color: var(--vscode-terminal-ansiGreen);
        }

        .model-dropdown {
            width: 100%;
            padding: 6px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 3px;
            font-size: 12px;
        }

        .model-info {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        
        .output-area {
            flex: 1;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 15px;
            margin-bottom: 15px;
            overflow-y: auto;
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
            line-height: 1.5;
            border-radius: 4px;
            box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
            min-height: 100px;
        }

        .chat-message {
            margin-bottom: 15px;
            padding: 10px;
            border-radius: 6px;
            max-width: 90%;
        }

        .chat-message.user {
            background-color: var(--vscode-textBlockQuote-background);
            color: var(--vscode-textLink-activeForeground);
            margin-left: auto;
            text-align: right;
        }

        .chat-message.assistant {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textBlockQuote-border);
        }

        .message-header {
            font-size: 11px;
            opacity: 0.7;
            margin-bottom: 5px;
        }

        .message-content {
            font-size: 13px;
            line-height: 1.6;
        }

        .message-content pre {
            background-color: #1e1e1e;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
            color: #d4d4d4;
        }

        .message-content code {
            font-family: 'Courier New', Courier, monospace;
            background-color: rgba(255,255,255,0.1);
            padding: 2px 4px;
            border-radius: 3px;
        }

        .message-content p {
            margin-bottom: 10px;
            line-height: 1.6;
        }
        
        .output-area::-webkit-scrollbar {
            width: 8px;
        }
        
        .output-area::-webkit-scrollbar-track {
            background: var(--vscode-scrollbarSlider-background);
        }
        
        .output-area::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-hoverBackground);
            border-radius: 4px;
        }
        
        .input-container {
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
        }
        
        .help-text {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            background-color: var(--vscode-textBlockQuote-background);
            padding: 8px;
            border-radius: 3px;
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            margin-bottom: 10px;
        }
        
        .help-text strong {
            color: var(--vscode-textLink-foreground);
        }
        
        .input-wrapper {
            position: relative;
        }
        
        .input-area {
            width: 100%;
            min-height: 80px;
            max-height: 120px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            padding: 12px;
            resize: vertical;
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
            border-radius: 4px;
            outline: none;
            transition: border-color 0.2s ease;
        }
        
        .input-area:focus {
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }
        
        .input-area::placeholder {
            color: var(--vscode-input-placeholderForeground);
            font-style: italic;
        }
        
        .button-container {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
            margin-top: 10px;
        }
        
        .submit-button, .chat-button, .clear-button, .cancel-button {
            border: none;
            padding: 10px 16px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 500;
            transition: background-color 0.2s ease;
            flex-shrink: 0;
        }

        .submit-button, .chat-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .submit-button:hover:not(:disabled), .chat-button:hover:not(:disabled) {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .submit-button:disabled, .chat-button:disabled {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
            opacity: 0.7;
        }
        
        .clear-button, .cancel-button {
            background-color: transparent;
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-button-border);
        }
        
        .clear-button:hover, .cancel-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .cancel-button {
            display: none;
        }

        .cancel-button.active {
            display: inline-block;
        }
        
        .shortcut-hint {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            margin-left: auto;
            font-style: italic;
        }
        
        .welcome-content {
            color: var(--vscode-descriptionForeground);
            line-height: 1.8;
        }
        
        .command-example {
            color: var(--vscode-textLink-foreground);
            font-family: var(--vscode-editor-font-family);
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 4px;
            border-radius: 2px;
            font-size: 12px;
        }
        
        .loading {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .spinner {
            width: 14px;
            height: 14px;
            border: 2px solid var(--vscode-button-secondaryBackground);
            border-top: 2px solid var(--vscode-button-foreground);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .error-message {
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 8px;
            border-radius: 3px;
            font-size: 12px;
            margin-top: 8px;
        }

        .context-toggle {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 8px;
            font-size: 12px;
        }

        .context-toggle input[type="checkbox"] {
            margin: 0;
            cursor: pointer;
        }

        .context-toggle label {
            cursor: pointer;
        }

        .context-preview {
            max-height: 100px;
            overflow-y: auto;
            background-color: var(--vscode-textCodeBlock-background);
            padding: 8px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
            margin-top: 8px;
            border-left: 3px solid var(--vscode-textLink-foreground);
        }

        .refresh-models-btn {
            background: transparent;
            border: none;
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            font-size: 11px;
            padding: 2px 4px;
            border-radius: 2px;
            margin-left: 8px;
        }

        .refresh-models-btn:hover {
            background-color: var(--vscode-toolbar-hoverBackground);
        }

        @media (max-width: 300px) {
            .button-container {
                flex-direction: column;
                align-items: stretch;
            }
            
            .shortcut-hint {
                margin-left: 0;
                text-align: center;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>🤖 My Code Assistant</h2>
    </div>

    <div class="tabs">
        <button class="tab active" data-tab="commands">📋 Commands</button>
        <button class="tab" data-tab="chat">💬 AI Chat</button>
    </div>

    <!-- Commands Tab -->
    <div class="tab-content active" id="commands-tab">
        <div class="output-area" id="output">
            <div class="welcome-content">
                <strong>Welcome to My Code Assistant!</strong>
                
                <strong>Available Commands:</strong>
                • <span class="command-example">@project</span> - Show project path and directory tree (3 levels deep)
                • <span class="command-example">@directory &lt;path&gt;</span> - Show directory tree for specific path
                • <span class="command-example">@file &lt;path&gt;</span> - Show file content and metadata
                
                <strong>Examples:</strong>
                <span class="command-example">@project</span>
                <span class="command-example">@directory src</span>
                <span class="command-example">@file package.json</span>
                
                <strong>Tips:</strong>
                • Run multiple commands at once (one per line)
                • Use relative paths from workspace root
                • Press Ctrl+Enter to quickly submit
                
                Ready to assist! Enter a command below to get started.
            </div>
        </div>
        
        <div class="input-container">
            <div class="help-text">
                <strong>Quick Start:</strong> Type <span class="command-example">@project</span> to explore your workspace
            </div>
            
            <div class="input-wrapper">
                <textarea 
                    class="input-area" 
                    id="commandInput" 
                    placeholder="Enter commands here... (e.g., @project or @file package.json)"
                ></textarea>
            </div>
            
            <div class="button-container">
                <button class="submit-button" id="submitButton">
                    <span id="buttonText">Execute Commands</span>
                </button>
                <button class="clear-button" id="clearButton">Clear</button>
                <span class="shortcut-hint">Ctrl+Enter to submit</span>
            </div>
        </div>
    </div>

    <!-- Chat Tab -->
    <div class="tab-content" id="chat-tab">
        <div class="model-selection">
            <div class="model-status">
                <div class="status-indicator" id="connectionStatus"></div>
                <span id="connectionText">Checking Ollama connection...</span>
                <button class="refresh-models-btn" id="refreshModels">🔄 Refresh</button>
            </div>
            <select class="model-dropdown" id="modelSelect">
                <option value="">Loading models...</option>
            </select>
            <div class="model-info" id="modelInfo"></div>
            <div class="error-message" id="modelError" style="display: none;"></div>
        </div>

        <div class="output-area" id="chatOutput">
            <div class="welcome-content">
                <strong>🤖 AI Chat Assistant</strong>
                
                Select an Ollama model above to start chatting. You can:
                • Ask questions about your code
                • Get explanations for files and directories  
                • Request code analysis and suggestions
                • Use command output as context
                
                <strong>Tips:</strong>
                • Run commands in Commands tab first to gather context
                • Enable "Use command context" to include recent command output
            </div>
        </div>
        
        <div class="input-container">
            <div class="context-toggle">
                <input type="checkbox" id="useContext" />
                <label for="useContext">Use command context in AI conversation</label>
            </div>
            <div class="context-preview" id="contextPreview" style="display: none;"></div>
            
            <div class="input-wrapper">
                <textarea 
                    class="input-area" 
                    id="chatInput" 
                    placeholder="Ask me anything about your code..."
                ></textarea>
            </div>
            
            <div class="button-container">
                <button class="chat-button" id="chatButton">
                    <span id="chatButtonText">Send Message</span>
                </button>
                <button class="cancel-button" id="cancelButton">Cancel</button>
                <button class="clear-button" id="clearChatButton">Clear Chat</button>
                <span class="shortcut-hint">Ctrl+Enter to send</span>
            </div>
        </div>
    </div>
    
    <script src="${markedUri}"></script>
    <script>
        (function() {
            const vscode = acquireVsCodeApi();  
            
            // Elements
            const tabs = document.querySelectorAll('.tab');
            const tabContents = document.querySelectorAll('.tab-content');
            const output = document.getElementById('output');
            const chatOutput = document.getElementById('chatOutput');
            const commandInput = document.getElementById('commandInput');
            const chatInput = document.getElementById('chatInput');
            const submitButton = document.getElementById('submitButton');
            const chatButton = document.getElementById('chatButton');
            const clearButton = document.getElementById('clearButton');
            const clearChatButton = document.getElementById('clearChatButton');
            const cancelButton = document.getElementById('cancelButton');
            const buttonText = document.getElementById('buttonText');
            const chatButtonText = document.getElementById('chatButtonText');
            const modelSelect = document.getElementById('modelSelect');
            const modelInfo = document.getElementById('modelInfo');
            const modelError = document.getElementById('modelError');
            const connectionStatus = document.getElementById('connectionStatus');
            const connectionText = document.getElementById('connectionText');
            const refreshModels = document.getElementById('refreshModels');
            const useContext = document.getElementById('useContext');
            const contextPreview = document.getElementById('contextPreview');

            let currentContext = '';
            let chatHistory = [];
            let isProcessing = false;

            // Tab switching
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const targetTab = tab.dataset.tab;
                    
                    tabs.forEach(t => t.classList.remove('active'));
                    tabContents.forEach(tc => tc.classList.remove('active'));
                    
                    tab.classList.add('active');
                    document.getElementById(targetTab + '-tab').classList.add('active');
                    
                    saveState();
                });
            });

            // State management
            const previousState = vscode.getState();
            if (previousState) {
                if (previousState.commandInputValue) commandInput.value = previousState.commandInputValue;
                if (previousState.chatInputValue) chatInput.value = previousState.chatInputValue;
                if (previousState.outputValue) output.innerHTML = previousState.outputValue;
                if (previousState.chatHistory) {
                    chatHistory = previousState.chatHistory;
                    renderChatHistory();
                }
                if (previousState.currentContext) {
                    currentContext = previousState.currentContext;
                    updateContextPreview();
                }
                if (previousState.activeTab) {
                    const activeTabButton = document.querySelector('[data-tab="' + previousState.activeTab + '"]');
                    if (activeTabButton) activeTabButton.click();
                }
            }

            function saveState() {
                vscode.setState({
                    commandInputValue: commandInput.value,
                    chatInputValue: chatInput.value,
                    outputValue: output.innerHTML,
                    chatHistory: chatHistory,
                    currentContext: currentContext,
                    activeTab: document.querySelector('.tab.active').dataset.tab
                });
            }

            function setButtonLoading(button, textElement, loading, loadingText = 'Processing...') {
                isProcessing = loading;
                button.disabled = loading;
                
                if (loading) {
                    textElement.innerHTML = '<div class="loading"><div class="spinner"></div>' + loadingText + '</div>';
                    if (button === chatButton) {
                        cancelButton.classList.add('active');
                    }
                } else {
                    textElement.textContent = button === submitButton ? 'Execute Commands' : 'Send Message';
                    if (button === chatButton) {
                        cancelButton.classList.remove('active');
                    }
                }
            }

            function executeCommands() {
                const command = commandInput.value.trim();
                if (!command || isProcessing) return;

                if (!command.includes('@')) {
                    output.textContent = '❌ No valid commands found. Commands must start with @ character.\\n\\nExample: @project';
                    return;
                }

                vscode.postMessage({
                    type: 'command',
                    value: command
                });

                setButtonLoading(submitButton, buttonText, true);
                saveState();
            }

            function sendChatMessage() {
                const message = chatInput.value.trim();
                if (!message || isProcessing) return;

                const selectedModel = modelSelect.value;
                if (!selectedModel) {
                    alert('Please select a model first');
                    return;
                }

                chatHistory.push({
                    id: Date.now(),
                    type: 'user',
                    content: message,
                    timestamp: new Date().toLocaleTimeString()
                });

                renderChatHistory();

                const contextToUse = useContext.checked ? currentContext : '';

                vscode.postMessage({
                    type: 'chatWithModel',
                    prompt: message,
                    context: contextToUse
                });

                setButtonLoading(chatButton, chatButtonText, true, 'Thinking...');
                chatInput.value = '';
                saveState();
            }

            function renderChatHistory() {
                if (chatHistory.length === 0) {
                    chatOutput.innerHTML = \`<div class="welcome-content">
                        <strong>🤖 AI Chat Assistant</strong>
                        
                        Select an Ollama model above to start chatting.
                    </div>\`;
                    return;
                }

                chatOutput.innerHTML = chatHistory.map(msg => \`
                    <div class="chat-message \${msg.type}" id="msg-\${msg.id}">
                        <div class="message-header">\${msg.type === 'user' ? 'You' : 'Assistant'} • \${msg.timestamp}</div>
                        <div class="message-content">\${marked.parse(msg.content)}</div>
                    </div>
                \`).join('');
                
                chatOutput.scrollTop = chatOutput.scrollHeight;
            }

            function updateContextPreview() {
                if (currentContext && useContext.checked) {
                    contextPreview.style.display = 'block';
                    contextPreview.textContent = currentContext.substring(0, 200) + (currentContext.length > 200 ? '...' : '');
                } else {
                    contextPreview.style.display = 'none';
                }
            }

            // Event listeners
            submitButton.addEventListener('click', executeCommands);
            chatButton.addEventListener('click', sendChatMessage);

            clearButton.addEventListener('click', () => {
                commandInput.value = '';
                output.innerHTML = \`<div class="welcome-content">Output cleared. Enter a command to get started.</div>\`;
                currentContext = '';
                updateContextPreview();
                commandInput.focus();
                saveState();
            });

            clearChatButton.addEventListener('click', () => {
                chatHistory = [];
                renderChatHistory();
                chatInput.focus();
                saveState();
            });

            cancelButton.addEventListener('click', () => {
                vscode.postMessage({ type: 'cancelRequest' });
                setButtonLoading(chatButton, chatButtonText, false);
            });

            commandInput.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    e.preventDefault();
                    executeCommands();
                }
                setTimeout(saveState, 100);
            });

            chatInput.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    e.preventDefault();
                    sendChatMessage();
                }
                setTimeout(saveState, 100);
            });

            commandInput.addEventListener('input', saveState);
            chatInput.addEventListener('input', saveState);
            useContext.addEventListener('change', updateContextPreview);

            modelSelect.addEventListener('change', (e) => {
                const selectedModel = e.target.value;
                if (selectedModel) {
                    vscode.postMessage({
                        type: 'selectModel',
                        value: selectedModel
                    });
                }
            });

            refreshModels.addEventListener('click', () => {
                vscode.postMessage({ type: 'getModels' });
                connectionText.textContent = 'Refreshing models...';
            });

            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                
                switch (message.type) {
                    case 'result':
                        output.textContent = message.value;
                        output.scrollTop = output.scrollHeight;
                        setButtonLoading(submitButton, buttonText, false);
                        commandInput.value = '';
                        
                        if (message.context) {
                            currentContext = message.context;
                            updateContextPreview();
                        }
                        
                        commandInput.focus();
                        saveState();
                        break;

                    case 'modelsLoaded':
                        connectionStatus.classList.add('connected');
                        connectionText.textContent = \`Connected • \${message.models.length} models available\`;
                        modelError.style.display = 'none';
                        
                        modelSelect.innerHTML = '<option value="">Select a model...</option>';
                        message.models.forEach(model => {
                            const option = document.createElement('option');
                            option.value = model.name;
                            option.textContent = \`\${model.name} (\${model.parameterSize}, \${model.size})\`;
                            modelSelect.appendChild(option);
                        });
                        break;

                    case 'modelsError':
                        connectionStatus.classList.remove('connected');
                        connectionText.textContent = 'Connection failed';
                        modelError.style.display = 'block';
                        modelError.textContent = message.error;
                        modelSelect.innerHTML = '<option value="">No models available</option>';
                        break;

                    case 'modelSelected':
                        modelInfo.textContent = \`Selected: \${message.model}\`;
                        break;

                    case 'chatResponse':
                        const responseText = message.response;
                        const isDone = message.done;
                        const lastMessage = chatHistory[chatHistory.length - 1];
                        
                        if (isDone) {
                            saveState();
                            setButtonLoading(chatButton, chatButtonText, false);
                            break;
                        }

                        if (lastMessage && lastMessage.type !== 'user') {
                            lastMessage.content += responseText;
                            const messageElement = document.getElementById(\`msg-\${lastMessage.id}\`);
                            if (messageElement) {
                                const contentDiv = messageElement.querySelector('.message-content');
                                if (contentDiv) {
                                    contentDiv.innerHTML = marked.parse(lastMessage.content);
                                    chatOutput.scrollTop = chatOutput.scrollHeight;
                                }
                            }
                        } else {
                            const newMessage = {
                                id: Date.now(), 
                                type: 'assistant',
                                content: responseText,
                                timestamp: new Date().toLocaleTimeString()
                            };
                            
                            chatHistory.push(newMessage);
                            const newDiv = document.createElement('div');
                            newDiv.className = 'chat-message assistant';
                            newDiv.id = \`msg-\${newMessage.id}\`;
                            newDiv.innerHTML = \`
                                <div class="message-header">Assistant • \${newMessage.timestamp}</div>
                                <div class="message-content">\${marked.parse(responseText)}</div>
                            \`;
                            chatOutput.appendChild(newDiv);
                            chatOutput.scrollTop = chatOutput.scrollHeight;
                        }
                        break;

                    case 'chatError':
                        chatHistory.push({
                            id: Date.now(),
                            type: 'assistant',
                            content: \`❌ Error: \${message.error}\`,
                            timestamp: new Date().toLocaleTimeString()
                        });
                        renderChatHistory();
                        setButtonLoading(chatButton, chatButtonText, false);
                        chatInput.focus();
                        saveState();
                        break;
                }
            });

            // Focus appropriate input
            const activeTab = document.querySelector('.tab.active').dataset.tab;
            if (activeTab === 'commands') {
                commandInput.focus();
            } else {
                chatInput.focus();
            }

            // Request models on load
            vscode.postMessage({ type: 'getModels' });
        })();
    </script>
</body>
</html>`;
}