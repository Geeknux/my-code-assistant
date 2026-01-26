# Implementation Guide: New Analysis Commands

## Overview
This guide explains how to add the new analysis commands to your extension.

## Files Created
- `new-analysis-methods.ts` - Contains all the new methods to add

## Step-by-Step Integration

### Step 1: Add Case Statements

Open `src/extension.ts` and find the `processCommand` method (around line 620).

After the `case '@file':` block (line 630-632), add these new cases:

```typescript
case '@analyze-dir':
    const analyzeDirPath = args.join(' ');
    return this.analyzeDirectory(analyzeDirPath);

case '@analyze-project':
    return this.analyzeProject();

case '@batch':
    return this.analyzeBatchFiles(args);
```

**Location:** Insert between line 632 and line 634 (before `default:`)

### Step 2: Update Help Text

The help text in the `default` case has already been updated to include:
```
• @analyze-dir <path> - Analyze all files in a directory
• @analyze-project - Smart project-wide analysis
• @batch <file1> <file2> ... - Analyze multiple files together
```

✅ This is already done!

### Step 3: Add New Methods

Open `src/extension.ts` and scroll to the end of the `MyCodeAssistantProvider` class (around line 854, before the closing brace `}`).

Copy all the methods from `new-analysis-methods.ts` and paste them before the closing brace.

The methods to add are:
1. `analyzeDirectory(dirPath: string): string`
2. `analyzeProject(): string`
3. `analyzeBatchFiles(filePaths: string[]): string`
4. `getSourceFilesRecursive(...)` - Helper method
5. `isSourceFile(fileName: string): boolean` - Helper method
6. `findEntryPoints(rootPath: string): string[]` - Helper method
7. `getLanguageFromExtension(ext: string): string` - Helper method

### Step 4: Update Webview Autocomplete

Open `src/webview.ts` and find the `handleChatInputChange` function (around line 713).

Update the autocomplete to include the new commands:

```typescript
// Check if we're typing a command
const fileMatch = currentLine.match(/@file\\s+(.*)$/);
const dirMatch = currentLine.match(/@directory\\s+(.*)$/);
const analyzeDirMatch = currentLine.match(/@analyze-dir\\s+(.*)$/);
const batchMatch = currentLine.match(/@batch\\s+(.*)$/);

if (fileMatch) {
    requestAutocomplete('@file', fileMatch[1]);
} else if (dirMatch) {
    requestAutocomplete('@directory', dirMatch[1]);
} else if (analyzeDirMatch) {
    requestAutocomplete('@analyze-dir', analyzeDirMatch[1]);
} else if (batchMatch) {
    // For batch, autocomplete the last file path
    const paths = batchMatch[1].split(' ');
    const lastPath = paths[paths.length - 1];
    requestAutocomplete('@batch', lastPath);
} else {
    hideAutocomplete();
}
```

### Step 5: Update Welcome Message

In `src/webview.ts`, update the welcome content (around line 685) to mention the new commands:

```html
<strong>📋 Available Commands:</strong>
• <span class="command-example">@project</span> - Show project structure
• <span class="command-example">@directory &lt;path&gt;</span> - Show directory tree
• <span class="command-example">@file &lt;path&gt;</span> - Show file content
• <span class="command-example">@analyze-dir &lt;path&gt;</span> - Analyze all files in directory
• <span class="command-example">@analyze-project</span> - Smart project analysis
• <span class="command-example">@batch &lt;files...&gt;</span> - Analyze multiple files
```

## Testing

After integration, test each command:

### Test 1: @analyze-dir
```
@analyze-dir src
```
**Expected:** Shows all source files in src/ with their contents

### Test 2: @analyze-project
```
@analyze-project
```
**Expected:** Shows project structure + key files (package.json, README, entry points)

### Test 3: @batch
```
@batch package.json tsconfig.json
```
**Expected:** Shows both files with their contents

### Test 4: Token Warning
```
@analyze-dir node_modules
```
**Expected:** Warning about large directory (if not filtered)

### Test 5: Error Handling
```
@batch nonexistent.ts
```
**Expected:** Error message about file not found

## Features Implemented

### ✅ @analyze-dir
- Recursively scans directory (max 2 levels)
- Filters out node_modules, dist, build, etc.
- Shows all source files with contents
- Estimates token count
- Warns if too large (>20K tokens)
- Formats with syntax highlighting

### ✅ @analyze-project
- Smart file selection
- Includes: package.json, README, config files
- Finds entry points automatically
- Shows project structure
- Displays key file contents
- Token estimation

### ✅ @batch
- Analyzes multiple specific files
- Validates each file path
- Shows errors for invalid files
- Skips files >1MB
- Token estimation
- Warns if batch is too large

### ✅ Smart Features
- **Token Estimation**: Warns when approaching limits
- **Auto-filtering**: Excludes common directories
- **Error Handling**: Graceful failures with helpful messages
- **Size Limits**: Prevents loading huge files
- **Syntax Highlighting**: Proper language detection
- **Relative Paths**: Shows paths relative to workspace

## Token Estimates

| Command | Typical Size | Safe For |
|---------|--------------|----------|
| @analyze-dir src/ | 5K-50K tokens | 32K+ models |
| @analyze-project | 10K-30K tokens | 32K+ models |
| @batch (3-5 files) | 2K-10K tokens | All models |

## File Filtering

### Excluded Directories
- `node_modules/`
- `dist/`, `build/`, `out/`
- `.git/`, `.vscode/`
- `coverage/`

### Included Extensions
- Code: `.ts`, `.js`, `.py`, `.java`, `.cpp`, `.go`, `.rs`, etc.
- Config: `.json`, `.yaml`, `.yml`, `.toml`
- Docs: `.md`, `.txt`
- Web: `.html`, `.css`, `.scss`

## Error Messages

### No Workspace
```
No workspace folder found.
```

### Invalid Path
```
❌ Invalid path: ../../../etc/passwd
```

### Not a Directory
```
❌ Path is not a directory: package.json
```

### File Too Large
```
❌ package-lock.json: File too large (1.2 MB)
```

### No Files Found
```
📂 Directory: empty-folder

⚠️ No source files found in this directory.
```

## Integration Checklist

- [ ] Add case statements in `processCommand` method
- [ ] Add all 7 new methods to `MyCodeAssistantProvider` class
- [ ] Update autocomplete in `webview.ts`
- [ ] Update welcome message
- [ ] Compile: `npm run compile`
- [ ] Test @analyze-dir
- [ ] Test @analyze-project
- [ ] Test @batch
- [ ] Test error handling
- [ ] Update README.md with new commands

## Quick Copy-Paste

### For extension.ts (after line 632)
```typescript
case '@analyze-dir':
    const analyzeDirPath = args.join(' ');
    return this.analyzeDirectory(analyzeDirPath);

case '@analyze-project':
    return this.analyzeProject();

case '@batch':
    return this.analyzeBatchFiles(args);
```

### For extension.ts (before line 856)
See `new-analysis-methods.ts` for all methods to copy.

---

**Ready to integrate!** Follow the steps above to add these powerful analysis features to your extension.
