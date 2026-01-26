# Best Practices: Feeding Files to AI Models

## Overview
When analyzing code with AI, the key challenge is managing context window limits while providing enough information for meaningful analysis.

## 🎯 Core Principles

### 1. **Token Budget Management**
- Most models: 4K-128K tokens (~3K-100K words)
- 1 token ≈ 4 characters of code
- Reserve 20-30% for AI response
- Example: 32K model → use ~22K tokens for input

### 2. **Quality over Quantity**
- Better to analyze 5 files deeply than 50 files superficially
- Focus on relevant files for the question
- Exclude boilerplate and generated code

### 3. **Hierarchical Context**
```
Level 1: Project Structure (what exists)
Level 2: File Summaries (what each file does)
Level 3: Full Content (detailed analysis)
```

## 📋 Recommended Approaches

### **Approach 1: Smart Directory Analysis**
Best for: Analyzing a specific module or feature

```markdown
# Analyzing: src/authentication/

## Structure
- login.ts (234 lines)
- register.ts (189 lines)
- auth-middleware.ts (156 lines)
- types.ts (45 lines)

## File Contents

### login.ts
```typescript
[full content]
```

### register.ts
```typescript
[full content]
```
...
```

**Pros:**
- ✅ Complete context for related files
- ✅ AI understands relationships
- ✅ Good for feature analysis

**Cons:**
- ❌ Limited to small directories
- ❌ May exceed token limit

### **Approach 2: Progressive Disclosure**
Best for: Large projects or exploratory analysis

```
Step 1: "Here's the project structure. What should I focus on?"
Step 2: "Analyze the src/core/ directory"
Step 3: "Show me the implementation of UserService"
```

**Pros:**
- ✅ Efficient token usage
- ✅ AI-guided exploration
- ✅ Scales to any project size

**Cons:**
- ❌ Requires multiple interactions
- ❌ User must guide the process

### **Approach 3: Batch File Analysis**
Best for: Analyzing specific files together

```markdown
Analyze these related files:

## src/models/User.ts
```typescript
[content]
```

## src/services/UserService.ts
```typescript
[content]
```

## src/controllers/UserController.ts
```typescript
[content]
```
```

**Pros:**
- ✅ Precise control over context
- ✅ Good for tracing features
- ✅ Efficient token usage

**Cons:**
- ❌ User must know which files to include
- ❌ May miss dependencies

### **Approach 4: Smart Filtering**
Best for: Full project analysis

**Include:**
```
✅ Source files (.ts, .js, .py, .go, etc.)
✅ Config files (package.json, tsconfig.json, .env.example)
✅ Documentation (README.md, API.md)
✅ Tests (for understanding behavior)
```

**Exclude:**
```
❌ node_modules/, vendor/, dist/, build/
❌ .git/, .vscode/, .idea/
❌ Binary files (.png, .jpg, .pdf)
❌ Lock files (package-lock.json, yarn.lock)
❌ Large data files
```

**Pros:**
- ✅ Comprehensive analysis
- ✅ Automated filtering
- ✅ Good for "explain this project"

**Cons:**
- ❌ Still may exceed limits on large projects
- ❌ Includes irrelevant files

## 🛠️ Implementation Strategies

### **Strategy 1: Size-Based Batching**
```typescript
const MAX_TOKENS = 20000; // Reserve space for response
let currentBatch = [];
let currentSize = 0;

for (const file of files) {
    const fileSize = estimateTokens(file.content);
    
    if (currentSize + fileSize > MAX_TOKENS) {
        // Send current batch
        await analyzeFiles(currentBatch);
        currentBatch = [file];
        currentSize = fileSize;
    } else {
        currentBatch.push(file);
        currentSize += fileSize;
    }
}
```

### **Strategy 2: Importance-Based Selection**
```typescript
const fileImportance = {
    'package.json': 10,
    'README.md': 9,
    'src/index.ts': 8,
    'src/main.ts': 8,
    'tsconfig.json': 7,
    // ... other files scored by heuristics
};

// Sort by importance, take top N that fit in context
const selectedFiles = files
    .sort((a, b) => fileImportance[b] - fileImportance[a])
    .filter(fitInContextWindow);
```

### **Strategy 3: Dependency-Aware Selection**
```typescript
// If analyzing UserService.ts, also include:
// - Files it imports
// - Files that import it
// - Related types/interfaces

const relatedFiles = [
    ...getImports(targetFile),
    ...getImporters(targetFile),
    ...getSharedTypes(targetFile)
];
```

## 📊 Format Recommendations

### **Format 1: Markdown with Code Blocks**
```markdown
# Project: my-app

## File: src/app.ts
```typescript
import express from 'express';
// ... code
```

## File: src/routes.ts
```typescript
// ... code
```
```

**Best for:** General analysis, documentation generation

### **Format 2: XML-Style Tags**
```xml
<project name="my-app">
  <file path="src/app.ts" language="typescript">
    <content>
      import express from 'express';
      // ... code
    </content>
  </file>
  <file path="src/routes.ts" language="typescript">
    <content>
      // ... code
    </content>
  </file>
</project>
```

**Best for:** Structured analysis, parsing

### **Format 3: JSON Structure**
```json
{
  "project": "my-app",
  "files": [
    {
      "path": "src/app.ts",
      "language": "typescript",
      "lines": 234,
      "content": "..."
    }
  ]
}
```

**Best for:** Programmatic processing

## 🎯 Recommended Implementation for Your Extension

### **New Commands**

#### **1. `@analyze-dir <path>`**
Analyzes all source files in a directory
```
User: @analyze-dir src/services
AI: Analyzing 5 files in src/services/...

[Shows all file contents]
[AI provides analysis]
```

#### **2. `@analyze-project`**
Smart project-wide analysis
```
User: @analyze-project
AI: Analyzing project structure...

[Includes: package.json, README, main source files]
[Excludes: node_modules, dist, tests]
[AI provides overview]
```

#### **3. `@batch <file1> <file2> ...`**
Analyze specific files together
```
User: @batch src/User.ts src/UserService.ts
AI: Analyzing 2 files together...

[Shows both files]
[AI explains relationships]
```

### **Smart Features**

1. **Token Estimation**
   - Warn if files exceed model limit
   - Suggest splitting into batches

2. **File Filtering**
   - Auto-exclude common patterns
   - User-configurable ignore list

3. **Progressive Loading**
   - Show structure first
   - Ask AI which files to examine
   - Load on-demand

4. **Caching**
   - Cache file contents
   - Reuse in conversation
   - Clear on file changes

## 💡 Best Practices Summary

### **DO:**
✅ Start with project structure
✅ Focus on relevant files
✅ Use clear formatting
✅ Include file metadata (path, size, language)
✅ Batch related files together
✅ Estimate token usage
✅ Provide context about the question

### **DON'T:**
❌ Send entire projects blindly
❌ Include binary files
❌ Forget to exclude dependencies
❌ Mix unrelated files
❌ Exceed token limits
❌ Send duplicate information

## 🔧 Example Prompts

### **Good Prompt:**
```
Analyze these authentication-related files:

## src/auth/login.ts (234 lines)
[content]

## src/auth/register.ts (189 lines)
[content]

## src/middleware/auth.ts (156 lines)
[content]

Question: How does the authentication flow work?
```

### **Better Prompt:**
```
I'm analyzing the authentication system in my Express app.

Project context:
- Express.js backend
- JWT-based authentication
- PostgreSQL database

Files to analyze:
[3 files as above]

Questions:
1. How does the login flow work?
2. Are there any security issues?
3. How can I add OAuth support?
```

## 📈 Token Estimation

### **Rough Estimates:**
- 1 line of code ≈ 10-20 tokens
- 100 lines ≈ 1,000-2,000 tokens
- 1KB of code ≈ 250-300 tokens

### **Example:**
```
File: 500 lines of TypeScript
Estimate: 500 × 15 = 7,500 tokens
Safe for: 32K model ✅
Too large for: 4K model ❌
```

## 🎓 Conclusion

**For your extension, I recommend:**

1. **Implement `@analyze-dir`** - Most useful for focused analysis
2. **Add smart filtering** - Exclude common patterns automatically
3. **Show token estimates** - Warn users about limits
4. **Support batching** - Let users select specific files
5. **Progressive disclosure** - Start with structure, drill down

This balances usability with AI effectiveness!

---

**Would you like me to implement these features in your extension?**
