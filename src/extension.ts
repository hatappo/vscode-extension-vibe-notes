// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { MemoFileHandler } from './util/memoFileHandler';
import { CommentDecorationProvider } from './decorations/commentDecorationProvider';
import { MultiWorkspaceTreeProvider } from './views/multiWorkspaceTreeProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	console.log('[Vibe Letter] Extension activation started!');
	console.log('[Vibe Letter] Context:', context.extensionPath);

	// Initialize memo file handlers and decoration providers for each workspace
	const memoHandlers = new Map<string, MemoFileHandler>();
	const decorationProviders = new Map<string, CommentDecorationProvider>();
	
	// Create a single tree provider for all workspaces
	const treeProvider = new MultiWorkspaceTreeProvider();

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
			
			// Add workspace to tree provider
			treeProvider.addWorkspace(folder, handler);
			
			// Set up file watcher
			const watcher = handler.getFileWatcher();
			if (watcher) {
				watcher.onDidChange(async () => {
					await decorationProvider.updateDecorations();
					await treeProvider.loadAllComments();
					treeProvider.refresh();
				});
				watcher.onDidCreate(async () => {
					await decorationProvider.updateDecorations();
					await treeProvider.loadAllComments();
					treeProvider.refresh();
				});
				watcher.onDidDelete(async () => {
					await decorationProvider.updateDecorations();
					await treeProvider.loadAllComments();
					treeProvider.refresh();
				});
			}
		}
		
		// Register tree view after all workspaces are initialized
		await treeProvider.loadAllComments();
		const treeView = vscode.window.createTreeView('vibeLetterComments', {
			treeDataProvider: treeProvider,
			showCollapseAll: true
		});
		context.subscriptions.push(treeView);
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
			
			// Update decorations and tree view
			const decorationProvider = decorationProviders.get(workspaceFolder.uri.fsPath);
			if (decorationProvider) {
				await decorationProvider.updateDecorations();
			}
			
			// Update tree view
			await treeProvider.loadAllComments();
			treeProvider.refresh();
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

	// Command: Go to comment
	const goToCommentCommand = vscode.commands.registerCommand('vscode-extension-vibe-letter.goToComment', async (comment: any, workspaceFolder?: vscode.WorkspaceFolder) => {
		if (!comment || !comment.filePath) {
			return;
		}

		// Use provided workspace folder or default to first one
		const folder = workspaceFolder || vscode.workspace.workspaceFolders?.[0];
		if (!folder) {
			return;
		}

		const fullPath = path.join(folder.uri.fsPath, comment.filePath);
		const document = await vscode.workspace.openTextDocument(fullPath);
		const editor = await vscode.window.showTextDocument(document);

		// Navigate to the comment position
		const position = new vscode.Position(comment.startLine - 1, comment.startColumn || 0);
		const range = new vscode.Range(position, position);
		editor.selection = new vscode.Selection(position, position);
		editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
	});

	// Command: Edit comment at current position
	const editCommentAtCursorCommand = vscode.commands.registerCommand('vscode-extension-vibe-letter.editCommentAtCursor', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const handler = getCurrentHandler();
		if (!handler) {
			vscode.window.showErrorMessage('No workspace folder found');
			return;
		}

		const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
		if (!workspaceFolder) {
			return;
		}

		const relativePath = path.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath);
		const currentLine = editor.selection.active.line + 1;
		
		// Find comment at current line
		const comments = await handler.readComments();
		const comment = comments.find(c => 
			c.filePath === relativePath && 
			currentLine >= c.startLine && 
			currentLine <= c.endLine
		);

		if (!comment) {
			vscode.window.showInformationMessage('No comment found at current line');
			return;
		}

		// Prompt for new comment text
		const newComment = await vscode.window.showInputBox({
			prompt: 'Edit comment',
			value: comment.comment,
			placeHolder: 'Enter your comment...'
		});

		if (newComment !== undefined && newComment !== comment.comment) {
			await handler.updateComment(comment, newComment);
			
			// Update decorations and tree view
			const decorationProvider = decorationProviders.get(workspaceFolder.uri.fsPath);
			if (decorationProvider) {
				await decorationProvider.updateDecorations();
			}
			
			await treeProvider.loadAllComments();
			treeProvider.refresh();
		}
	});

	// Command: Delete comment at current position
	const deleteCommentAtCursorCommand = vscode.commands.registerCommand('vscode-extension-vibe-letter.deleteCommentAtCursor', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const handler = getCurrentHandler();
		if (!handler) {
			vscode.window.showErrorMessage('No workspace folder found');
			return;
		}

		const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
		if (!workspaceFolder) {
			return;
		}

		const relativePath = path.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath);
		const currentLine = editor.selection.active.line + 1;
		
		// Find comment at current line
		const comments = await handler.readComments();
		const comment = comments.find(c => 
			c.filePath === relativePath && 
			currentLine >= c.startLine && 
			currentLine <= c.endLine
		);

		if (!comment) {
			vscode.window.showInformationMessage('No comment found at current line');
			return;
		}

		// Confirm deletion
		const confirmation = await vscode.window.showWarningMessage(
			'Delete this comment?',
			'Delete',
			'Cancel'
		);

		if (confirmation === 'Delete') {
			await handler.deleteComment(comment);
			
			// Update decorations and tree view
			const decorationProvider = decorationProviders.get(workspaceFolder.uri.fsPath);
			if (decorationProvider) {
				await decorationProvider.updateDecorations();
			}
			
			await treeProvider.loadAllComments();
			treeProvider.refresh();
		}
	});

	// Register all commands
	console.log('[Vibe Letter] Registering all commands to context.subscriptions...');
	context.subscriptions.push(
		addCommentCommand,
		copyRawCommand,
		copyMarkdownCommand,
		copyJsonCommand,
		goToCommentCommand,
		editCommentAtCursorCommand,
		deleteCommentAtCursorCommand
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
