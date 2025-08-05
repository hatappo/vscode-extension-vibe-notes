import * as vscode from "vscode";
import * as path from "path";
import { NoteFileHandler } from "../notes/NoteFileHandler";
import { MultiWorkspaceTreeProvider } from "../ui/MultiWorkspaceTreeProvider";
import { MarkdownFileManager } from "../formatting/MarkdownFileManager";
import { getHandlerWithWorkspace } from "../notes/NoteFinder";
import { EditorNavigator } from "../util/EditorNavigator";

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
		// Get handler and workspace folder
		const { handler, workspaceFolder } = getHandlerWithWorkspace(noteHandlers);

		if (!handler || !workspaceFolder) {
			vscode.window.showErrorMessage("No workspace folder found");
			return;
		}

		try {
			// Generate and show markdown
			await MarkdownFileManager.generateAndShowMarkdown(handler, workspaceFolder);
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

			// Handle General Notes - open markdown file
			if (note.filePath === "/") {
				const markdownPath = MarkdownFileManager.getMarkdownPath(folder);
				
				try {
					const editor = await MarkdownFileManager.openMarkdownFile(markdownPath);
					
					// Scroll to top
					EditorNavigator.navigateToTop(editor);
				} catch (error) {
					vscode.window.showErrorMessage("Markdown file not found. Please use 'Open as Markdown' first.");
				}
				return;
			}

			const fullPath = path.join(folder.uri.fsPath, note.filePath);
			const document = await vscode.workspace.openTextDocument(fullPath);
			const editor = await vscode.window.showTextDocument(document);

			// Navigate to the note position
			EditorNavigator.navigateToLine(editor, note.startLine - 1);
		},
	);

	// Command: Refresh tree view
	const refreshTreeCommand = vscode.commands.registerCommand("vibe-notes.refreshTree", async () => {
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			const workspaceFolder = vscode.workspace.workspaceFolders[0];
			const markdownPath = MarkdownFileManager.getMarkdownPath(workspaceFolder);

			try {
				// Check if markdown file exists
				await vscode.workspace.fs.stat(vscode.Uri.file(markdownPath));

				// If markdown exists, regenerate it (this will trigger TreeView refresh via watcher)
				const handler = noteHandlers.get(workspaceFolder.uri.fsPath);
				if (handler) {
					await MarkdownFileManager.generateAndSaveMarkdown(handler, workspaceFolder);
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
