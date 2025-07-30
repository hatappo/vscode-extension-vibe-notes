// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { MemoFileHandler } from './util/memoFileHandler';
import { CommentDecorationProvider } from './decorations/commentDecorationProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('[Vibe Letter] Extension activation started!');
	console.log('[Vibe Letter] Context:', context.extensionPath);

	// Initialize memo file handlers and decoration providers for each workspace
	const memoHandlers = new Map<string, MemoFileHandler>();
	const decorationProviders = new Map<string, CommentDecorationProvider>();

	// Initialize handlers for existing workspace folders
	if (vscode.workspace.workspaceFolders) {
		for (const folder of vscode.workspace.workspaceFolders) {
			const handler = new MemoFileHandler(folder);
			handler.initialize();
			memoHandlers.set(folder.uri.fsPath, handler);
			
			// Create decoration provider
			const decorationProvider = new CommentDecorationProvider(handler, folder);
			decorationProviders.set(folder.uri.fsPath, decorationProvider);
			
			// Initial decoration update
			decorationProvider.updateDecorations();
			
			// Set up file watcher
			const watcher = handler.getFileWatcher();
			if (watcher) {
				watcher.onDidChange(() => decorationProvider.updateDecorations());
				watcher.onDidCreate(() => decorationProvider.updateDecorations());
				watcher.onDidDelete(() => decorationProvider.updateDecorations());
			}
		}
	}

	// Get handler for current workspace
	const getCurrentHandler = (): MemoFileHandler | undefined => {
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			return undefined;
		}

		const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
		if (!workspaceFolder) {
			return undefined;
		}

		return memoHandlers.get(workspaceFolder.uri.fsPath);
	};

	// Command: Add comment to line
	console.log('[Vibe Letter] Registering addComment command...');
	const addCommentCommand = vscode.commands.registerCommand('vscode-extension-vibe-letter.addComment', async () => {
		console.log('[Vibe Letter] addComment command triggered!');
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor');
			return;
		}

		const handler = getCurrentHandler();
		if (!handler) {
			vscode.window.showErrorMessage('No workspace folder found');
			return;
		}

		const selection = editor.selection;
		const startLine = selection.start.line + 1; // Convert to 1-based
		const endLine = selection.end.line + 1;

		// Prompt for comment
		const comment = await vscode.window.showInputBox({
			prompt: `Add comment for line ${startLine === endLine ? startLine : `${startLine}-${endLine}`}`,
			placeHolder: 'Enter your comment...'
		});

		if (comment) {
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri)!;
			const relativePath = path.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath);
			await handler.addComment(relativePath, startLine, endLine, comment);
			
			// Update decorations
			const decorationProvider = decorationProviders.get(workspaceFolder.uri.fsPath);
			if (decorationProvider) {
				await decorationProvider.updateDecorations();
			}
		}
	});

	// Command: Copy as raw
	const copyRawCommand = vscode.commands.registerCommand('vscode-extension-vibe-letter.copyRaw', async () => {
		const handler = getCurrentHandler();
		if (!handler) {
			vscode.window.showErrorMessage('No workspace folder found');
			return;
		}
		await handler.copyRawContent();
	});

	// Command: Copy as markdown
	const copyMarkdownCommand = vscode.commands.registerCommand('vscode-extension-vibe-letter.copyMarkdown', async () => {
		const handler = getCurrentHandler();
		if (!handler) {
			vscode.window.showErrorMessage('No workspace folder found');
			return;
		}
		await handler.copyAsMarkdown();
	});

	// Command: Copy as JSON
	const copyJsonCommand = vscode.commands.registerCommand('vscode-extension-vibe-letter.copyJson', async () => {
		const handler = getCurrentHandler();
		if (!handler) {
			vscode.window.showErrorMessage('No workspace folder found');
			return;
		}
		await handler.copyAsJson();
	});

	// Register all commands
	console.log('[Vibe Letter] Registering all commands to context.subscriptions...');
	context.subscriptions.push(
		addCommentCommand,
		copyRawCommand,
		copyMarkdownCommand,
		copyJsonCommand
	);
	console.log('[Vibe Letter] Extension activation completed!');
	
	// Update decorations when editor becomes visible
	context.subscriptions.push(
		vscode.window.onDidChangeVisibleTextEditors(() => {
			decorationProviders.forEach(decorationProvider => {
				decorationProvider.updateDecorations();
			});
		})
	);
	
	// Apply decorations to new editors
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor) {
				const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
				if (workspaceFolder) {
					const decorationProvider = decorationProviders.get(workspaceFolder.uri.fsPath);
					if (decorationProvider) {
						decorationProvider.applyDecorationsToEditor(editor);
					}
				}
			}
		})
	);

	// Clean up handlers on deactivation
	context.subscriptions.push({
		dispose: () => {
			memoHandlers.forEach(handler => {
				handler.dispose();
			});
			decorationProviders.forEach(decorationProvider => {
				decorationProvider.dispose();
			});
		}
	});
}

// This method is called when your extension is deactivated
export function deactivate() {}
