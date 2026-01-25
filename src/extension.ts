import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getWebviewContent } from './webview';

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

interface OllamaGenerateRequest {
    model: string;
    prompt: string;
    stream: boolean;
}

interface OllamaGenerateResponse {
    response: string;
    done: boolean;
}

/**
 * Rate limiter to prevent API request overload
 */
class RateLimiter {
    private requests: number[] = [];
    private maxRequests: number;
    private timeWindow: number;

    constructor(maxRequests: number = 10, timeWindowMs: number = 1000) {
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindowMs;
    }

    async waitForSlot(): Promise<void> {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < this.timeWindow);

        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = this.timeWindow - (now - oldestRequest);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.waitForSlot();
        }

        this.requests.push(now);
    }
}

/**
 * HTTP client with consistent async/await implementation and rate limiting
 */
class HttpClient {
    private rateLimiter = new RateLimiter(10, 1000);

    async request<T>(url: string, options: RequestInit = {}): Promise<T> {
        await this.rateLimiter.waitForSlot();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json() as T;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }

    async streamRequest(
        url: string,
        options: RequestInit,
        onChunk: (chunk: string) => void,
        signal?: AbortSignal
    ): Promise<void> {
        await this.rateLimiter.waitForSlot();

        try {
            const response = await fetch(url, {
                ...options,
                signal: signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            if (!response.body) {
                throw new Error('ReadableStream not supported');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    try {
                        onChunk(line);
                    } catch (error) {
                        console.error('Error processing chunk:', error);
                    }
                }
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Request aborted');
            }
            throw error;
        }
    }
}

/**
 * Path validator to prevent path traversal attacks
 */
class PathValidator {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = path.resolve(workspaceRoot);
    }

    validatePath(inputPath: string): { valid: boolean; fullPath: string; error?: string } {
        try {
            // Remove any path traversal attempts
            const sanitized = inputPath.replace(/\.\./g, '');
            
            // Resolve the full path
            let fullPath: string;
            if (path.isAbsolute(sanitized)) {
                fullPath = path.resolve(sanitized);
            } else {
                fullPath = path.resolve(this.workspaceRoot, sanitized);
            }

            // Ensure the path is within workspace
            if (!fullPath.startsWith(this.workspaceRoot)) {
                return {
                    valid: false,
                    fullPath: '',
                    error: 'Path is outside workspace boundaries'
                };
            }

            // Check if path exists
            if (!fs.existsSync(fullPath)) {
                return {
                    valid: false,
                    fullPath: '',
                    error: 'Path does not exist'
                };
            }

            return { valid: true, fullPath };
        } catch (error) {
            return {
                valid: false,
                fullPath: '',
                error: `Invalid path: ${error}`
            };
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('My Code Assistant extension is now active!');
    
    const provider = new MyCodeAssistantProvider(context.extensionUri);
    
    // Register webview provider
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
    
    // Register refresh command
    const refreshCommand = vscode.commands.registerCommand('myCodeAssistant.refresh', () => {
        provider.refresh();
    });
    
    context.subscriptions.push(refreshCommand);

    // Register configuration command
    const configureCommand = vscode.commands.registerCommand('myCodeAssistant.configure', async () => {
        const config = vscode.workspace.getConfiguration('myCodeAssistant');
        const currentUrl = config.get<string>('ollamaUrl', 'http://localhost:11434');

        const newUrl = await vscode.window.showInputBox({
            prompt: 'Enter Ollama Server URL',
            value: currentUrl,
            placeHolder: 'http://localhost:11434',
            validateInput: (value) => {
                try {
                    new URL(value);
                    return null;
                } catch {
                    return 'Please enter a valid URL';
                }
            }
        });

        if (newUrl) {
            await config.update('ollamaUrl', newUrl, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Ollama URL updated to: ${newUrl}`);
            provider.refresh();
        }
    });

    context.subscriptions.push(configureCommand);
}

class MyCodeAssistantProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'myCodeAssistant';

    private _view?: vscode.WebviewView;
    private markedUri?: vscode.Uri;
    private httpClient: HttpClient;
    private abortController?: AbortController;
    
    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) {
        this.httpClient = new HttpClient();
    }

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

        webviewView.webview.html = getWebviewContent(webviewView.webview, this.markedUri);

        webviewView.webview.onDidReceiveMessage(
            async message => {
                try {
                    switch (message.type) {
                        case 'command':
                            await this.handleCommand(message.value);
                            break;
                        case 'getModels':
                            await this.getOllamaModels();
                            break;
                        case 'selectModel':
                            await this.selectModel(message.value);
                            break;
                        case 'chatWithModel':
                            await this.chatWithModel(message.prompt, message.context);
                            break;
                        case 'cancelRequest':
                            this.cancelCurrentRequest();
                            break;
                        case 'autocomplete':
                            await this.handleAutocomplete(message.command, message.partialPath);
                            break;
                    }
                } catch (error) {
                    console.error('Error handling message:', error);
                    this._view?.webview.postMessage({
                        type: 'error',
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            },
            undefined,
            []
        );

        this.getOllamaModels();
    }

    public refresh() {
        if (this._view) {
            this._view.webview.html = getWebviewContent(this._view.webview, this.markedUri);
            this.getOllamaModels();
        }
    }

    private async handleAutocomplete(command: string, partialPath: string) {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                this._view?.webview.postMessage({
                    type: 'autocompleteResults',
                    command: command,
                    items: []
                });
                return;
            }

            const workspaceRoot = workspaceFolder.uri.fsPath;
            const isFileCommand = command === '@file';
            const isDirectoryCommand = command === '@directory';

            // Determine the directory to search in
            let searchDir = workspaceRoot;
            let searchPattern = partialPath.trim();

            if (searchPattern.includes('/') || searchPattern.includes('\\')) {
                // Has path separator - search in subdirectory
                const lastSeparator = Math.max(
                    searchPattern.lastIndexOf('/'),
                    searchPattern.lastIndexOf('\\')
                );
                const dirPart = searchPattern.substring(0, lastSeparator);
                searchPattern = searchPattern.substring(lastSeparator + 1);
                
                const testPath = path.join(workspaceRoot, dirPart);
                if (fs.existsSync(testPath) && fs.statSync(testPath).isDirectory()) {
                    searchDir = testPath;
                }
            }

            // Get items from directory
            const items = this.getAutocompleteItems(
                searchDir,
                workspaceRoot,
                searchPattern,
                isFileCommand,
                isDirectoryCommand
            );

            this._view?.webview.postMessage({
                type: 'autocompleteResults',
                command: command,
                items: items
            });

        } catch (error) {
            console.error('Autocomplete error:', error);
            this._view?.webview.postMessage({
                type: 'autocompleteResults',
                command: command,
                items: []
            });
        }
    }

    private getAutocompleteItems(
        searchDir: string,
        workspaceRoot: string,
        pattern: string,
        filesOnly: boolean,
        directoriesOnly: boolean
    ): Array<{ path: string; icon: string; type: string }> {
        try {
            if (!fs.existsSync(searchDir)) {
                return [];
            }

            const items = fs.readdirSync(searchDir);
            const results: Array<{ path: string; icon: string; type: string }> = [];

            for (const item of items) {
                // Skip hidden files and common excludes
                if (item.startsWith('.') && !['.vscode', '.env', '.gitignore'].includes(item)) {
                    continue;
                }
                if (['node_modules', 'dist', 'build', 'out', '.git'].includes(item)) {
                    continue;
                }

                const fullPath = path.join(searchDir, item);
                
                try {
                    const stats = fs.statSync(fullPath);
                    const isDirectory = stats.isDirectory();
                    const isFile = stats.isFile();

                    // Filter based on command type
                    if (filesOnly && !isFile) continue;
                    if (directoriesOnly && !isDirectory) continue;

                    // Filter based on pattern
                    if (pattern && !item.toLowerCase().includes(pattern.toLowerCase())) {
                        continue;
                    }

                    // Get relative path from workspace root
                    const relativePath = path.relative(workspaceRoot, fullPath);

                    results.push({
                        path: relativePath,
                        icon: isDirectory ? '📁' : this.getFileIcon(item),
                        type: isDirectory ? 'directory' : 'file'
                    });

                    // Limit results to prevent overwhelming the UI
                    if (results.length >= 50) break;

                } catch (error) {
                    // Skip items we can't access
                    continue;
                }
            }

            // Sort: directories first, then alphabetically
            results.sort((a, b) => {
                if (a.type === 'directory' && b.type !== 'directory') return -1;
                if (a.type !== 'directory' && b.type === 'directory') return 1;
                return a.path.localeCompare(b.path);
            });

            return results;

        } catch (error) {
            console.error('Error getting autocomplete items:', error);
            return [];
        }
    }

    private cancelCurrentRequest() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = undefined;
        }
    }

    private async getOllamaModels() {
        try {
            const config = vscode.workspace.getConfiguration('myCodeAssistant');
            const ollamaUrl = config.get<string>('ollamaUrl', 'http://localhost:11434');
            
            const data = await this.httpClient.request<OllamaResponse>(`${ollamaUrl}/api/tags`);
            
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
                error: `Failed to load Ollama models: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    private async selectModel(modelName: string) {
        try {
            const config = vscode.workspace.getConfiguration('myCodeAssistant');
            await config.update('selectedModel', modelName, vscode.ConfigurationTarget.Global);
            
            this._view?.webview.postMessage({
                type: 'modelSelected',
                model: modelName
            });
        } catch (error) {
            console.error('Error selecting model:', error);
        }
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

            let fullPrompt = prompt;
            if (context) {
                fullPrompt = `Context:\n${context}\n\nQuestion: ${prompt}`;
            }

            const requestBody: OllamaGenerateRequest = {
                model: selectedModel,
                prompt: fullPrompt,
                stream: true
            };

            this.abortController = new AbortController();

            await this.httpClient.streamRequest(
                `${ollamaUrl}/api/generate`,
                {
                    method: 'POST',
                    body: JSON.stringify(requestBody)
                },
                (line: string) => {
                    try {
                        const parsedData = JSON.parse(line) as OllamaGenerateResponse;
                        
                        this._view?.webview.postMessage({
                            type: 'chatResponse',
                            response: parsedData.response,
                            model: selectedModel,
                            prompt: prompt,
                            done: parsedData.done
                        });
                    } catch (error) {
                        console.error('Error parsing JSON chunk:', error);
                    }
                },
                this.abortController.signal
            );

            this.abortController = undefined;

        } catch (error) {
            this._view?.webview.postMessage({
                type: 'chatError',
                error: `Failed to chat with model: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
            this.abortController = undefined;
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
                    context += result + '\n\n';
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    output += `Error: ${errorMsg}\n\n`;
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
            return 'Please provide a directory path.\n\nUsage: @directory <path>\n\nExamples:\n• @directory src\n• @directory ./components';
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return 'No workspace folder found.';
        }

        const validator = new PathValidator(workspaceFolder.uri.fsPath);
        const validation = validator.validatePath(dirPath);

        if (!validation.valid) {
            return `❌ ${validation.error}: ${dirPath}`;
        }

        const stats = fs.lstatSync(validation.fullPath);
        if (!stats.isDirectory()) {
            return `❌ Path is not a directory: ${dirPath}`;
        }

        let result = `📂 Directory: ${dirPath}\n`;
        result += `📍 Full Path: ${validation.fullPath}\n\n`;
        result += '🌳 Directory Tree (3 levels deep):\n';
        result += '─'.repeat(40) + '\n';
        result += this.getDirectoryTree(validation.fullPath, 0, 3);

        return result;
    }

    private getFileContent(filePath: string): string {
        if (!filePath) {
            return 'Please provide a file path.\n\nUsage: @file <path>\n\nExamples:\n• @file package.json\n• @file src/extension.ts';
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return 'No workspace folder found.';
        }

        const validator = new PathValidator(workspaceFolder.uri.fsPath);
        const validation = validator.validatePath(filePath);

        if (!validation.valid) {
            return `❌ ${validation.error}: ${filePath}`;
        }

        const stats = fs.lstatSync(validation.fullPath);
        if (!stats.isFile()) {
            return `❌ Path is not a file: ${filePath}`;
        }

        try {
            if (stats.size > 1024 * 1024) {
                return `❌ File too large: ${filePath}\n\nFile size: ${(stats.size / 1024 / 1024).toFixed(2)} MB\n\nFiles larger than 1MB are not displayed.`;
            }

            const content = fs.readFileSync(validation.fullPath, 'utf8');
            const fileExtension = path.extname(validation.fullPath);
            
            let result = `📄 File: ${filePath}\n`;
            result += `📍 Full Path: ${validation.fullPath}\n`;
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
            return `❌ Error reading file: ${filePath}\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
            
            const filteredItems = items.filter(item => {
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
                result += `${indent}🔭 (empty directory)\n`;
            }

        } catch (error) {
            result += `${indent}❌ Error reading directory: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
        }

        return result;
    }

    private getFileIcon(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        const name = path.basename(fileName).toLowerCase();
        
        const specialFiles: Record<string, string> = {
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

        const iconMap: Record<string, string> = {
            '.js': '🟨', '.ts': '🟦', '.jsx': '⚛️', '.tsx': '⚛️',
            '.vue': '💚', '.json': '📋', '.md': '📝', '.txt': '📄',
            '.html': '🌐', '.css': '🎨', '.scss': '🎨', '.less': '🎨',
            '.png': '🖼️', '.jpg': '🖼️', '.jpeg': '🖼️', '.gif': '🖼️',
            '.svg': '🖼️', '.ico': '🖼️', '.pdf': '📕', '.zip': '📦',
            '.tar': '📦', '.gz': '📦', '.py': '🐍', '.java': '☕',
            '.cpp': '⚙️', '.c': '⚙️', '.php': '🐘', '.rb': '💎',
            '.go': '🐹', '.rs': '🦀', '.xml': '📄', '.yaml': '📄',
            '.yml': '📄', '.sh': '⚡', '.bat': '⚡', '.exe': '⚙️', '.dll': '⚙️'
        };
        
        return iconMap[ext] || '📄';
    }
}

export function deactivate() {}