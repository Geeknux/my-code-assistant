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

        /* Autocomplete Dropdown Styles */
        .autocomplete-dropdown {
            position: absolute;
            bottom: 100%;
            left: 0;
            right: 0;
            max-height: 200px;
            overflow-y: auto;
            background-color: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 4px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            display: none;
            margin-bottom: 4px;
        }

        .autocomplete-dropdown.visible {
            display: block;
        }

        .autocomplete-item {
            padding: 8px 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .autocomplete-item:last-child {
            border-bottom: none;
        }

        .autocomplete-item:hover,
        .autocomplete-item.selected {
            background-color: var(--vscode-list-hoverBackground);
        }

        .autocomplete-item .icon {
            flex-shrink: 0;
            font-size: 14px;
        }

        .autocomplete-item .path {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .autocomplete-dropdown::-webkit-scrollbar {
            width: 8px;
        }

        .autocomplete-dropdown::-webkit-scrollbar-track {
            background: var(--vscode-scrollbarSlider-background);
        }

        .autocomplete-dropdown::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-hoverBackground);
            border-radius: 4px;
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

    <!-- Model Selection Bar -->
    <div class="model-selection">
        <div class="model-status">
            <div class="status-indicator" id="connectionStatus"></div>
            <span id="connectionText">Checking Ollama connection...</span>
            <button class="refresh-models-btn" id="refreshModels">🔄 Refresh</button>
        </div>
        <select class="model-dropdown" id="modelSelect">
            <option value="">No AI model (commands only)</option>
        </select>
        <div class="model-info" id="modelInfo"></div>
        <div class="error-message" id="modelError" style="display: none;"></div>
    </div>

    <!-- Unified Chat Output -->
    <div class="output-area" id="chatOutput">
        <div class="welcome-content">
            <strong>🤖 Welcome to My Code Assistant!</strong>
            
            <strong>📋 Available Commands:</strong>
            • <span class="command-example">@project</span> - Show project structure and directory tree
            • <span class="command-example">@directory &lt;path&gt;</span> - Show directory tree for specific path
            • <span class="command-example">@file &lt;path&gt;</span> - Show file content and metadata
            • <span class="command-example">@help</span> - Show detailed help and command reference
            
            <strong>💬 AI Chat:</strong>
            • Select a model above to enable AI conversations
            • Ask questions in natural language
            • Commands are automatically used as context for AI
            
            <strong>✨ Examples:</strong>
            <span class="command-example">@project</span>
            <span class="command-example">@file package.json</span>
            "What does this project do?"
            "Explain the extension.ts file"
            
            <strong>💡 Tips:</strong>
            • Use commands to gather context, then ask AI questions
            • Mix commands and questions in the same conversation
            • Press Ctrl+Enter to send
            
            Ready to assist! Type a command or question below.
        </div>
    </div>
    
    <!-- Unified Input Area -->
    <div class="input-container">
        <div class="help-text">
            <strong>💡 Tip:</strong> Type <span class="command-example">@project</span> for commands or ask questions in natural language
        </div>
        
        <div class="input-wrapper">
            <div class="autocomplete-dropdown" id="autocompleteDropdown"></div>
            <textarea 
                class="input-area" 
                id="chatInput" 
                placeholder="Type @project, @file, @directory, @help or ask a question..."
            ></textarea>
        </div>
        
        <div class="button-container">
            <button class="chat-button" id="chatButton">
                <span id="chatButtonText">Send</span>
            </button>
            <button class="cancel-button" id="cancelButton">Cancel</button>
            <button class="clear-button" id="clearChatButton">Clear</button>
            <span class="shortcut-hint">Ctrl+Enter to send</span>
        </div>
    </div>
    
    <script src="${markedUri}"></script>
    <script>
        (function() {
            const vscode = acquireVsCodeApi();  
            
            // Elements
            const chatOutput = document.getElementById('chatOutput');
            const chatInput = document.getElementById('chatInput');
            const chatButton = document.getElementById('chatButton');
            const clearChatButton = document.getElementById('clearChatButton');
            const cancelButton = document.getElementById('cancelButton');
            const chatButtonText = document.getElementById('chatButtonText');
            const modelSelect = document.getElementById('modelSelect');
            const modelInfo = document.getElementById('modelInfo');
            const modelError = document.getElementById('modelError');
            const connectionStatus = document.getElementById('connectionStatus');
            const connectionText = document.getElementById('connectionText');
            const refreshModels = document.getElementById('refreshModels');
            const autocompleteDropdown = document.getElementById('autocompleteDropdown');

            let commandContext = '';
            let chatHistory = [];
            let isProcessing = false;
            let autocompleteItems = [];
            let selectedAutocompleteIndex = -1;
            let autocompleteDebounceTimer = null;

            // State management
            const previousState = vscode.getState();
            if (previousState) {
                if (previousState.chatInputValue) chatInput.value = previousState.chatInputValue;
                if (previousState.chatHistory) {
                    chatHistory = previousState.chatHistory;
                    renderChatHistory();
                }
                if (previousState.commandContext) {
                    commandContext = previousState.commandContext;
                }
            }

            function saveState() {
                vscode.setState({
                    chatInputValue: chatInput.value,
                    chatHistory: chatHistory,
                    commandContext: commandContext
                });
            }

            function setButtonLoading(loading, loadingText = 'Processing...') {
                isProcessing = loading;
                chatButton.disabled = loading;
                
                if (loading) {
                    chatButtonText.innerHTML = '<div class="loading"><div class="spinner"></div>' + loadingText + '</div>';
                    cancelButton.classList.add('active');
                } else {
                    chatButtonText.textContent = 'Send';
                    cancelButton.classList.remove('active');
                }
            }

            function sendMessage() {
                const message = chatInput.value.trim();
                if (!message || isProcessing) return;

                // Check if message contains commands
                const hasCommands = message.includes('@project') || message.includes('@file') || message.includes('@directory') || message.includes('@help') || message.includes('@explain') || message.includes('@refactor') || message.includes('@test') || message.includes('@document') || message.includes('@debug') || message.includes('@optimize');
                
                // Detect action type for specialized AI prompts
                const actionType = detectActionType(message);
                
                if (hasCommands) {
                    // Execute commands and prepare for AI analysis
                    chatHistory.push({
                        id: Date.now(),
                        type: 'user',
                        content: message,
                        timestamp: new Date().toLocaleTimeString()
                    });
                    renderChatHistory();
                    
                    // Store the original command for AI analysis
                    const selectedModel = modelSelect.value;
                    if (selectedModel) {
                        // Mark that we should auto-analyze the result
                        vscode.setState({
                            ...vscode.getState(),
                            pendingAutoAnalysis: true,
                            originalCommand: message,
                            actionType: actionType
                        });
                    }
                    
                    vscode.postMessage({
                        type: 'command',
                        value: message
                    });
                    
                    const loadingText = actionType ? \`Analyzing (\${actionType})...\` : (selectedModel ? 'Executing & analyzing...' : 'Executing...');
                    setButtonLoading(true, loadingText);
                } else {
                    // Send to AI
                    const selectedModel = modelSelect.value;
                    if (!selectedModel) {
                        // No model selected, just show message
                        chatHistory.push({
                            id: Date.now(),
                            type: 'assistant',
                            content: '⚠️ No AI model selected. Please select a model above to enable AI chat, or use commands like @project, @file, @directory.',
                            timestamp: new Date().toLocaleTimeString()
                        });
                        renderChatHistory();
                        chatInput.value = '';
                        saveState();
                        return;
                    }
                    
                    chatHistory.push({
                        id: Date.now(),
                        type: 'user',
                        content: message,
                        timestamp: new Date().toLocaleTimeString()
                    });
                    renderChatHistory();
                    
                    // Use command context if available
                    vscode.postMessage({
                        type: 'chatWithModel',
                        prompt: message,
                        context: commandContext,
                        actionType: actionType
                    });
                    
                    setButtonLoading(true, 'Thinking...');
                }
                
                chatInput.value = '';
                saveState();
            }

            function renderChatHistory() {
                if (chatHistory.length === 0) {
                    chatOutput.innerHTML = '<div class="welcome-content">' +
                        '<strong>&#x1F916; Welcome to My Code Assistant!</strong>' +
                        '<strong>&#x1F4CB; Available Commands:</strong>' +
                        '&#x2022; <span class="command-example">@project</span> - Show project structure<br>' +
                        '&#x2022; <span class="command-example">@directory &lt;path&gt;</span> - Show directory tree<br>' +
                        '&#x2022; <span class="command-example">@file &lt;path&gt;</span> - Show file content<br>' +
                        '&#x2022; <span class="command-example">@explain &lt;path&gt;</span> - Explain code<br>' +
                        '&#x2022; <span class="command-example">@refactor &lt;path&gt;</span> - Refactor suggestions<br>' +
                        '&#x2022; <span class="command-example">@test &lt;path&gt;</span> - Generate tests<br>' +
                        '<strong>&#x1F4AC; AI Chat:</strong>' +
                        '&#x2022; Select a model above to enable AI<br>' +
                        '&#x2022; Ask questions in natural language<br>' +
                        'Ready to assist! Type a command or question below.' +
                        '</div>';
                    return;
                }

                chatOutput.innerHTML = chatHistory.map(function(msg) {
                    var header = msg.type === 'user' ? 'You' : msg.type === 'system' ? '&#x1F4CB; System' : '&#x1F916; Assistant';
                    var body = msg.type === 'system' ? '<pre>' + msg.content + '</pre>' : marked.parse(msg.content);
                    return '<div class="chat-message ' + msg.type + '" id="msg-' + msg.id + '">' +
                        '<div class="message-header">' + header + ' &bull; ' + msg.timestamp + '</div>' +
                        '<div class="message-content">' + body + '</div>' +
                        '</div>';
                }).join('');
                
                chatOutput.scrollTop = chatOutput.scrollHeight;
            }

            // Autocomplete Functions
            function detectActionType(message) {
                if (message.includes('@explain')) return 'explain';
                if (message.includes('@refactor')) return 'refactor';
                if (message.includes('@test')) return 'test';
                if (message.includes('@document')) return 'document';
                if (message.includes('@debug')) return 'debug';
                if (message.includes('@optimize')) return 'optimize';
                return null;
            }

            function handleChatInputChange() {
                clearTimeout(autocompleteDebounceTimer);
                
                autocompleteDebounceTimer = setTimeout(() => {
                    const text = chatInput.value;
                    const cursorPos = chatInput.selectionStart;

        // Get the current line
        const textBeforeCursor = text.substring(0, cursorPos);
        const lines = textBeforeCursor.split('\\n');
        const currentLine = lines[lines.length - 1];

        // Check if we're typing a command that needs path autocomplete
        const fileMatch = currentLine.match(/@file\s+(.*)$/);
        const dirMatch = currentLine.match(/@directory\s+(.*)$/);
        const explainMatch = currentLine.match(/@explain\s+(.*)$/);
        const refactorMatch = currentLine.match(/@refactor\s+(.*)$/);
        const testMatch = currentLine.match(/@test\s+(.*)$/);
        const documentMatch = currentLine.match(/@document\s+(.*)$/);
        const debugMatch = currentLine.match(/@debug\s+(.*)$/);
        const optimizeMatch = currentLine.match(/@optimize\s+(.*)$/);

        if (fileMatch) {
            requestAutocomplete('@file', fileMatch[1]);
        } else if (dirMatch) {
            requestAutocomplete('@directory', dirMatch[1]);
        } else if (explainMatch) {
            requestAutocomplete('@file', explainMatch[1]);
        } else if (refactorMatch) {
            requestAutocomplete('@file', refactorMatch[1]);
        } else if (testMatch) {
            requestAutocomplete('@file', testMatch[1]);
        } else if (documentMatch) {
            requestAutocomplete('@file', documentMatch[1]);
        } else if (debugMatch) {
            requestAutocomplete('@file', debugMatch[1]);
        } else if (optimizeMatch) {
            requestAutocomplete('@file', optimizeMatch[1]);
        } else {
            hideAutocomplete();
        }
    }, 300);
}

function requestAutocomplete(command, partialPath) {
    vscode.postMessage({
        type: 'autocomplete',
        command: command,
        partialPath: partialPath || ''
    });
}

function handleAutocompleteResults(items) {
    autocompleteItems = items || [];
    selectedAutocompleteIndex = -1;

    if (autocompleteItems.length === 0) {
        hideAutocomplete();
        return;
    }

    showAutocomplete();
}

function showAutocomplete() {
    if (autocompleteItems.length === 0) return;

    autocompleteDropdown.innerHTML = autocompleteItems.map(function(item, index) {
        return '<div class="autocomplete-item" data-index="' + index + '">' +
            '<span class="icon">' + item.icon + '</span>' +
            '<span class="path">' + item.path + '</span>' +
            '</div>';
    }).join('');
                
                // Add click handlers
                autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach((elem, index) => {
                    elem.addEventListener('click', () => {
                        selectAutocompleteItem(index);
                    });
                });
                
                autocompleteDropdown.classList.add('visible');
            }

            function hideAutocomplete() {
                autocompleteDropdown.classList.remove('visible');
                autocompleteItems = [];
                selectedAutocompleteIndex = -1;
            }

            function handleAutocompleteKeydown(e) {
                if (!autocompleteDropdown.classList.contains('visible')) {
                    return false;
                }
                
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    selectedAutocompleteIndex = Math.min(
                        selectedAutocompleteIndex + 1,
                        autocompleteItems.length - 1
                    );
                    updateAutocompleteSelection();
                    return true;
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    selectedAutocompleteIndex = Math.max(selectedAutocompleteIndex - 1, 0);
                    updateAutocompleteSelection();
                    return true;
                } else if (e.key === 'Enter' && selectedAutocompleteIndex >= 0) {
                    e.preventDefault();
                    selectAutocompleteItem(selectedAutocompleteIndex);
                    return true;
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    hideAutocomplete();
                    return true;
                }
                
                return false;
            }

            function updateAutocompleteSelection() {
                const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');
                items.forEach((item, index) => {
                    if (index === selectedAutocompleteIndex) {
                        item.classList.add('selected');
                        item.scrollIntoView({ block: 'nearest' });
                    } else {
                        item.classList.remove('selected');
                    }
                });
            }

            function selectAutocompleteItem(index) {
                if (index < 0 || index >= autocompleteItems.length) return;
                
                const selectedItem = autocompleteItems[index];
                const text = chatInput.value;
                const cursorPos = chatInput.selectionStart;

        // Get the current line
        const textBeforeCursor = text.substring(0, cursorPos);
        const textAfterCursor = text.substring(cursorPos);
        const lines = textBeforeCursor.split('\\n');
        const currentLine = lines[lines.length - 1];
        
        // Replace the partial path with the selected path
        let newLine = currentLine;
        if (currentLine.includes('@file')) {
            newLine = '@file ' + selectedItem.path;
        } else if (currentLine.includes('@directory')) {
            newLine = '@directory ' + selectedItem.path;
        } else if (currentLine.includes('@explain')) {
            newLine = '@explain ' + selectedItem.path;
        } else if (currentLine.includes('@refactor')) {
            newLine = '@refactor ' + selectedItem.path;
        } else if (currentLine.includes('@test')) {
            newLine = '@test ' + selectedItem.path;
        } else if (currentLine.includes('@document')) {
            newLine = '@document ' + selectedItem.path;
        } else if (currentLine.includes('@debug')) {
            newLine = '@debug ' + selectedItem.path;
        } else if (currentLine.includes('@optimize')) {
            newLine = '@optimize ' + selectedItem.path;
        }
        
        // Reconstruct the text
        lines[lines.length - 1] = newLine;
        const newText = lines.join('\\n') + textAfterCursor;
        
        chatInput.value = newText;
        chatInput.selectionStart = chatInput.selectionEnd = lines.join('\\n').length;
        
        hideAutocomplete();
        chatInput.focus();
        saveState();
                
                chatInput.value = newText;
                chatInput.selectionStart = chatInput.selectionEnd = lines.join('\\n').length;
                
                hideAutocomplete();
                chatInput.focus();
                saveState();
            }

            // Close autocomplete when clicking outside
            document.addEventListener('click', (e) => {
                if (!chatInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
                    hideAutocomplete();
                }
            });

            // Event listeners
            chatButton.addEventListener('click', sendMessage);

            clearChatButton.addEventListener('click', () => {
                chatHistory = [];
                commandContext = '';
                renderChatHistory();
                chatInput.focus();
                saveState();
            });

            cancelButton.addEventListener('click', () => {
                vscode.postMessage({ type: 'cancelRequest' });
                setButtonLoading(false);
            });

            chatInput.addEventListener('keydown', (e) => {
                if (handleAutocompleteKeydown(e)) {
                    return;
                }
                if (e.ctrlKey && e.key === 'Enter') {
                    e.preventDefault();
                    sendMessage();
                }
                setTimeout(saveState, 100);
            });

            chatInput.addEventListener('input', () => {
                handleChatInputChange();
                saveState();
            });

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
                        // Command result - add to chat as system message
                        chatHistory.push({
                            id: Date.now(),
                            type: 'system',
                            content: message.value,
                            timestamp: new Date().toLocaleTimeString()
                        });
                        renderChatHistory();
                        
                        // Update command context for AI
                        if (message.context) {
                            commandContext = message.context;
                        }
                        
                        // Check if we should auto-analyze with AI
                        const state = vscode.getState();
                        const selectedModel = modelSelect.value;
                        
                        if (state?.pendingAutoAnalysis && selectedModel) {
                            // Clear the pending flag
                            vscode.setState({
                                ...state,
                                pendingAutoAnalysis: false
                            });
                            
                            const pendingActionType = state.actionType || null;
                            const analysisPrompt = state.originalCommand || 'Analyze this code';
                            const loadingLabel = pendingActionType ? 'AI ' + pendingActionType + 'ing...' : 'AI analyzing...';
                            
                            chatHistory.push({
                                id: Date.now() + 1,
                                type: 'user',
                                content: pendingActionType ? ('🎯 Running @' + pendingActionType + '...') : '🤖 Analyzing result...',
                                timestamp: new Date().toLocaleTimeString()
                            });
                            renderChatHistory();
                            
                            vscode.postMessage({
                                type: 'chatWithModel',
                                prompt: analysisPrompt,
                                context: message.context,
                                actionType: pendingActionType
                            });
                            
                            setButtonLoading(true, loadingLabel);
                        } else {
                            setButtonLoading(false);
                            chatInput.focus();
                        }
                        
                        saveState();
                        break;

                    case 'modelsLoaded':
                        connectionStatus.classList.add('connected');
                        connectionText.textContent = \`Connected • \${message.models.length} models available\`;
                        modelError.style.display = 'none';
                        
                        modelSelect.innerHTML = '<option value="">No AI model (commands only)</option>';
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
                            setButtonLoading(false);
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
                        setButtonLoading(false);
                        chatInput.focus();
                        saveState();
                        break;

                    case 'autocompleteResults':
                        handleAutocompleteResults(message.items);
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