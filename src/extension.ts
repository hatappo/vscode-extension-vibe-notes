// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import { spawn } from "child_process";
import { MemoFileHandler } from "./util/memoFileHandler";
import { CommentDecorationProvider } from "./decorations/commentDecorationProvider";
import { MultiWorkspaceTreeProvider } from "./views/multiWorkspaceTreeProvider";
import { ReviewComment } from "./util/reviewCommentParser";
import { CommentCodeLensProvider } from "./providers/commentCodeLensProvider";
import { TempFileManager } from "./util/tempFileManager";

// Global map to store temp file managers for cleanup on deactivate
const tempFileManagers = new Map<string, TempFileManager>();

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	// Initialize memo file handlers and decoration providers for each workspace
	const memoHandlers = new Map<string, MemoFileHandler>();
	const decorationProviders = new Map<string, CommentDecorationProvider>();
	const codeLensProviders = new Map<string, CommentCodeLensProvider>();

	// Create a single tree provider for all workspaces
	const treeProvider = new MultiWorkspaceTreeProvider();

	// Initialize handlers for existing workspace folders
	if (!vscode.workspace.workspaceFolders) {
		return;
	}

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

		// Create temp file manager
		const tempFileManager = new TempFileManager(folder.uri.fsPath);
		tempFileManagers.set(folder.uri.fsPath, tempFileManager);

		// Register CodeLens provider
		const codeLensDisposable = vscode.languages.registerCodeLensProvider(
			{ scheme: "file", pattern: new vscode.RelativePattern(folder, "**/*") },
			codeLensProvider,
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
	const treeView = vscode.window.createTreeView("shadowCommentsView", {
		treeDataProvider: treeProvider,
		showCollapseAll: true,
	});
	context.subscriptions.push(treeView);

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

	// Generate enhanced markdown with clickable links
	const generateEnhancedMarkdown = (comments: ReviewComment[], workspaceFolder: vscode.WorkspaceFolder): string => {
		if (comments.length === 0) {
			return "*No comments found*";
		}

		// Group by file path and sort
		const groupedByFile = comments.reduce(
			(acc, comment) => {
				if (!acc[comment.filePath]) {
					acc[comment.filePath] = [];
				}
				acc[comment.filePath].push(comment);
				return acc;
			},
			{} as Record<string, ReviewComment[]>,
		);

		// Sort file paths
		const sortedFilePaths = Object.keys(groupedByFile).sort();

		// Generate markdown
		const markdownSections: string[] = [];

		for (const filePath of sortedFilePaths) {
			// File path header with clickable link (using relative path)
			markdownSections.push(`## [${filePath}](${filePath})`);
			markdownSections.push("");

			// Sort comments by line number
			const fileComments = groupedByFile[filePath].sort((a, b) => a.startLine - b.startLine);

			// Each comment
			for (const comment of fileComments) {
				// Line number header with clickable link
				const lineText = formatLineRange(comment);

				// Create clickable link to specific line (using relative path)
				const lineLink = `${filePath}#L${comment.startLine}`;
				markdownSections.push(`### [${lineText}](${lineLink})`);
				markdownSections.push("");
				markdownSections.push(comment.comment);
				markdownSections.push("");
			}
		}

		// Remove the last empty line
		if (markdownSections[markdownSections.length - 1] === "") {
			markdownSections.pop();
		}

		return markdownSections.join("\n");
	};

	// Format line range for display
	const formatLineRange = (comment: ReviewComment): string => {
		const { startLine, endLine } = comment;
		if (startLine === endLine) {
			return `Line ${startLine}`;
		}
		return `Lines ${startLine}-${endLine}`;
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
	const findCommentAtCursor = async (): Promise<{
		comment: ReviewComment | undefined;
		handler: MemoFileHandler | undefined;
		workspaceFolder: vscode.WorkspaceFolder | undefined;
	}> => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return { comment: undefined, handler: undefined, workspaceFolder: undefined };
		}

		const handler = getCurrentHandler();
		if (!handler) {
			vscode.window.showErrorMessage("No workspace folder found");
			return { comment: undefined, handler: undefined, workspaceFolder: undefined };
		}

		const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
		if (!workspaceFolder) {
			return { comment: undefined, handler: undefined, workspaceFolder: undefined };
		}

		const relativePath = path.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath);
		const currentLine = editor.selection.active.line + 1;

		const comments = await handler.readComments();
		const comment = comments.find(
			(c) => c.filePath === relativePath && currentLine >= c.startLine && currentLine <= c.endLine,
		);

		return { comment, handler, workspaceFolder };
	};

	// Common function to edit a comment
	const editComment = async (
		comment: ReviewComment,
		handler: MemoFileHandler,
		workspaceFolder: vscode.WorkspaceFolder,
	): Promise<void> => {
		const tempFileManager = tempFileManagers.get(workspaceFolder.uri.fsPath);
		if (!tempFileManager) {
			vscode.window.showErrorMessage("Temp file manager not found");
			return;
		}

		// Create header for the temp file
		const header = `# Edit Shadow Comment
# File: ${comment.filePath}
# Line: ${comment.startLine === comment.endLine ? comment.startLine : `${comment.startLine}-${comment.endLine}`}
# 
# Edit your comment below and save the file (Ctrl+S / Cmd+S).
# Close without saving to cancel.
# ========================================

`;

		// Open temp file for comment editing
		await tempFileManager.openTempFile("EditComment", header + comment.comment, async (content) => {
			if (content === null) {
				return;
			}

			// Extract comment text (remove header)
			const lines = content.split("\n");
			const separatorIndex = lines.findIndex((line) => line.includes("========================================"));

			if (separatorIndex === -1 || separatorIndex >= lines.length - 1) {
				return;
			}

			const commentLines = lines.slice(separatorIndex + 1);
			const newComment = commentLines.join("\n").trim();

			if (!newComment || newComment === comment.comment) {
				return;
			}

			await handler.updateComment(comment, newComment);
			await updateUIComponents(workspaceFolder);
			vscode.window.showInformationMessage("Comment updated successfully");
		});
	};

	// Common function to delete a comment
	const deleteComment = async (
		comment: ReviewComment,
		handler: MemoFileHandler,
		workspaceFolder: vscode.WorkspaceFolder,
	): Promise<void> => {
		// Confirm deletion
		const confirmation = await vscode.window.showWarningMessage("Delete this comment?", "Delete", "Cancel");

		if (confirmation === "Delete") {
			await handler.deleteComment(comment);
			await updateUIComponents(workspaceFolder);
		}
	};

	// Common function to find comment at specific line
	const findCommentAtLine = async (
		uri: vscode.Uri,
		line: number,
	): Promise<{
		comment: ReviewComment | undefined;
		handler: MemoFileHandler | undefined;
		workspaceFolder: vscode.WorkspaceFolder | undefined;
	}> => {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
		if (!workspaceFolder) {
			return { comment: undefined, handler: undefined, workspaceFolder: undefined };
		}

		const handler = memoHandlers.get(workspaceFolder.uri.fsPath);
		if (!handler) {
			return { comment: undefined, handler: undefined, workspaceFolder: undefined };
		}

		const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
		const comments = await handler.readComments();
		const comment = comments.find((c) => c.filePath === relativePath && line >= c.startLine && line <= c.endLine);

		return { comment, handler, workspaceFolder };
	};

	// Command: Add comment to line
	const addCommentCommand = vscode.commands.registerCommand("shadow-comments.addComment", async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage("No active editor");
			return;
		}

		const handler = getCurrentHandler();
		if (!handler) {
			vscode.window.showErrorMessage("No workspace folder found");
			return;
		}

		const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri)!;
		const tempFileManager = tempFileManagers.get(workspaceFolder.uri.fsPath);
		if (!tempFileManager) {
			vscode.window.showErrorMessage("Temp file manager not found");
			return;
		}

		const selection = editor.selection;
		const startLine = selection.start.line + 1; // Convert to 1-based
		const endLine = selection.end.line + 1;
		const relativePath = path.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath);

		// Create header for the temp file
		const header = `# Add Shadow Comment
# File: ${relativePath}
# Line: ${startLine === endLine ? startLine : `${startLine}-${endLine}`}
# 
# Enter your comment below and save the file (Ctrl+S / Cmd+S).
# Close without saving to cancel.
# ========================================

`;

		// Open temp file for comment input
		await tempFileManager.openTempFile("AddComment", header, async (content) => {
			if (content === null) {
				return;
			}

			// Extract comment text (remove header)
			const lines = content.split("\n");
			const separatorIndex = lines.findIndex((line) => line.includes("========================================"));

			if (separatorIndex === -1 || separatorIndex >= lines.length - 1) {
				return;
			}

			const commentLines = lines.slice(separatorIndex + 1);
			const comment = commentLines.join("\n").trim();

			if (!comment) {
				return;
			}

			await handler.addComment(relativePath, startLine, endLine, comment);
			await updateUIComponents(workspaceFolder);
			vscode.window.showInformationMessage("Comment added successfully");
		});
	});

	// Command: Open as markdown (temporary file)
	const showMarkdownCommand = vscode.commands.registerCommand("shadow-comments.showMarkdown", async () => {
		// Get handler and workspace folder for copy operation
		let workspaceFolder: vscode.WorkspaceFolder | undefined;
		let handler: MemoFileHandler | undefined;

		// First try to get based on active editor
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
			if (workspaceFolder) {
				handler = memoHandlers.get(workspaceFolder.uri.fsPath);
			}
		}

		// If no active editor, use first workspace
		if (!handler && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			workspaceFolder = vscode.workspace.workspaceFolders[0];
			handler = memoHandlers.get(workspaceFolder.uri.fsPath);
		}

		if (!handler || !workspaceFolder) {
			vscode.window.showErrorMessage("No workspace folder found");
			return;
		}

		// Generate enhanced markdown content
		const now = new Date().toLocaleString();
		const comments = await handler.readComments();
		const enhancedMarkdown = generateEnhancedMarkdown(comments, workspaceFolder);
		
		const markdownContent = `# Shadow Comments

> This is a read-only view of your shadow comments.
> Editing functionality coming soon.

Generated: ${now}

---

${enhancedMarkdown}`;

		// Write to .comments.local.md in workspace root
		const markdownPath = path.join(workspaceFolder.uri.fsPath, '.comments.local.md');
		const markdownUri = vscode.Uri.file(markdownPath);
		
		try {
			// Write the markdown file
			await vscode.workspace.fs.writeFile(
				markdownUri, 
				Buffer.from(markdownContent, 'utf8')
			);
			
			// Open the file in editor
			const doc = await vscode.workspace.openTextDocument(markdownUri);
			await vscode.window.showTextDocument(doc);
			
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to create markdown file: ${error}`);
		}
	});

	// Command: Go to comment
	const goToCommentCommand = vscode.commands.registerCommand(
		"shadow-comments.goToComment",
		async (comment: any, workspaceFolder?: vscode.WorkspaceFolder) => {
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
			const position = new vscode.Position(comment.startLine - 1, 0);
			const range = new vscode.Range(position, position);
			editor.selection = new vscode.Selection(position, position);
			editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
		},
	);

	// Command: Edit comment at current position
	const editCommentAtCursorCommand = vscode.commands.registerCommand(
		"shadow-comments.editCommentAtCursor",
		async () => {
			const { comment, handler, workspaceFolder } = await findCommentAtCursor();

			if (!comment || !handler || !workspaceFolder) {
				if (comment === undefined && handler && workspaceFolder) {
					vscode.window.showInformationMessage("No comment found at current line");
				}
				return;
			}

			await editComment(comment, handler, workspaceFolder);
		},
	);

	// Command: Delete comment at current position
	const deleteCommentAtCursorCommand = vscode.commands.registerCommand(
		"shadow-comments.deleteCommentAtCursor",
		async () => {
			const { comment, handler, workspaceFolder } = await findCommentAtCursor();

			if (!comment || !handler || !workspaceFolder) {
				if (comment === undefined && handler && workspaceFolder) {
					vscode.window.showInformationMessage("No comment found at current line");
				}
				return;
			}

			await deleteComment(comment, handler, workspaceFolder);
		},
	);

	// Command: Edit comment at specific line (for CodeLens)
	const editCommentAtLineCommand = vscode.commands.registerCommand(
		"shadow-comments.editCommentAtLine",
		async (uri: vscode.Uri, line: number) => {
			const { comment, handler, workspaceFolder } = await findCommentAtLine(uri, line);
			if (comment && handler && workspaceFolder) {
				await editComment(comment, handler, workspaceFolder);
			}
		},
	);

	// Command: Delete comment at specific line (for CodeLens)
	const deleteCommentAtLineCommand = vscode.commands.registerCommand(
		"shadow-comments.deleteCommentAtLine",
		async (uri: vscode.Uri, line: number) => {
			const { comment, handler, workspaceFolder } = await findCommentAtLine(uri, line);
			if (comment && handler && workspaceFolder) {
				await deleteComment(comment, handler, workspaceFolder);
			}
		},
	);

	// Command: Refresh tree view
	const refreshTreeCommand = vscode.commands.registerCommand("shadow-comments.refreshTree", async () => {
		await treeProvider.refresh();
		vscode.window.showInformationMessage("Comments refreshed");
	});

	// Command: Save to Git Notes
	const saveToGitNotesCommand = vscode.commands.registerCommand("shadow-comments.saveToGitNotes", async () => {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			vscode.window.showErrorMessage("No workspace folder found");
			return;
		}

		// Check if it's a git repository
		const gitDir = path.join(workspaceFolder.uri.fsPath, ".git");
		try {
			await vscode.workspace.fs.stat(vscode.Uri.file(gitDir));
		} catch {
			vscode.window.showErrorMessage("Not a git repository");
			return;
		}

		// Get the handler for the workspace
		const handler = memoHandlers.get(workspaceFolder.uri.fsPath);
		if (!handler) {
			vscode.window.showErrorMessage("No memo handler found");
			return;
		}

		try {
			// Read the current comments
			const comments = await handler.readComments();
			if (comments.length === 0) {
				vscode.window.showInformationMessage("No comments to save");
				return;
			}

			// Show confirmation dialog
			const confirmation = await vscode.window.showWarningMessage(
				"Save comments to Git Notes? This will overwrite any existing notes on the current HEAD commit.",
				"Save",
				"Cancel",
			);

			if (confirmation !== "Save") {
				return;
			}

			// Get the raw content
			const content = await handler.getRawContent();

			// Execute git notes command using stdin for security
			await new Promise<void>((resolve, reject) => {
				const gitProcess = spawn("git", ["notes", "add", "-f", "-F", "-"], {
					cwd: workspaceFolder.uri.fsPath,
				});

				let stderr = "";

				// Collect stderr for error messages
				gitProcess.stderr.on("data", (data) => {
					stderr += data.toString();
				});

				// Handle process exit
				gitProcess.on("close", (code) => {
					if (code === 0) {
						resolve();
					} else {
						reject(new Error(`Git notes failed: ${stderr}`));
					}
				});

				// Handle process errors
				gitProcess.on("error", (err) => {
					reject(err);
				});

				// Write content to stdin
				gitProcess.stdin.write(content);
				gitProcess.stdin.end();
			});

			vscode.window.showInformationMessage("Comments saved to git notes");
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to save to git notes: ${error}`);
		}
	});

	// Register all commands
	context.subscriptions.push(
		addCommentCommand,
		showMarkdownCommand,
		goToCommentCommand,
		editCommentAtCursorCommand,
		deleteCommentAtCursorCommand,
		editCommentAtLineCommand,
		deleteCommentAtLineCommand,
		refreshTreeCommand,
		saveToGitNotesCommand,
	);
	// Update decorations when editor becomes visible
	context.subscriptions.push(
		vscode.window.onDidChangeVisibleTextEditors(() => {
			decorationProviders.forEach((decorationProvider) => {
				decorationProvider.updateDecorations();
			});
		}),
	);

	// Apply decorations to new editors
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (!editor) {
				return;
			}

			const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
			if (!workspaceFolder) {
				return;
			}

			const decorationProvider = decorationProviders.get(workspaceFolder.uri.fsPath);
			if (!decorationProvider) {
				return;
			}

			decorationProvider.applyDecorationsToEditor(editor);
		}),
	);

	// Clean up handlers on deactivation
	context.subscriptions.push({
		dispose: () => {
			memoHandlers.forEach((handler) => {
				handler.dispose();
			});
			decorationProviders.forEach((decorationProvider) => {
				decorationProvider.dispose();
			});
		},
	});
}

// This method is called when your extension is deactivated
export async function deactivate() {
	// Clean up all temp file managers
	for (const [_, tempFileManager] of tempFileManagers) {
		await tempFileManager.dispose();
	}
}
