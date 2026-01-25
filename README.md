# My Code Assistant

🤖 An intelligent VS Code extension that combines powerful code exploration commands with AI-powered analysis, all in a unified chat interface.

## Features

### 🎯 Unified Chat Interface
- **Single conversation view** for both commands and AI chat
- **Smart routing** - automatically detects commands vs questions
- **Seamless workflow** - run commands and get AI insights in one place

### 📋 Powerful Commands
Explore your codebase with intuitive @ commands:

- **`@project`** - Display project structure and directory tree (3 levels deep)
- **`@directory <path>`** - Show directory tree for a specific path
- **`@file <path>`** - Display file content with metadata (size, lines, type)

### 🤖 AI-Powered Analysis
- **Automatic AI analysis** of command results when a model is selected
- **Context-aware** conversations using command output
- **Intelligent explanations** of your code structure and files
- Powered by **Ollama** for local, private AI processing

### ✨ Smart Features
- **Autocomplete** for file and directory paths (type `@file ` or `@directory `)
- **Keyboard shortcuts** - `Ctrl+Enter` to send, arrow keys to navigate
- **Real-time streaming** responses from AI
- **Markdown rendering** for formatted AI responses
- **State persistence** - your conversation history is saved

## Requirements

- **Ollama** must be installed and running locally
  - Download from: [https://ollama.ai](https://ollama.ai)
  - Default URL: `http://localhost:11434`
  - Pull at least one model: `ollama pull llama2` or `ollama pull codellama`

## Installation

1. Install the extension from VS Code Marketplace (or install from VSIX)
2. Install and start Ollama
3. Pull an AI model: `ollama pull llama2`
4. Open the extension from the Activity Bar (🤖 icon)

## Usage

### Basic Workflow

1. **Open the extension** - Click the 🤖 icon in the Activity Bar
2. **Select an AI model** - Choose from the dropdown (or use "No AI model" for commands only)
3. **Start exploring:**
   - Type `@project` to see your project structure
   - Type `@file package.json` to view a file
   - Ask questions: "What does this project do?"

### Example Conversations

#### Exploring a Project
```
You: @project

📋 System: [Shows project directory tree]

🤖 Assistant: This is a VS Code extension project with the following structure:
- src/ contains TypeScript source code
- Main files: extension.ts (entry point) and webview.ts (UI)
- Uses TypeScript 5.9.3 and targets VS Code 1.103.0
...
```

#### Analyzing a File
```
You: @file package.json

📋 System: [Shows file content and metadata]

🤖 Assistant: This is a Node.js package configuration for a VS Code extension.

Key dependencies:
• marked 17.0.1 - For markdown rendering
• TypeScript 5.9.3 - Development language
...
```

#### Direct Questions
```
You: How does the extension work?

🤖 Assistant: Based on the code context, this extension works by...
```

### Commands Reference

| Command | Description | Example |
|---------|-------------|---------|
| `@project` | Show project structure | `@project` |
| `@directory <path>` | Show directory tree | `@directory src` |
| `@file <path>` | Show file content | `@file package.json` |

**Tip:** Use relative paths from workspace root

### Keyboard Shortcuts

- **`Ctrl+Enter`** - Send message
- **`Arrow Up/Down`** - Navigate autocomplete suggestions
- **`Enter`** - Select autocomplete item
- **`Escape`** - Close autocomplete dropdown

## Extension Settings

This extension contributes the following settings:

* `myCodeAssistant.ollamaUrl` - Ollama server URL (default: `http://localhost:11434`)
* `myCodeAssistant.selectedModel` - Last selected AI model

Access settings via:
- Command Palette: `My Code Assistant: Configure Ollama URL`
- Or click the gear icon in the extension panel

## How It Works

### Unified Interface
The extension features a single chat interface that intelligently handles both commands and AI conversations:

1. **Type a command** (`@project`, `@file`, `@directory`) → Executes and shows result
2. **AI model selected?** → Automatically analyzes the result
3. **Type a question** → Sends to AI with command context
4. **No AI model?** → Commands still work, helpful message for questions

### AI Auto-Analysis
When you run a command with an AI model selected:
1. Command executes and shows result
2. Result is automatically sent to AI
3. AI analyzes and explains the output
4. All in one seamless conversation

### Security
- **Path validation** prevents directory traversal attacks
- **Workspace boundaries** enforced for all file operations
- **Rate limiting** (10 requests/second) prevents API abuse
- **Content Security Policy** in webview
- **Local AI processing** - your code never leaves your machine

## Architecture

### Components
- **Extension Host** (`extension.ts`) - Main logic, command handling, Ollama integration
- **Webview** (`webview.ts`) - Chat UI, message routing, state management
- **PathValidator** - Security layer for file system access
- **HttpClient** - Ollama API communication with rate limiting
- **RateLimiter** - Request throttling

### Message Flow
```
User Input → Smart Detection → Command or AI?
    ↓                              ↓
Command Execution            AI Processing
    ↓                              ↓
Result Display          ←    AI Response
    ↓
Auto AI Analysis (if model selected)
```

## Troubleshooting

### Ollama Connection Issues
- **Error: "Connection failed"**
  - Ensure Ollama is running: `ollama serve`
  - Check URL in settings (default: `http://localhost:11434`)
  - Click "🔄 Refresh" to retry connection

### No Models Available
- Pull a model: `ollama pull llama2`
- Verify with: `ollama list`
- Restart Ollama if needed

### Commands Not Working
- Ensure you're in a workspace (open a folder)
- Check file/directory paths are relative to workspace root
- Use autocomplete to avoid typos

### Autocomplete Not Showing
- Type `@file ` or `@directory ` (with space after)
- Wait ~300ms for suggestions to appear
- Ensure you're typing in the input field

## Development

### Building from Source
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Run tests
npm test
```

### Project Structure
```
my-code-assistant/
├── src/
│   ├── extension.ts      # Main extension logic
│   ├── webview.ts        # Chat UI implementation
│   └── extention.test.ts # Test suite
├── out/                  # Compiled JavaScript
├── media/                # Static assets
├── package.json          # Extension manifest
└── tsconfig.json         # TypeScript config
```

## Known Issues

- Large files (>1MB) are rejected for performance
- Directory trees limited to 3 levels deep
- Autocomplete limited to 50 results
- Requires Ollama to be running locally

## Roadmap

- [ ] Multi-file context support
- [ ] Custom AI prompts
- [ ] Export conversations
- [ ] Code snippet extraction
- [ ] Syntax highlighting in results
- [ ] Remote Ollama support
- [ ] Command history with arrow keys
- [ ] Slash commands (/clear, /help)

## Release Notes

### 0.0.1 (2026-01-25)

**Initial Release** 🎉

Features:
- ✅ Unified chat interface for commands and AI
- ✅ Three powerful commands: @project, @file, @directory
- ✅ AI auto-analysis of command results
- ✅ Autocomplete for file/directory paths
- ✅ Ollama integration for local AI
- ✅ Security features (path validation, rate limiting)
- ✅ State persistence
- ✅ Markdown rendering
- ✅ Real-time streaming responses

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

[MIT License](LICENSE)

## Credits

- Built with [VS Code Extension API](https://code.visualstudio.com/api)
- AI powered by [Ollama](https://ollama.ai)
- Markdown rendering by [marked](https://marked.js.org)

---

**Enjoy exploring your code with AI assistance!** 🚀

For questions or issues, please visit the [GitHub repository](https://github.com/yourusername/my-code-assistant).
