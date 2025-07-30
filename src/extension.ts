// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { MemoFileHandler } from './util/memoFileHandler';
import { CommentDecorationProvider } from './decorations/commentDecorationProvider';
import { MultiWorkspaceTreeProvider } from './views/multiWorkspaceTreeProvider';
import { ReviewComment } from './util/reviewCommentParser';
import { CommentCodeLensProvider } from './providers/commentCodeLensProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	console.log('[Shadow Comments] Extension activation started!');
	console.log('[Shadow Comments] Context:', context.extensionPath);

	// Initialize memo file handlers and decoration providers for each workspace
	const memoHandlers = new Map<string, MemoFileHandler>();
	const decorationProviders = new Map<string, CommentDecorationProvider>();
	const codeLensProviders = new Map<string, CommentCodeLensProvider>();
	
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
			
			// Create CodeLens provider
			const codeLensProvider = new CommentCodeLensProvider(handler, folder);
			codeLensProviders.set(folder.uri.fsPath, codeLensProvider);
			
			// Register CodeLens provider
			const codeLensDisposable = vscode.languages.registerCodeLensProvider(
				{ scheme: 'file', pattern: new vscode.RelativePattern(folder, '**/*') },
				codeLensProvider
			);
			context.subscriptions.push(codeLensDisposable);
			
			// Initial decoration update
			decorationProvider.updateDecorations();
			
			// Add workspace to tree provider
			treeProvider.addWorkspace(folder, handler);
			
			// Set up file watcher
			const watcher = handler.getFileWatcher();
			if (watcher) {
				const handleFileChange = async () => {
					console.log('[Shadow Comments] File changed, updating UI...');
					await decorationProvider.updateDecorations();
					await treeProvider.refresh();
					codeLensProvider.refresh();
				};

				watcher.onDidChange(handleFileChange);
				watcher.onDidCreate(handleFileChange);
				watcher.onDidDelete(handleFileChange);
			}
		}
		
		// Register tree view after all workspaces are initialized
		await treeProvider.refresh();
		const treeView = vscode.window.createTreeView('shadowCommentsView', {
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

	// Get handler for copy operations (fallback to first workspace if no active editor)
	const getHandlerForCopy = (): MemoFileHandler | undefined => {
		// First try to get handler based on active editor
		const handler = getCurrentHandler();
		if (handler) {
			return handler;
		}

		// If no active editor, use first workspace
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			const firstWorkspace = vscode.workspace.workspaceFolders[0];
			return memoHandlers.get(firstWorkspace.uri.fsPath);
		}

		return undefined;
	};

	// Update UI components after comment changes
	const updateUIComponents = async (workspaceFolder: vscode.WorkspaceFolder): Promise<void> => {
		const decorationProvider = decorationProviders.get(workspaceFolder.uri.fsPath);
		if (decorationProvider) {
			await decorationProvider.updateDecorations();
		}
		
		const codeLensProvider = codeLensProviders.get(workspaceFolder.uri.fsPath);
		if (codeLensProvider) {
			codeLensProvider.refresh();
		}
		
		await treeProvider.refresh();
	};

	// Find comment at current cursor position
	const findCommentAtCursor = async (): Promise<{ comment: ReviewComment | undefined, handler: MemoFileHandler | undefined, workspaceFolder: vscode.WorkspaceFolder | undefined }> => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return { comment: undefined, handler: undefined, workspaceFolder: undefined };
		}

		const handler = getCurrentHandler();
		if (!handler) {
			vscode.window.showErrorMessage('No workspace folder found');
			return { comment: undefined, handler: undefined, workspaceFolder: undefined };
		}

		const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
		if (!workspaceFolder) {
			return { comment: undefined, handler: undefined, workspaceFolder: undefined };
		}

		const relativePath = path.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath);
		const currentLine = editor.selection.active.line + 1;
		
		const comments = await handler.readComments();
		const comment = comments.find(c => 
			c.filePath === relativePath && 
			currentLine >= c.startLine && 
			currentLine <= c.endLine
		);

		return { comment, handler, workspaceFolder };
	};

	// Command: Add comment to line
	console.log('[Shadow Comments] Registering addComment command...');
	const addCommentCommand = vscode.commands.registerCommand('shadow-comments.addComment', async () => {
		console.log('[Shadow Comments] addComment command triggered!');
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
			await updateUIComponents(workspaceFolder);
		}
	});

	// Command: Copy as raw
	const copyRawCommand = vscode.commands.registerCommand('shadow-comments.copyRaw', async () => {
		const handler = getHandlerForCopy();
		if (!handler) {
			vscode.window.showErrorMessage('No workspace folder found');
			return;
		}
		await handler.copyRawContent();
	});

	// Command: Copy as markdown
	const copyMarkdownCommand = vscode.commands.registerCommand('shadow-comments.copyMarkdown', async () => {
		const handler = getHandlerForCopy();
		if (!handler) {
			vscode.window.showErrorMessage('No workspace folder found');
			return;
		}
		await handler.copyAsMarkdown();
	});

	// Command: Copy as JSON
	const copyJsonCommand = vscode.commands.registerCommand('shadow-comments.copyJson', async () => {
		const handler = getHandlerForCopy();
		if (!handler) {
			vscode.window.showErrorMessage('No workspace folder found');
			return;
		}
		await handler.copyAsJson();
	});

	// Command: Go to comment
	const goToCommentCommand = vscode.commands.registerCommand('shadow-comments.goToComment', async (comment: any, workspaceFolder?: vscode.WorkspaceFolder) => {
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
	const editCommentAtCursorCommand = vscode.commands.registerCommand('shadow-comments.editCommentAtCursor', async () => {
		const { comment, handler, workspaceFolder } = await findCommentAtCursor();
		
		if (!comment || !handler || !workspaceFolder) {
			if (comment === undefined && handler && workspaceFolder) {
				vscode.window.showInformationMessage('No comment found at current line');
			}
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
			await updateUIComponents(workspaceFolder);
		}
	});

	// Command: Delete comment at current position
	const deleteCommentAtCursorCommand = vscode.commands.registerCommand('shadow-comments.deleteCommentAtCursor', async () => {
		const { comment, handler, workspaceFolder } = await findCommentAtCursor();
		
		if (!comment || !handler || !workspaceFolder) {
			if (comment === undefined && handler && workspaceFolder) {
				vscode.window.showInformationMessage('No comment found at current line');
			}
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
			await updateUIComponents(workspaceFolder);
		}
	});

	// Command: Edit comment at specific line (for CodeLens)
	const editCommentAtLineCommand = vscode.commands.registerCommand('shadow-comments.editCommentAtLine', async (uri: vscode.Uri, line: number) => {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
		if (!workspaceFolder) {
			return;
		}

		const handler = memoHandlers.get(workspaceFolder.uri.fsPath);
		if (!handler) {
			return;
		}

		const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
		const comments = await handler.readComments();
		const comment = comments.find(c => 
			c.filePath === relativePath && 
			line >= c.startLine && 
			line <= c.endLine
		);

		if (!comment) {
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
			await updateUIComponents(workspaceFolder);
		}
	});

	// Command: Delete comment at specific line (for CodeLens)
	const deleteCommentAtLineCommand = vscode.commands.registerCommand('shadow-comments.deleteCommentAtLine', async (uri: vscode.Uri, line: number) => {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
		if (!workspaceFolder) {
			return;
		}

		const handler = memoHandlers.get(workspaceFolder.uri.fsPath);
		if (!handler) {
			return;
		}

		const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
		const comments = await handler.readComments();
		const comment = comments.find(c => 
			c.filePath === relativePath && 
			line >= c.startLine && 
			line <= c.endLine
		);

		if (!comment) {
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
			await updateUIComponents(workspaceFolder);
		}
	});

	// Command: Refresh tree view
	const refreshTreeCommand = vscode.commands.registerCommand('shadow-comments.refreshTree', async () => {
		await treeProvider.refresh();
		vscode.window.showInformationMessage('Comments refreshed');
	});

	// Command: Open comments file
	const openCommentsFileCommand = vscode.commands.registerCommand('shadow-comments.openCommentsFile', async () => {
		// Get the first workspace folder
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('No workspace folder found');
			return;
		}

		// Construct the path to .local.comments.txt
		const commentsFilePath = path.join(workspaceFolder.uri.fsPath, '.local.comments.txt');
		const fileUri = vscode.Uri.file(commentsFilePath);

		try {
			// Open the file in the editor
			const document = await vscode.workspace.openTextDocument(fileUri);
			await vscode.window.showTextDocument(document);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to open comments file: ${error}`);
		}
	});

	// Command: Sync to Git Notes
	const syncToGitNotesCommand = vscode.commands.registerCommand('shadow-comments.syncToGitNotes', async () => {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			vscode.window.showErrorMessage('No workspace folder found');
			return;
		}

		// Check if it's a git repository
		const gitDir = path.join(workspaceFolder.uri.fsPath, '.git');
		try {
			await vscode.workspace.fs.stat(vscode.Uri.file(gitDir));
		} catch {
			vscode.window.showErrorMessage('Not a git repository');
			return;
		}

		// Get the handler for the workspace
		const handler = memoHandlers.get(workspaceFolder.uri.fsPath);
		if (!handler) {
			vscode.window.showErrorMessage('No memo handler found');
			return;
		}

		try {
			// Read the current comments
			const comments = await handler.readComments();
			if (comments.length === 0) {
				vscode.window.showInformationMessage('No comments to sync');
				return;
			}

			// Get the raw content
			const content = await handler.getRawContent();

			// Execute git notes command
			const execAsync = promisify(exec);

			// Add notes to current HEAD commit
			await execAsync(`git notes add -f -m "${content.replace(/"/g, '\\"')}"`, {
				cwd: workspaceFolder.uri.fsPath
			});

			vscode.window.showInformationMessage('Comments synced to git notes');
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to sync to git notes: ${error}`);
		}
	});

	// Register all commands
	console.log('[Shadow Comments] Registering all commands to context.subscriptions...');
	context.subscriptions.push(
		addCommentCommand,
		copyRawCommand,
		copyMarkdownCommand,
		copyJsonCommand,
		goToCommentCommand,
		editCommentAtCursorCommand,
		deleteCommentAtCursorCommand,
		editCommentAtLineCommand,
		deleteCommentAtLineCommand,
		refreshTreeCommand,
		openCommentsFileCommand,
		syncToGitNotesCommand
	);
	console.log('[Shadow Comments] Extension activation completed!');
	
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
