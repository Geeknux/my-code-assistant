"use strict";
// New analysis methods to add to MyCodeAssistantProvider class
analyzeDirectory(dirPath, string);
string;
{
    if (!dirPath) {
        return 'Please provide a directory path.\\n\\nUsage: @analyze-dir <path>\\n\\nExamples:\\n• @analyze-dir src\\n• @analyze-dir src/services';
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
    // Get all source files in the directory
    const files = this.getSourceFilesRecursive(validation.fullPath, 2); // Max 2 levels deep
    if (files.length === 0) {
        return `📂 Directory: ${dirPath}\\n\\n⚠️ No source files found in this directory.`;
    }
    // Estimate tokens
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const estimatedTokens = Math.ceil(totalSize / 4); // Rough estimate: 1 token ≈ 4 chars
    let result = `📂 Analyzing Directory: ${dirPath}\\n`;
    result += `📍 Full Path: ${validation.fullPath}\\n`;
    result += `📊 Files Found: ${files.length}\\n`;
    result += `📏 Total Size: ${this.formatBytes(totalSize)}\\n`;
    result += `🔢 Estimated Tokens: ~${estimatedTokens.toLocaleString()}\\n`;
    if (estimatedTokens > 20000) {
        result += `\\n⚠️ WARNING: Large directory (${estimatedTokens.toLocaleString()} tokens)\\n`;
        result += `💡 Consider using @batch with specific files or analyzing subdirectories separately.\\n`;
    }
    result += `\\n${'='.repeat(60)}\\n\\n`;
    // Add each file's content
    for (const file of files) {
        result += `## File: ${file.relativePath}\\n`;
        result += `📏 Size: ${this.formatBytes(file.size)} | Lines: ${file.lines}\\n`;
        result += `\\n\`\`\`${file.language}\\n`;
        result += file.content;
        result += `\\n\`\`\`\\n\\n`;
        result += `${'─'.repeat(60)}\\n\\n`;
    }
    return result;
}
analyzeProject();
string;
{
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return 'No workspace folder found.';
    }
    const rootPath = workspaceFolder.uri.fsPath;
    // Smart file selection
    const importantFiles = [];
    const checkFiles = [
        'package.json',
        'README.md',
        'tsconfig.json',
        'vite.config.ts',
        'vite.config.js',
        'webpack.config.js',
        '.env.example',
        'docker-compose.yml',
        'Dockerfile'
    ];
    // Add important config files
    for (const file of checkFiles) {
        const filePath = path.join(rootPath, file);
        if (fs.existsSync(filePath)) {
            importantFiles.push(file);
        }
    }
    // Find main entry points
    const entryPoints = this.findEntryPoints(rootPath);
    importantFiles.push(...entryPoints);
    // Get file contents
    const fileContents = [];
    let totalSize = 0;
    for (const relPath of importantFiles) {
        const fullPath = path.join(rootPath, relPath);
        try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const size = Buffer.byteLength(content, 'utf-8');
            const lines = content.split('\\n').length;
            if (size < 1024 * 1024) { // Skip files > 1MB
                fileContents.push({ path: relPath, content, size, lines });
                totalSize += size;
            }
        }
        catch (error) {
            // Skip files that can't be read
        }
    }
    const estimatedTokens = Math.ceil(totalSize / 4);
    let result = `🚀 Project Analysis: ${workspaceFolder.name}\\n`;
    result += `📍 Path: ${rootPath}\\n`;
    result += `📊 Key Files: ${fileContents.length}\\n`;
    result += `📏 Total Size: ${this.formatBytes(totalSize)}\\n`;
    result += `🔢 Estimated Tokens: ~${estimatedTokens.toLocaleString()}\\n`;
    result += `\\n${'='.repeat(60)}\\n\\n`;
    // Add project structure
    result += `🌳 Project Structure:\\n`;
    result += `${'─'.repeat(40)}\\n`;
    result += this.getDirectoryTree(rootPath, 0, 2);
    result += `\\n${'='.repeat(60)}\\n\\n`;
    // Add file contents
    for (const file of fileContents) {
        const ext = path.extname(file.path).slice(1);
        const language = this.getLanguageFromExtension(ext);
        result += `## File: ${file.path}\\n`;
        result += `📏 Size: ${this.formatBytes(file.size)} | Lines: ${file.lines}\\n`;
        result += `\\n\`\`\`${language}\\n`;
        result += file.content;
        result += `\\n\`\`\`\\n\\n`;
        result += `${'─'.repeat(60)}\\n\\n`;
    }
    return result;
}
analyzeBatchFiles(filePaths, string[]);
string;
{
    if (filePaths.length === 0) {
        return 'Please provide at least one file path.\\n\\nUsage: @batch <file1> <file2> ...\\n\\nExamples:\\n• @batch src/User.ts src/UserService.ts\\n• @batch package.json tsconfig.json';
    }
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return 'No workspace folder found.';
    }
    const validator = new PathValidator(workspaceFolder.uri.fsPath);
    const fileContents = [];
    const errors = [];
    let totalSize = 0;
    for (const filePath of filePaths) {
        const validation = validator.validatePath(filePath);
        if (!validation.valid) {
            errors.push(`❌ ${filePath}: ${validation.error}`);
            continue;
        }
        try {
            const stats = fs.lstatSync(validation.fullPath);
            if (!stats.isFile()) {
                errors.push(`❌ ${filePath}: Not a file`);
                continue;
            }
            if (stats.size > 1024 * 1024) {
                errors.push(`❌ ${filePath}: File too large (${this.formatBytes(stats.size)})`);
                continue;
            }
            const content = fs.readFileSync(validation.fullPath, 'utf-8');
            const lines = content.split('\\n').length;
            fileContents.push({
                path: filePath,
                content,
                size: stats.size,
                lines
            });
            totalSize += stats.size;
        }
        catch (error) {
            errors.push(`❌ ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    if (fileContents.length === 0) {
        let result = '⚠️ No files could be loaded.\\n\\n';
        if (errors.length > 0) {
            result += 'Errors:\\n' + errors.join('\\n');
        }
        return result;
    }
    const estimatedTokens = Math.ceil(totalSize / 4);
    let result = `📦 Batch Analysis: ${fileContents.length} file(s)\\n`;
    result += `📏 Total Size: ${this.formatBytes(totalSize)}\\n`;
    result += `🔢 Estimated Tokens: ~${estimatedTokens.toLocaleString()}\\n`;
    if (estimatedTokens > 20000) {
        result += `\\n⚠️ WARNING: Large batch (${estimatedTokens.toLocaleString()} tokens)\\n`;
        result += `💡 Consider reducing the number of files.\\n`;
    }
    if (errors.length > 0) {
        result += `\\n⚠️ Skipped ${errors.length} file(s):\\n`;
        errors.forEach(err => result += `  ${err}\\n`);
    }
    result += `\\n${'='.repeat(60)}\\n\\n`;
    // Add file contents
    for (const file of fileContents) {
        const ext = path.extname(file.path).slice(1);
        const language = this.getLanguageFromExtension(ext);
        result += `## File: ${file.path}\\n`;
        result += `📏 Size: ${this.formatBytes(file.size)} | Lines: ${file.lines}\\n`;
        result += `\\n\`\`\`${language}\\n`;
        result += file.content;
        result += `\\n\`\`\`\\n\\n`;
        result += `${'─'.repeat(60)}\\n\\n`;
    }
    return result;
}
getSourceFilesRecursive(dirPath, string, maxDepth, number, currentDepth, number = 0);
Array < { relativePath: string, content: string, size: number, lines: number, language: string } > {
    const: files, Array() { relativePath: string, content; string, size; number, lines; number, language; string; }
} > ;
[];
if (currentDepth >= maxDepth) {
    return files;
}
try {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
        // Skip common directories
        if (['node_modules', 'dist', 'build', 'out', '.git', '.vscode', 'coverage'].includes(item)) {
            continue;
        }
        const itemPath = path.join(dirPath, item);
        const stats = fs.lstatSync(itemPath);
        if (stats.isDirectory()) {
            const subFiles = this.getSourceFilesRecursive(itemPath, maxDepth, currentDepth + 1);
            files.push(...subFiles);
        }
        else if (stats.isFile() && this.isSourceFile(item)) {
            if (stats.size < 1024 * 1024) { // Skip files > 1MB
                try {
                    const content = fs.readFileSync(itemPath, 'utf-8');
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    const relativePath = workspaceFolder ?
                        path.relative(workspaceFolder.uri.fsPath, itemPath) : item;
                    const ext = path.extname(item).slice(1);
                    files.push({
                        relativePath,
                        content,
                        size: stats.size,
                        lines: content.split('\\n').length,
                        language: this.getLanguageFromExtension(ext)
                    });
                }
                catch (error) {
                    // Skip files that can't be read
                }
            }
        }
    }
}
catch (error) {
    // Skip directories that can't be read
}
return files;
isSourceFile(fileName, string);
boolean;
{
    const sourceExtensions = [
        '.ts', '.tsx', '.js', '.jsx', '.vue', '.py', '.java', '.cpp', '.c', '.h',
        '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.r',
        '.json', '.md', '.yaml', '.yml', '.toml', '.xml', '.html', '.css', '.scss'
    ];
    const ext = path.extname(fileName).toLowerCase();
    return sourceExtensions.includes(ext);
}
findEntryPoints(rootPath, string);
string[];
{
    const entryPoints = [];
    const commonEntries = [
        'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js',
        'src/app.ts', 'src/app.js', 'index.ts', 'index.js', 'main.ts', 'main.js',
        'src/extension.ts', 'src/server.ts', 'src/cli.ts'
    ];
    for (const entry of commonEntries) {
        const fullPath = path.join(rootPath, entry);
        if (fs.existsSync(fullPath)) {
            entryPoints.push(entry);
        }
    }
    return entryPoints;
}
getLanguageFromExtension(ext, string);
string;
{
    const languageMap = {
        'ts': 'typescript',
        'tsx': 'typescript',
        'js': 'javascript',
        'jsx': 'javascript',
        'py': 'python',
        'java': 'java',
        'cpp': 'cpp',
        'c': 'c',
        'cs': 'csharp',
        'go': 'go',
        'rs': 'rust',
        'php': 'php',
        'rb': 'ruby',
        'swift': 'swift',
        'kt': 'kotlin',
        'scala': 'scala',
        'r': 'r',
        'json': 'json',
        'md': 'markdown',
        'yaml': 'yaml',
        'yml': 'yaml',
        'toml': 'toml',
        'xml': 'xml',
        'html': 'html',
        'css': 'css',
        'scss': 'scss',
        'vue': 'vue'
    };
    return languageMap[ext] || ext;
}
//# sourceMappingURL=new-analysis-methods.js.map