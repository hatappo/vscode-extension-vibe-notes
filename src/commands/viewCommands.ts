import * as vscode from "vscode";
import * as path from "path";
import { NoteFileHandler } from "../util/noteFileHandler";
import { MultiWorkspaceTreeProvider } from "../views/multiWorkspaceTreeProvider";
import { generateMarkdownFileContent } from "../util/markdownGenerator";

/**
 * Register all view-related commands
 */
export function registerViewCommands(
	context: vscode.ExtensionContext,
	noteHandlers: Map<string, NoteFileHandler>,
	treeProvider: MultiWorkspaceTreeProvider,
) {
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
		const markdownPath = path.join(workspaceFolder.uri.fsPath, ".notes.local.md");
		const markdownUri = vscode.Uri.file(markdownPath);

		try {
			// Write the markdown file
			await vscode.workspace.fs.writeFile(markdownUri, Buffer.from(markdownContent, "utf8"));

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

	// Command: Refresh tree view
	const refreshTreeCommand = vscode.commands.registerCommand("vibe-notes.refreshTree", async () => {
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			const workspaceFolder = vscode.workspace.workspaceFolders[0];
			const markdownPath = path.join(workspaceFolder.uri.fsPath, ".notes.local.md");

			try {
				// Check if markdown file exists
				await vscode.workspace.fs.stat(vscode.Uri.file(markdownPath));

				// If markdown exists, regenerate it (this will trigger TreeView refresh via watcher)
				const handler = noteHandlers.get(workspaceFolder.uri.fsPath);
				if (handler) {
					const notes = await handler.readNotes();
					const markdownContent = await generateMarkdownFileContent(notes, workspaceFolder);

					await vscode.workspace.fs.writeFile(vscode.Uri.file(markdownPath), Buffer.from(markdownContent, "utf8"));
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

	// Register all commands
	context.subscriptions.push(showMarkdownCommand, goToNoteCommand, refreshTreeCommand);
}
