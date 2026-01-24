import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

interface OllamaModel {
    name: string;
    model: string;
    modified_at: string;
    size: number;
    digest: string;
    details: {
        parent_model: string;
        format: string;
        family: string;
        families: string[];
        parameter_size: string;
        quantization_level: string;
    };
}

interface OllamaResponse {
    models: OllamaModel[];
}


function makeHttpRequest(url: string, options: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;
        console.log("is http:" + isHttps);
        console.log("Client:" + client)

        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const req = client.request(requestOptions, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(data));
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    }
                } catch (error) {
                    reject(new Error(`Failed to parse JSON: ${error}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (options.body) {
            req.write(JSON.stringify(options.body));
        }

        req.end();
    });
}

let extensionUri: vscode.Uri;

export function activate(context: vscode.ExtensionContext) {
    console.log('My Code Assistant extension is now active!');
    
    const provider = new MyCodeAssistantProvider(context.extensionUri);
    
    const disposable = vscode.window.registerWebviewViewProvider(
        'myCodeAssistant',
        provider,
        {
            webviewOptions: {
                retainContextWhenHidden: true
            }
        }
    );
    
    context.subscriptions.push(disposable);
    
    const refreshCommand = vscode.commands.registerCommand('myCodeAssistant.refresh', () => {
        provider.refresh();
    });
    
    context.subscriptions.push(refreshCommand);

    extensionUri = context.extensionUri;

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
        'myView',
        new MyCodeAssistantProvider(extensionUri)
        )
    );
}

class MyCodeAssistantProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'myCodeAssistant';

    private _view?: vscode.WebviewView;
    private markedUri?: vscode.Uri;
    
    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri,
                vscode.Uri.joinPath(this._extensionUri, 'media')
            ]
        };

        this.markedUri = webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'marked.min.js')
        );

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview, this.markedUri);

        webviewView.webview.onDidReceiveMessage(
            async message => {
                switch (message.type) {
                    case 'command':
                        await this.handleCommand(message.value);
                        return;
                    case 'getModels':
                        await this.getOllamaModels();
                        return;
                    case 'selectModel':
                        await this.selectModel(message.value);
                        return;
                    case 'chatWithModel':
                        await this.chatWithModel(message.prompt, message.context);
                        return;
                }
            },
            undefined,
            []
        );

        // Load models on startup
        this.getOllamaModels();
    }

    public refresh() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview, this.markedUri);
            this.getOllamaModels();
        }
    }

    private async getMarked(): Promise<string> {
        const markedJsPath = vscode.Uri.joinPath(this._extensionUri, 'node_modules', 'marked', 'lib', 'marked.umd.js');
        const markedJsData = await vscode.workspace.fs.readFile(markedJsPath);
        const markedJsScript = Buffer.from(markedJsData).toString('utf-8');

        return markedJsScript;
    }

    private async getOllamaModels() {
        try {
            const config = vscode.workspace.getConfiguration('myCodeAssistant');
            const ollamaUrl = config.get<string>('ollamaUrl', 'http://localhost:11434');
            
            const data = await makeHttpRequest(`${ollamaUrl}/api/tags`) as OllamaResponse;
            console.log(data)
            this._view?.webview.postMessage({
                type: 'modelsLoaded',
                models: data.models.map(model => ({
                    name: model.name,
                    size: this.formatBytes(model.size),
                    family: model.details.family,
                    parameterSize: model.details.parameter_size,
                    quantization: model.details.quantization_level
                }))
            });

        } catch (error) {
            this._view?.webview.postMessage({
                type: 'modelsError',
                error: `Failed to load Ollama models: ${error}`
            });
        }
    }

    private async selectModel(modelName: string) {
        const config = vscode.workspace.getConfiguration('myCodeAssistant');
        await config.update('selectedModel', modelName, vscode.ConfigurationTarget.Global);
        
        this._view?.webview.postMessage({
            type: 'modelSelected',
            model: modelName
        });
    }

    private async chatWithModel(prompt: string, context?: string) {
        try {
            const config = vscode.workspace.getConfiguration('myCodeAssistant');
            const ollamaUrl = config.get<string>('ollamaUrl', 'http://localhost:11434');
            const selectedModel = config.get<string>('selectedModel', '');

            if (!selectedModel) {
                this._view?.webview.postMessage({
                    type: 'chatError',
                    error: 'No model selected. Please select a model first.'
                });
                return;
            }

            // Prepare the full prompt with context if provided
            let fullPrompt = prompt;
            if (context) {
                fullPrompt = `Context:\n${context}\n\nQuestion: ${prompt}`;
            }

            const requestBody = {
                model: selectedModel,
                prompt: fullPrompt,
                stream: true
            };

        //    const data = await makeHttpRequest(`${ollamaUrl}/api/generate`, {
        //         method: 'POST',
        //         headers: {
        //             'Content-Type': 'application/json',
        //         },
        //         body: requestBody
        //     });
            
        //     this._view?.webview.postMessage({
        //         type: 'chatResponse',
        //         response: data.response,
        //         model: selectedModel,
        //         prompt: prompt
        //     });

        const response = await fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
                body: JSON.stringify(requestBody)
        });

        if (!response.body) {
            throw new Error('ReadableStream not supported.');
        }

        // ایجاد خواننده برای استریم
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
                break;
            }
            
            // دیکد کردن تکه‌های دریافتی
            const chunk = decoder.decode(value, { stream: true });
            
            // داده‌های دریافتی از Ollama معمولاً به صورت JSON‌های جداگانه در هر خط هستند
            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            
            for (const line of lines) {
                try {
                    const parsedData = JSON.parse(line);
                    console.log(parsedData.response);
                    // ارسال هر تکه پاسخ به سمت UI (Webview)
                    this._view?.webview.postMessage({
                        type: 'chatResponse',
                        response: parsedData.response, // این بخش تکه‌تکه متن است
                        model: selectedModel,
                        prompt: prompt,
                        done: parsedData.done // برای اطلاع از پایان پاسخ
                    });
                } catch (e) {
                    console.error('Error parsing JSON chunk', e);
                }
            }
        }

        } catch (error) {
            this._view?.webview.postMessage({
                type: 'chatError',
                error: `Failed to chat with model: ${error}`
            });
        }
    }

    private async handleCommand(input: string) {
        const lines = input.split('\n').filter(line => line.trim());
        let output = '';
        let context = '';

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('@')) {
                try {
                    const result = await this.executeCommand(trimmedLine);
                    output += result + '\n\n';
                    context += result + '\n\n'; // Add to context for potential AI usage
                } catch (error) {
                    output += `Error: ${error}\n\n`;
                }
            } else if (trimmedLine) {
                output += `Text: ${trimmedLine}\n\n`;
            }
        }

        if (!output.trim()) {
            output = 'No valid commands found. Commands must start with @';
        }

        this._view?.webview.postMessage({ 
            type: 'result', 
            value: output.trim(),
            context: context.trim()
        });
    }

    private async executeCommand(command: string): Promise<string> {
        const parts = command.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);

        switch (cmd) {
            case '@project':
                return this.getProjectInfo();
            
            case '@directory':
                const dirPath = args.join(' ');
                return this.getDirectoryInfo(dirPath);
            
            case '@file':
                const filePath = args.join(' ');
                return this.getFileContent(filePath);
            
            default:
                return `Unknown command: ${cmd}\n\nAvailable commands:\n• @project - Show project info and directory tree\n• @directory <path> - Show directory tree for specific path\n• @file <path> - Show file content`;
        }
    }

    private getProjectInfo(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return 'No workspace folder found. Please open a folder or workspace.';
        }

        let result = '';
        workspaceFolders.forEach((folder, index) => {
            if (index > 0) result += '\n' + '='.repeat(60) + '\n\n';
            result += `📁 Project: ${folder.name}\n`;
            result += `📍 Path: ${folder.uri.fsPath}\n\n`;
            result += '🌳 Directory Tree (3 levels deep):\n';
            result += '─'.repeat(40) + '\n';
            result += this.getDirectoryTree(folder.uri.fsPath, 0, 3);
        });

        return result;
    }

    private getDirectoryInfo(dirPath: string): string {
        if (!dirPath) {
            return 'Please provide a directory path.\n\nUsage: @directory <path>\n\nExamples:\n• @directory src\n• @directory ./components\n• @directory /absolute/path/to/folder';
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        let fullPath = dirPath;
        
        if (workspaceFolder && !path.isAbsolute(dirPath)) {
            fullPath = path.join(workspaceFolder.uri.fsPath, dirPath);
        }

        if (!fs.existsSync(fullPath)) {
            return `❌ Directory not found: ${dirPath}\n\nMake sure the path exists and is accessible.`;
        }

        const stats = fs.lstatSync(fullPath);
        if (!stats.isDirectory()) {
            return `❌ Path is not a directory: ${dirPath}\n\nThe specified path points to a file, not a directory.`;
        }

        let result = `📁 Directory: ${dirPath}\n`;
        result += `📍 Full Path: ${fullPath}\n\n`;
        result += '🌳 Directory Tree (3 levels deep):\n';
        result += '─'.repeat(40) + '\n';
        result += this.getDirectoryTree(fullPath, 0, 3);

        return result;
    }

    private getFileContent(filePath: string): string {
        if (!filePath) {
            return 'Please provide a file path.\n\nUsage: @file <path>\n\nExamples:\n• @file package.json\n• @file src/extension.ts\n• @file ./README.md';
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        let fullPath = filePath;
        
        if (workspaceFolder && !path.isAbsolute(filePath)) {
            fullPath = path.join(workspaceFolder.uri.fsPath, filePath);
        }

        if (!fs.existsSync(fullPath)) {
            return `❌ File not found: ${filePath}\n\nMake sure the file exists and the path is correct.`;
        }

        const stats = fs.lstatSync(fullPath);
        if (!stats.isFile()) {
            return `❌ Path is not a file: ${filePath}\n\nThe specified path points to a directory, not a file.`;
        }

        try {
            if (stats.size > 1024 * 1024) {
                return `❌ File too large: ${filePath}\n\nFile size: ${(stats.size / 1024 / 1024).toFixed(2)} MB\n\nFiles larger than 1MB are not displayed for performance reasons.`;
            }

            const content = fs.readFileSync(fullPath, 'utf8');
            const fileExtension = path.extname(fullPath);
            
            let result = `📄 File: ${filePath}\n`;
            result += `📍 Full Path: ${fullPath}\n`;
            result += `📊 Size: ${this.formatBytes(stats.size)}\n`;
            result += `📅 Modified: ${stats.mtime.toLocaleString()}\n`;
            result += `🏷️  Type: ${fileExtension || 'no extension'}\n\n`;
            result += '📝 Content:\n';
            result += '─'.repeat(50) + '\n';
            result += content;
            
            if (!content.endsWith('\n')) {
                result += '\n';
            }
            result += '─'.repeat(50);

            return result;
        } catch (error) {
            return `❌ Error reading file: ${filePath}\n\nError details: ${error}`;
        }
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    private getDirectoryTree(dirPath: string, currentLevel: number, maxLevel: number): string {
        if (currentLevel >= maxLevel) {
            return '';
        }

        let result = '';
        const indent = '  '.repeat(currentLevel);

        try {
            const items = fs.readdirSync(dirPath);
            
            const filteredItems = items
			.filter(item => {
                if (item.startsWith('.') && !['.vscode', '.env', '.gitignore'].includes(item)) {
                    return false;
                }
                if (['node_modules', 'dist', 'build', 'out', '.git'].includes(item)) {
                    return false;
                }
                return true;
            });

            filteredItems.sort((a, b) => {
                const aPath = path.join(dirPath, a);
                const bPath = path.join(dirPath, b);
                
                try {
                    const aIsDir = fs.statSync(aPath).isDirectory();
                    const bIsDir = fs.statSync(bPath).isDirectory();
                    
                    if (aIsDir && !bIsDir) return -1;
                    if (!aIsDir && bIsDir) return 1;
                    return a.localeCompare(b, undefined, { numeric: true });
                } catch {
                    return a.localeCompare(b);
                }
            });

            for (let i = 0; i < filteredItems.length; i++) {
                const item = filteredItems[i];
                const itemPath = path.join(dirPath, item);
                
                try {
                    const stats = fs.statSync(itemPath);
                    const isLast = i === filteredItems.length - 1;
                    const prefix = currentLevel === 0 ? '' : (isLast ? '└─ ' : '├─ ');

                    if (stats.isDirectory()) {
                        result += `${indent}${prefix}📁 ${item}/\n`;
                        const newIndent = currentLevel === 0 ? '' : (isLast ? '   ' : '│  ');
                        const childResult = this.getDirectoryTree(itemPath, currentLevel + 1, maxLevel);
                        if (childResult) {
                            const adjustedChild = childResult.split('\n')
                                .map(line => line ? indent + newIndent + line.slice(indent.length) : line)
                                .join('\n');
                            result += adjustedChild;
                        }
                    } else {
                        const icon = this.getFileIcon(item);
                        const size = this.formatBytes(stats.size);
                        result += `${indent}${prefix}${icon} ${item} (${size})\n`;
                    }
                } catch (error) {
                    result += `${indent}❌ ${item} (access denied)\n`;
                }
            }

            if (filteredItems.length === 0) {
                result += `${indent}📭 (empty directory)\n`;
            }

        } catch (error) {
            result += `${indent}❌ Error reading directory: ${error}\n`;
        }

        return result;
    }

    private getFileIcon(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        const name = path.basename(fileName).toLowerCase();
        
        const specialFiles: { [key: string]: string } = {
            'package.json': '📦',
            'readme.md': '📖',
            'license': '📜',
            'dockerfile': '🐳',
            '.gitignore': '🚫',
            '.env': '🔐',
            'tsconfig.json': '⚙️',
        };

        if (specialFiles[name]) {
            return specialFiles[name];
        }

        const iconMap: { [key: string]: string } = {
            '.js': '🟨',
            '.ts': '🟦',
            '.jsx': '⚛️',
            '.tsx': '⚛️',
            '.vue': '💚',
            '.json': '📋',
            '.md': '📝',
            '.txt': '📄',
            '.html': '🌐',
            '.css': '🎨',
            '.scss': '🎨',
            '.less': '🎨',
            '.png': '🖼️',
            '.jpg': '🖼️',
            '.jpeg': '🖼️',
            '.gif': '🖼️',
            '.svg': '🖼️',
            '.ico': '🖼️',
            '.pdf': '📕',
            '.zip': '📦',
            '.tar': '📦',
            '.gz': '📦',
            '.py': '🐍',
            '.java': '☕',
            '.cpp': '⚙️',
            '.c': '⚙️',
            '.php': '🐘',
            '.rb': '💎',
            '.go': '🐹',
            '.rs': '🦀',
            '.xml': '📄',
            '.yaml': '📄',
            '.yml': '📄',
            '.sh': '⚡',
            '.bat': '⚡',
            '.exe': '⚙️',
            '.dll': '⚙️'
        };
        
        return iconMap[ext] || '📄';
    }

    private _getHtmlForWebview(webview: vscode.Webview, markedUri?: vscode.Uri) {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>My Code Assistant</title>
                <style>
                    * {
                        box-sizing: border-box;
                    }
                    
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
                        margin-bottom: 5px;
                        padding: 8px;
                        border-radius: 6px;
                        max-width: 85%;
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
                        line-height: 1.1;
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
                    }
                    
                    .submit-button, .chat-button, .clear-button {
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
                    
                    .clear-button {
                        background-color: transparent;
                        color: var(--vscode-button-secondaryForeground);
                        border: 1px solid var(--vscode-button-border);
                    }
                    
                    .clear-button:hover {
                        background-color: var(--vscode-button-secondaryHoverBackground);
                    }
                    
                    .shortcut-hint {
                        font-size: 10px;
                        color: var(--vscode-descriptionForeground);
                        margin-left: auto;
                        font-style: italic;
                    }
                    
                    .welcome-content {
                        color: var(--vscode-descriptionForeground);
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
                        margin-bottom: 8px;
                        font-size: 12px;
                    }

                    .context-toggle input[type="checkbox"] {
                        margin: 0;
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

                    /* استایل برای کدهای برنامه‌نویسی */
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
                        line-height: 1.5;
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
                            <span class="command-example">@directory ./components</span>
                            <span class="command-example">@file package.json</span>
                            <span class="command-example">@file src/extension.ts</span>
                            
                            <strong>Tips:</strong>
                            • You can run multiple commands at once (one per line)
                            • Use relative paths from your workspace root
                            • Press Ctrl+Enter to quickly submit commands
                            • Commands are case-sensitive and must start with @
                            
                            Ready to assist! Enter a command below to get started.
                        </div>
                    </div>
                    
                    <div class="input-container">
                        <div class="help-text">
                            <strong>Quick Start:</strong> Type <span class="command-example">@project</span> to explore your workspace, or <span class="command-example">@file README.md</span> to view a specific file.
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
                            • Use command output as context for AI conversations
                            
                            <strong>Tips:</strong>
                            • Run commands in the Commands tab first to gather context
                            • Enable "Use command context" to include recent command output
                            • The AI will have knowledge of your project structure when context is provided
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
                            <button class="clear-button" id="clearChatButton">Clear Chat</button>
                            <span class="shortcut-hint">Ctrl+Enter to send</span>
                        </div>
                    </div>
                </div>
                <script src="${markedUri}"></script>
                <script>
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

                    // Tab switching
                    tabs.forEach(tab => {
                        tab.addEventListener('click', () => {
                            const targetTab = tab.dataset.tab;
                            
                            tabs.forEach(t => t.classList.remove('active'));
                            tabContents.forEach(tc => tc.classList.remove('active'));
                            
                            tab.classList.add('active');
                            document.getElementById(targetTab + '-tab').classList.add('active');
                            
                            // Save current tab
                            vscode.setState({
                                ...vscode.getState(),
                                activeTab: targetTab
                            });
                        });
                    });

                    // Restore state
                    const previousState = vscode.getState();
                    if (previousState) {
                        if (previousState.commandInputValue) {
                            commandInput.value = previousState.commandInputValue;
                        }
                        if (previousState.chatInputValue) {
                            chatInput.value = previousState.chatInputValue;
                        }
                        if (previousState.outputValue) {
                            output.innerHTML = previousState.outputValue;
                        }
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
                            if (activeTabButton) {
                                activeTabButton.click();
                            }
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
                        button.disabled = loading;
                        if (loading) {
                            textElement.innerHTML = '<div class="loading"><div class="spinner"></div>' + loadingText + '</div>';
                        } else {
                            textElement.textContent = button === submitButton ? 'Execute Commands' : 'Send Message';
                        }
                    }

                    function executeCommands() {
                        const command = commandInput.value.trim();
                        if (!command) {
                            return;
                        }

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
                        if (!message) {
                            return;
                        }

                        const selectedModel = modelSelect.value;
                        if (!selectedModel) {
                            alert('Please select a model first');
                            return;
                        }

                        // Add user message to chat
                        chatHistory.push({
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
                                
                                Select an Ollama model above to start chatting. You can:
                                • Ask questions about your code
                                • Get explanations for files and directories  
                                • Request code analysis and suggestions
                                • Use command output as context for AI conversations
                                
                                <strong>Tips:</strong>
                                • Run commands in the Commands tab first to gather context
                                • Enable "Use command context" to include recent command output
                                • The AI will have knowledge of your project structure when context is provided
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
                        output.innerHTML = \`<div class="welcome-content">
                            Output cleared. Enter a command to get started.
                        </div>\`;
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

                    // Handle messages from the extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        
                        switch (message.type) {
                            case 'result':
                                output.textContent = message.value;
                                output.scrollTop = output.scrollHeight;
                                setButtonLoading(submitButton, buttonText, false);
                                commandInput.value = '';
                                
                                // Store context for potential AI usage
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
                                    saveState(); // ذخیره تاریخچه چت پس از اتمام پاسخ
                                    setButtonLoading(chatButton, chatButtonText, false); // اگر دکمه‌ای برای ارسال دارید
                                    break;
                                }
                                if (lastMessage && lastMessage.type !== 'user') {
                                        lastMessage.content += responseText;
                                        const messageElement = document.getElementById(\`msg-\${lastMessage.id}\`);
                                        if (messageElement) {
                                            const contentDiv = messageElement.querySelector('.message-content');
                                            if (contentDiv) {
                                                //contentDiv.textContent += responseText;
                                                // تبدیل کل متن فعلی به HTML و جایگزینی
                                                contentDiv.innerHTML = marked.parse(lastMessage.content);
                                                
                                                // اسکرول به پایین
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

                    // Focus appropriate input based on active tab
                    const activeTab = document.querySelector('.tab.active').dataset.tab;
                    if (activeTab === 'commands') {
                        commandInput.focus();
                    } else {
                        chatInput.focus();
                    }

                    // Request models on load
                    vscode.postMessage({ type: 'getModels' });
                </script>
            </body>
            </html>`;
    }
}

export function deactivate() {}