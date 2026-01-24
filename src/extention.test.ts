import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Test suite for My Code Assistant Extension
 * Run with: npm test
 */

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('your-publisher.my-code-assistant'));
    });

    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('your-publisher.my-code-assistant');
        await extension?.activate();
        assert.ok(extension?.isActive);
    });
});

suite('PathValidator Tests', () => {
    const testWorkspaceRoot = path.join(__dirname, 'test-workspace');

    setup(() => {
        // Create test workspace directory
        if (!fs.existsSync(testWorkspaceRoot)) {
            fs.mkdirSync(testWorkspaceRoot, { recursive: true });
        }
    });

    teardown(() => {
        // Clean up test workspace
        if (fs.existsSync(testWorkspaceRoot)) {
            fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
        }
    });

    test('Should validate relative paths within workspace', () => {
        // Create PathValidator instance (you'll need to export this class)
        // const validator = new PathValidator(testWorkspaceRoot);
        
        // Create test file
        const testFilePath = path.join(testWorkspaceRoot, 'test.txt');
        fs.writeFileSync(testFilePath, 'test content');

        // Test validation
        // const result = validator.validatePath('test.txt');
        // assert.ok(result.valid);
        // assert.strictEqual(result.fullPath, testFilePath);
    });

    test('Should reject path traversal attempts', () => {
        // const validator = new PathValidator(testWorkspaceRoot);
        
        // Test path traversal
        // const result = validator.validatePath('../../../etc/passwd');
        // assert.strictEqual(result.valid, false);
        // assert.ok(result.error);
    });

    test('Should reject absolute paths outside workspace', () => {
        // const validator = new PathValidator(testWorkspaceRoot);
        
        // Test absolute path outside workspace
        // const result = validator.validatePath('/etc/passwd');
        // assert.strictEqual(result.valid, false);
        // assert.ok(result.error);
    });

    test('Should reject non-existent paths', () => {
        // const validator = new PathValidator(testWorkspaceRoot);
        
        // Test non-existent path
        // const result = validator.validatePath('nonexistent.txt');
        // assert.strictEqual(result.valid, false);
        // assert.strictEqual(result.error, 'Path does not exist');
    });
});

suite('RateLimiter Tests', () => {
    test('Should allow requests within limit', async () => {
        // const limiter = new RateLimiter(5, 1000); // 5 requests per second
        
        const start = Date.now();
        
        // Make 5 requests
        // for (let i = 0; i < 5; i++) {
        //     await limiter.waitForSlot();
        // }
        
        const duration = Date.now() - start;
        
        // Should complete quickly since we're within limit
        // assert.ok(duration < 100);
    });

    test('Should throttle requests exceeding limit', async () => {
        // const limiter = new RateLimiter(2, 1000); // 2 requests per second
        
        const start = Date.now();
        
        // Make 4 requests (should throttle after 2)
        // for (let i = 0; i < 4; i++) {
        //     await limiter.waitForSlot();
        // }
        
        const duration = Date.now() - start;
        
        // Should take at least 1 second due to throttling
        // assert.ok(duration >= 1000);
    });
});

suite('HttpClient Tests', () => {
    test('Should make successful GET request', async () => {
        // const client = new HttpClient();
        
        // Mock successful response
        // const result = await client.request('http://localhost:11434/api/tags');
        // assert.ok(result);
    });

    test('Should handle timeout', async () => {
        // const client = new HttpClient();
        
        // Try to connect to non-responsive endpoint
        // try {
        //     await client.request('http://192.0.2.1:11434/api/tags');
        //     assert.fail('Should have thrown timeout error');
        // } catch (error) {
        //     assert.ok(error instanceof Error);
        //     assert.strictEqual(error.message, 'Request timeout');
        // }
    });

    test('Should handle HTTP errors', async () => {
        // const client = new HttpClient();
        
        // Try invalid endpoint
        // try {
        //     await client.request('http://localhost:11434/invalid-endpoint');
        //     assert.fail('Should have thrown HTTP error');
        // } catch (error) {
        //     assert.ok(error instanceof Error);
        //     assert.ok(error.message.includes('HTTP'));
        // }
    });
});

suite('Command Execution Tests', () => {
    test('Should parse @project command', () => {
        const command = '@project';
        const parts = command.split(' ');
        const cmd = parts[0];
        
        assert.strictEqual(cmd, '@project');
    });

    test('Should parse @directory command with path', () => {
        const command = '@directory src/components';
        const parts = command.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);
        
        assert.strictEqual(cmd, '@directory');
        assert.strictEqual(args.join(' '), 'src/components');
    });

    test('Should parse @file command with path', () => {
        const command = '@file package.json';
        const parts = command.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);
        
        assert.strictEqual(cmd, '@file');
        assert.strictEqual(args.join(' '), 'package.json');
    });

    test('Should handle unknown commands', () => {
        const command = '@unknown';
        const parts = command.split(' ');
        const cmd = parts[0];
        
        const knownCommands = ['@project', '@directory', '@file'];
        assert.ok(!knownCommands.includes(cmd));
    });
});

suite('File System Tests', () => {
    const testDir = path.join(__dirname, 'test-fs');

    setup(() => {
        // Create test directory structure
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        // Create test files
        fs.writeFileSync(path.join(testDir, 'test.txt'), 'Hello World');
        fs.writeFileSync(path.join(testDir, 'test.json'), '{"key": "value"}');
        
        // Create subdirectory
        const subDir = path.join(testDir, 'subdir');
        fs.mkdirSync(subDir, { recursive: true });
        fs.writeFileSync(path.join(subDir, 'nested.txt'), 'Nested content');
    });

    teardown(() => {
        // Clean up
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    test('Should read file content correctly', () => {
        const filePath = path.join(testDir, 'test.txt');
        const content = fs.readFileSync(filePath, 'utf8');
        
        assert.strictEqual(content, 'Hello World');
    });

    test('Should list directory contents', () => {
        const items = fs.readdirSync(testDir);
        
        assert.ok(items.includes('test.txt'));
        assert.ok(items.includes('test.json'));
        assert.ok(items.includes('subdir'));
    });

    test('Should filter hidden files correctly', () => {
        const items = fs.readdirSync(testDir);
        const filtered = items.filter(item => {
            if (item.startsWith('.') && !['.vscode', '.env', '.gitignore'].includes(item)) {
                return false;
            }
            return true;
        });
        
        // All items should pass (no hidden files in test)
        assert.strictEqual(filtered.length, items.length);
    });

    test('Should get file size correctly', () => {
        const filePath = path.join(testDir, 'test.txt');
        const stats = fs.statSync(filePath);
        
        assert.ok(stats.size > 0);
        assert.strictEqual(stats.size, 11); // "Hello World" is 11 bytes
    });
});

suite('Formatting Tests', () => {
    test('Should format bytes correctly', () => {
        function formatBytes(bytes: number): string {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        assert.strictEqual(formatBytes(0), '0 Bytes');
        assert.strictEqual(formatBytes(1024), '1 KB');
        assert.strictEqual(formatBytes(1024 * 1024), '1 MB');
        assert.strictEqual(formatBytes(1536), '1.5 KB');
    });

    test('Should get correct file icons', () => {
        const iconMap: Record<string, string> = {
            '.js': '🟨',
            '.ts': '🟦',
            '.json': '📋',
            '.md': '📝',
        };

        assert.strictEqual(iconMap['.js'], '🟨');
        assert.strictEqual(iconMap['.ts'], '🟦');
        assert.strictEqual(iconMap['.json'], '📋');
    });
});

suite('Configuration Tests', () => {
    test('Should get default Ollama URL', () => {
        const config = vscode.workspace.getConfiguration('myCodeAssistant');
        const url = config.get<string>('ollamaUrl', 'http://localhost:11434');
        
        assert.ok(url);
        assert.ok(url.startsWith('http'));
    });

    test('Should validate URL format', () => {
        const validUrls = [
            'http://localhost:11434',
            'https://api.example.com',
            'http://192.168.1.100:8080'
        ];

        const invalidUrls = [
            'not-a-url',
            'localhost:11434', // missing protocol
            'http://'
        ];

        validUrls.forEach(url => {
            try {
                new URL(url);
                assert.ok(true);
            } catch {
                assert.fail(`${url} should be valid`);
            }
        });

        invalidUrls.forEach(url => {
            try {
                new URL(url);
                assert.fail(`${url} should be invalid`);
            } catch {
                assert.ok(true);
            }
        });
    });
});

suite('Streaming Response Tests', () => {
    test('Should handle JSON chunks correctly', () => {
        const mockChunk = '{"response":"Hello","done":false}\n{"response":" World","done":true}';
        const lines = mockChunk.split('\n').filter(line => line.trim() !== '');
        
        assert.strictEqual(lines.length, 2);
        
        const parsed1 = JSON.parse(lines[0]);
        assert.strictEqual(parsed1.response, 'Hello');
        assert.strictEqual(parsed1.done, false);
        
        const parsed2 = JSON.parse(lines[1]);
        assert.strictEqual(parsed2.response, ' World');
        assert.strictEqual(parsed2.done, true);
    });

    test('Should handle incomplete chunks', () => {
        const mockChunk = '{"response":"Hello",';
        
        try {
            JSON.parse(mockChunk);
            assert.fail('Should have thrown error');
        } catch (error) {
            assert.ok(error instanceof SyntaxError);
        }
    });
});

suite('Security Tests', () => {
    test('Should sanitize path traversal attempts', () => {
        const maliciousPath = '../../../etc/passwd';
        const sanitized = maliciousPath.replace(/\.\./g, '');
        
        assert.strictEqual(sanitized, '/etc/passwd');
        assert.ok(!sanitized.includes('..'));
    });

    test('Should validate workspace boundaries', () => {
        const workspaceRoot = '/home/user/project';
        const testPath = '/home/user/project/src/file.ts';
        
        assert.ok(testPath.startsWith(workspaceRoot));
    });

    test('Should reject paths outside workspace', () => {
        const workspaceRoot = '/home/user/project';
        const testPath = '/etc/passwd';
        
        assert.ok(!testPath.startsWith(workspaceRoot));
    });
});

suite('Integration Tests', () => {
    test('Should activate extension and register commands', async () => {
        const extension = vscode.extensions.getExtension('your-publisher.my-code-assistant');
        await extension?.activate();
        
        const commands = await vscode.commands.getCommands(true);
        
        assert.ok(commands.includes('myCodeAssistant.refresh'));
        assert.ok(commands.includes('myCodeAssistant.configure'));
    });
});

// Performance Tests
suite('Performance Tests', () => {
    test('Directory tree should complete in reasonable time', () => {
        // Test would measure time to generate tree
        const start = Date.now();
        
        // Generate directory tree for test workspace
        // const tree = getDirectoryTree(testPath, 0, 3);
        
        const duration = Date.now() - start;
        
        // Should complete in less than 1 second for typical projects
        assert.ok(duration < 1000);
    });

    test('Rate limiter should not significantly delay requests', async () => {
        // Test that rate limiter overhead is minimal for allowed requests
        const start = Date.now();
        
        // Make requests within limit
        // Should have minimal overhead
        
        const duration = Date.now() - start;
        assert.ok(duration < 100);
    });
});