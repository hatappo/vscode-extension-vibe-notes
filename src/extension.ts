// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import { spawn } from "child_process";
import { NoteFileHandler } from "./util/noteFileHandler";
import { NoteDecorationProvider } from "./decorations/noteDecorationProvider";
import { MultiWorkspaceTreeProvider } from "./views/multiWorkspaceTreeProvider";
import { Note } from "./util/noteParser";
import { NoteCodeLensProvider } from "./providers/noteCodeLensProvider";
import { TempFileManager } from "./util/tempFileManager";
import { promptGitignoreSetup } from "./util/gitignoreHelper";
import { generateCodePreview } from "./util/codeFormatter";

// Global map to store temp file managers for cleanup on deactivate
const tempFileManagers = new Map<string, TempFileManager>();

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	// Initialize note file handlers and decoration providers for each workspace
	const noteHandlers = new Map<string, NoteFileHandler>();
	const decorationProviders = new Map<string, NoteDecorationProvider>();
	const codeLensProviders = new Map<string, NoteCodeLensProvider>();

	// Create a single tree provider for all workspaces
	const treeProvider = new MultiWorkspaceTreeProvider();
	
	// Update UI components after note changes
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

	// Initialize handlers for existing workspace folders
	if (!vscode.workspace.workspaceFolders) {
		return;
	}

	for (const folder of vscode.workspace.workspaceFolders) {
		const handler = new NoteFileHandler(folder);
		await handler.initialize();
		noteHandlers.set(folder.uri.fsPath, handler);

		// Create decoration provider
		const decorationProvider = new NoteDecorationProvider(handler, folder);
		decorationProviders.set(folder.uri.fsPath, decorationProvider);

		// Create CodeLens provider
		const codeLensProvider = new NoteCodeLensProvider(handler, folder);
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
			watcher.onDidChange(() => updateUIComponents(folder));
			watcher.onDidCreate(() => updateUIComponents(folder));
			watcher.onDidDelete(() => updateUIComponents(folder));
		}
		
		// Listen for notes changed event from handler
		handler.onNotesChanged(async () => {
			await updateUIComponents(folder);
		});
	}

	// Register tree view after all workspaces are initialized
	await treeProvider.refresh();
	const treeView = vscode.window.createTreeView("vibeNotesView", {
		treeDataProvider: treeProvider,
		showCollapseAll: true,
	});
	context.subscriptions.push(treeView);

	// Get handler for current workspace
	const getCurrentHandler = (): NoteFileHandler | undefined => {
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			return undefined;
		}

		const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
		if (!workspaceFolder) {
			return undefined;
		}

		return noteHandlers.get(workspaceFolder.uri.fsPath);
	};

	// Generate markdown file content
	const generateMarkdownFileContent = async (notes: Note[], workspaceFolder: vscode.WorkspaceFolder): Promise<string> => {
		const enhancedMarkdown = await generateEnhancedMarkdown(notes, workspaceFolder);
		const now = new Date().toLocaleString();
		
		return `> You can now fully edit this markdown file!
> - Edit existing note content
> - Add new notes
> - Delete notes  
> - Change line numbers
> Save the file (Ctrl+S / Cmd+S) to apply all changes.

Generated: ${now}

---

# Vibe Notes

${enhancedMarkdown}`;
	};
	
	// Generate enhanced markdown with clickable links
	const generateEnhancedMarkdown = async (notes: Note[], workspaceFolder: vscode.WorkspaceFolder): Promise<string> => {
		if (notes.length === 0) {
			return "*No notes found*";
		}

		// Group by file path and sort
		const groupedByFile = notes.reduce(
			(acc, note) => {
				if (!acc[note.filePath]) {
					acc[note.filePath] = [];
				}
				acc[note.filePath].push(note);
				return acc;
			},
			{} as Record<string, Note[]>,
		);

		// Sort file paths
		const sortedFilePaths = Object.keys(groupedByFile).sort();

		// Generate markdown
		const markdownSections: string[] = [];

		for (const filePath of sortedFilePaths) {
			// Try to read the file content
			let fileLines: string[] = [];
			try {
				const fullPath = path.join(workspaceFolder.uri.fsPath, filePath);
				const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(fullPath));
				fileLines = Buffer.from(fileContent).toString('utf8').split('\n');
			} catch (error) {
				// File not found or unable to read, continue without code preview
			}
			// File path header with clickable link (using relative path)
			markdownSections.push(`## [${filePath}](${filePath})`);
			markdownSections.push("");

			// Sort notes by line number
			const fileNotes = groupedByFile[filePath].sort((a, b) => a.startLine - b.startLine);

			// Each note
			for (const note of fileNotes) {
				// Create line range text
				const lineSpec = note.startLine === note.endLine 
					? `L${note.startLine}`
					: `L${note.startLine}-${note.endLine}`;

				// Get code content for all lines in the range
				const codePreviewLines = generateCodePreview(fileLines, note.startLine, note.endLine);

				// Create clickable link to specific line (using relative path)
				const lineLink = `${filePath}#L${note.startLine}`;
				
				// Line number as link
				markdownSections.push(`### [${lineSpec}](${lineLink})`);
				markdownSections.push("");
				
				// Code preview in quote block
				if (codePreviewLines.length > 0) {
					markdownSections.push(...codePreviewLines);
					markdownSections.push("");
				}
				
				markdownSections.push(note.comment);
				markdownSections.push("");
			}
		}

		// Remove the last empty line
		if (markdownSections[markdownSections.length - 1] === "") {
			markdownSections.pop();
		}

		return markdownSections.join("\n");
	};



	// Find note at current cursor position
	const findNoteAtCursor = async (): Promise<{
		note: Note | undefined;
		handler: NoteFileHandler | undefined;
		workspaceFolder: vscode.WorkspaceFolder | undefined;
	}> => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return { note: undefined, handler: undefined, workspaceFolder: undefined };
		}

		const handler = getCurrentHandler();
		if (!handler) {
			vscode.window.showErrorMessage("No workspace folder found");
			return { note: undefined, handler: undefined, workspaceFolder: undefined };
		}

		const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
		if (!workspaceFolder) {
			return { note: undefined, handler: undefined, workspaceFolder: undefined };
		}

		const relativePath = path.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath);
		const currentLine = editor.selection.active.line + 1;

		const notes = await handler.readNotes();
		const note = notes.find(
			(c) => c.filePath === relativePath && currentLine >= c.startLine && currentLine <= c.endLine,
		);

		return { note, handler, workspaceFolder };
	};

	// Common function to edit a note
	const editNote = async (
		note: Note,
		handler: NoteFileHandler,
		workspaceFolder: vscode.WorkspaceFolder,
	): Promise<void> => {
		const tempFileManager = tempFileManagers.get(workspaceFolder.uri.fsPath);
		if (!tempFileManager) {
			vscode.window.showErrorMessage("Temp file manager not found");
			return;
		}

		// Create header for the temp file
		const header = `# Edit Vibe Note
# File: ${note.filePath}
# Line: ${note.startLine === note.endLine ? note.startLine : `${note.startLine}-${note.endLine}`}
# 
# Edit your note below and save the file (Ctrl+S / Cmd+S).
# Close without saving to cancel.
# ========================================

`;

		// Open temp file for note editing
		await tempFileManager.openTempFile("EditNote", header + note.comment, async (content) => {
			if (content === null) {
				return;
			}

			// Extract note text (remove header)
			const lines = content.split("\n");
			const separatorIndex = lines.findIndex((line) => line.includes("========================================"));

			if (separatorIndex === -1 || separatorIndex >= lines.length - 1) {
				return;
			}

			const noteLines = lines.slice(separatorIndex + 1);
			const newNote = noteLines.join("\n").trim();

			if (!newNote || newNote === note.comment) {
				return;
			}

			await handler.updateNote(note, newNote);
			await updateUIComponents(workspaceFolder);
			vscode.window.showInformationMessage("Note updated successfully");
		});
	};

	// Common function to delete a note
	const deleteNote = async (
		note: Note,
		handler: NoteFileHandler,
		workspaceFolder: vscode.WorkspaceFolder,
	): Promise<void> => {
		// Confirm deletion
		const confirmation = await vscode.window.showWarningMessage("Delete this note?", "Delete", "Cancel");

		if (confirmation === "Delete") {
			await handler.deleteNote(note);
			await updateUIComponents(workspaceFolder);
		}
	};

	// Common function to find note at specific line
	const findNoteAtLine = async (
		uri: vscode.Uri,
		line: number,
	): Promise<{
		note: Note | undefined;
		handler: NoteFileHandler | undefined;
		workspaceFolder: vscode.WorkspaceFolder | undefined;
	}> => {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
		if (!workspaceFolder) {
			return { note: undefined, handler: undefined, workspaceFolder: undefined };
		}

		const handler = noteHandlers.get(workspaceFolder.uri.fsPath);
		if (!handler) {
			return { note: undefined, handler: undefined, workspaceFolder: undefined };
		}

		const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
		const notes = await handler.readNotes();
		const note = notes.find((c) => c.filePath === relativePath && line >= c.startLine && line <= c.endLine);

		return { note, handler, workspaceFolder };
	};

	// Command: Add note to line
	const addNoteCommand = vscode.commands.registerCommand("vibe-notes.addNote", async () => {
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
		const header = `# Add Vibe Note
# File: ${relativePath}
# Line: ${startLine === endLine ? startLine : `${startLine}-${endLine}`}
# 
# Enter your note below and save the file (Ctrl+S / Cmd+S).
# Close without saving to cancel.
# ========================================

`;

		// Open temp file for note input
		await tempFileManager.openTempFile("AddNote", header, async (content) => {
			if (content === null) {
				return;
			}

			// Extract note text (remove header)
			const lines = content.split("\n");
			const separatorIndex = lines.findIndex((line) => line.includes("========================================"));

			if (separatorIndex === -1 || separatorIndex >= lines.length - 1) {
				return;
			}

			const noteLines = lines.slice(separatorIndex + 1);
			const note = noteLines.join("\n").trim();

			if (!note) {
				return;
			}

			await handler.addNote(relativePath, startLine, endLine, note);
			await updateUIComponents(workspaceFolder);
			vscode.window.showInformationMessage("Note added successfully");
		});
	});

	// Command: Open as markdown (temporary file)
	const showMarkdownCommand = vscode.commands.registerCommand("vibe-notes.showMarkdown", async () => {
		// Get handler and workspace folder for copy operation
		let workspaceFolder: vscode.WorkspaceFolder | undefined;
		let handler: NoteFileHandler | undefined;

		// First try to get based on active editor
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
			if (workspaceFolder) {
				handler = noteHandlers.get(workspaceFolder.uri.fsPath);
			}
		}

		// If no active editor, use first workspace
		if (!handler && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			workspaceFolder = vscode.workspace.workspaceFolders[0];
			handler = noteHandlers.get(workspaceFolder.uri.fsPath);
		}

		if (!handler || !workspaceFolder) {
			vscode.window.showErrorMessage("No workspace folder found");
			return;
		}

		// Generate enhanced markdown content
		const notes = await handler.readNotes();
		const markdownContent = await generateMarkdownFileContent(notes, workspaceFolder);

		// Write to .notes.local.md in workspace root
		const markdownPath = path.join(workspaceFolder.uri.fsPath, '.notes.local.md');
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

	// Command: Go to note
	const goToNoteCommand = vscode.commands.registerCommand(
		"vibe-notes.goToNote",
		async (note: any, workspaceFolder?: vscode.WorkspaceFolder) => {
			if (!note || !note.filePath) {
				return;
			}

			// Use provided workspace folder or default to first one
			const folder = workspaceFolder || vscode.workspace.workspaceFolders?.[0];
			if (!folder) {
				return;
			}

			const fullPath = path.join(folder.uri.fsPath, note.filePath);
			const document = await vscode.workspace.openTextDocument(fullPath);
			const editor = await vscode.window.showTextDocument(document);

			// Navigate to the note position
			const position = new vscode.Position(note.startLine - 1, 0);
			const range = new vscode.Range(position, position);
			editor.selection = new vscode.Selection(position, position);
			editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
		},
	);

	// Command: Edit note at current position
	const editNoteAtCursorCommand = vscode.commands.registerCommand(
		"vibe-notes.editNoteAtCursor",
		async () => {
			const { note, handler, workspaceFolder } = await findNoteAtCursor();

			if (!note || !handler || !workspaceFolder) {
				if (note === undefined && handler && workspaceFolder) {
					vscode.window.showInformationMessage("No note found at current line");
				}
				return;
			}

			await editNote(note, handler, workspaceFolder);
		},
	);

	// Command: Delete note at current position
	const deleteNoteAtCursorCommand = vscode.commands.registerCommand(
		"vibe-notes.deleteNoteAtCursor",
		async () => {
			const { note, handler, workspaceFolder } = await findNoteAtCursor();

			if (!note || !handler || !workspaceFolder) {
				if (note === undefined && handler && workspaceFolder) {
					vscode.window.showInformationMessage("No note found at current line");
				}
				return;
			}

			await deleteNote(note, handler, workspaceFolder);
		},
	);

	// Command: Edit note at specific line (for CodeLens)
	const editNoteAtLineCommand = vscode.commands.registerCommand(
		"vibe-notes.editNoteAtLine",
		async (uri: vscode.Uri, line: number) => {
			const { note, handler, workspaceFolder } = await findNoteAtLine(uri, line);
			if (note && handler && workspaceFolder) {
				await editNote(note, handler, workspaceFolder);
			}
		},
	);

	// Command: Delete note at specific line (for CodeLens)
	const deleteNoteAtLineCommand = vscode.commands.registerCommand(
		"vibe-notes.deleteNoteAtLine",
		async (uri: vscode.Uri, line: number) => {
			const { note, handler, workspaceFolder } = await findNoteAtLine(uri, line);
			if (note && handler && workspaceFolder) {
				await deleteNote(note, handler, workspaceFolder);
			}
		},
	);

	// Command: Refresh tree view
	const refreshTreeCommand = vscode.commands.registerCommand("vibe-notes.refreshTree", async () => {
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			const workspaceFolder = vscode.workspace.workspaceFolders[0];
			const markdownPath = path.join(workspaceFolder.uri.fsPath, '.notes.local.md');
			
			try {
				// Check if markdown file exists
				await vscode.workspace.fs.stat(vscode.Uri.file(markdownPath));
				
				// If markdown exists, regenerate it (this will trigger TreeView refresh via watcher)
				const handler = noteHandlers.get(workspaceFolder.uri.fsPath);
				if (handler) {
					const notes = await handler.readNotes();
					const markdownContent = await generateMarkdownFileContent(notes, workspaceFolder);
					
					await vscode.workspace.fs.writeFile(
						vscode.Uri.file(markdownPath), 
						Buffer.from(markdownContent, 'utf8')
					);
				}
			} catch {
				// Markdown file doesn't exist, refresh TreeView directly
				await treeProvider.refresh();
			}
		} else {
			// No workspace, just refresh TreeView
			await treeProvider.refresh();
		}
		
		vscode.window.showInformationMessage("View refreshed");
	});

	// Command: Save to Git Notes
	const saveToGitNotesCommand = vscode.commands.registerCommand("vibe-notes.saveToGitNotes", async () => {
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
		const handler = noteHandlers.get(workspaceFolder.uri.fsPath);
		if (!handler) {
			vscode.window.showErrorMessage("No memo handler found");
			return;
		}

		try {
			// Read the current notes
			const notes = await handler.readNotes();
			if (notes.length === 0) {
				vscode.window.showInformationMessage("No notes to save");
				return;
			}

			// Show confirmation dialog
			const confirmation = await vscode.window.showWarningMessage(
				"Save notes to Git Notes? This will overwrite any existing notes on the current HEAD commit.",
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

			vscode.window.showInformationMessage("Notes saved to git notes");
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to save to git notes: ${error}`);
		}
	});

	// Command: Setup .gitignore
	const setupGitignoreCommand = vscode.commands.registerCommand("vibe-notes.setupGitignore", async () => {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			vscode.window.showErrorMessage("No workspace folder found");
			return;
		}

		await promptGitignoreSetup(workspaceFolder);
	});

	// Command: Copy for LLM Agent
	const copyForLLMCommand = vscode.commands.registerCommand("vibe-notes.copyForLLM", async () => {
		// Get handler and workspace folder
		let workspaceFolder: vscode.WorkspaceFolder | undefined;
		let handler: NoteFileHandler | undefined;

		// First try to get based on active editor
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
			if (workspaceFolder) {
				handler = noteHandlers.get(workspaceFolder.uri.fsPath);
			}
		}

		// If no active editor, use first workspace
		if (!handler && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			workspaceFolder = vscode.workspace.workspaceFolders[0];
			handler = noteHandlers.get(workspaceFolder.uri.fsPath);
		}

		if (!handler || !workspaceFolder) {
			vscode.window.showErrorMessage("No workspace folder found");
			return;
		}

		// Get all notes
		const notes = await handler.readNotes();
		if (notes.length === 0) {
			vscode.window.showInformationMessage("No notes found");
			return;
		}

		// Generate enhanced markdown content for LLM
		const enhancedMarkdown = await generateEnhancedMarkdown(notes, workspaceFolder);
		
		// Get user's configured prompt (defaults to value in package.json if not set)
		const config = vscode.workspace.getConfiguration('vibe-notes');
		const prompt = config.get<string>('copyForLLMPrompt');
		
		// Add prompt only if not empty
		const llmContent = prompt ? `${prompt}\n\n${enhancedMarkdown}` : enhancedMarkdown;
		
		// Copy to clipboard
		await vscode.env.clipboard.writeText(llmContent);
		vscode.window.showInformationMessage(`Copied ${notes.length} notes for LLM Agent`);
	});

	// Register all commands
	context.subscriptions.push(
		addNoteCommand,
		showMarkdownCommand,
		goToNoteCommand,
		editNoteAtCursorCommand,
		deleteNoteAtCursorCommand,
		editNoteAtLineCommand,
		deleteNoteAtLineCommand,
		refreshTreeCommand,
		saveToGitNotesCommand,
		setupGitignoreCommand,
		copyForLLMCommand,
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
			noteHandlers.forEach((handler) => {
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
