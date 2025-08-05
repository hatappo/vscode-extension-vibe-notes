import * as vscode from "vscode";
import * as path from "path";
import { NoteFileHandler } from "../notes/NoteFileHandler";
import { TempFileManager } from "../workspace/TempFileManager";
import { getCurrentHandler, findNoteAtCursor, findNoteAtLine } from "../notes/NoteFinder";
import { editNote, deleteNote } from "./noteOperations";
import { MarkdownFileManager } from "../formatting/MarkdownFileManager";
import { EditorNavigator } from "../util/EditorNavigator";

/**
 * Register all note-related commands
 */
export function registerNoteCommands(
	context: vscode.ExtensionContext,
	noteHandlers: Map<string, NoteFileHandler>,
	tempFileManagers: Map<string, TempFileManager>,
	updateUIComponents: (workspaceFolder: vscode.WorkspaceFolder) => Promise<void>,
) {
	// Command: Add note to line
	const addNoteCommand = vscode.commands.registerCommand("vibe-notes.addNote", async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage("No active editor");
			return;
		}

		const handler = getCurrentHandler(noteHandlers);
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
		const header = `<!-- 
Add Vibe Note
File: ${relativePath}
Line: ${startLine === endLine ? startLine : `${startLine}-${endLine}`}

Enter your note below and save the file (Ctrl+S / Cmd+S).
Close without saving to cancel.
-->

`;

		// Open temp file for note input
		await tempFileManager.openTempFile("AddNote", header, async (content) => {
			if (content === null) {
				return;
			}

			// Extract note text (remove header)
			const commentEndIndex = content.indexOf("-->");
			
			if (commentEndIndex === -1) {
				return;
			}

			// Extract content after the comment
			const noteContent = content.substring(commentEndIndex + 3); // +3 for "-->"
			const note = noteContent.trim();

			if (!note) {
				return;
			}

			await handler.addNote(relativePath, startLine, endLine, note);
			await updateUIComponents(workspaceFolder);
			vscode.window.showInformationMessage("Note added successfully");
		});
	});

	// Command: Edit note at cursor
	const editNoteAtCursorCommand = vscode.commands.registerCommand("vibe-notes.editNoteAtCursor", async () => {
		const { note, handler, workspaceFolder } = await findNoteAtCursor(noteHandlers);

		if (!note || !handler || !workspaceFolder) {
			vscode.window.showInformationMessage("No note found at cursor");
			return;
		}

		await editNote(note, handler, workspaceFolder, tempFileManagers, updateUIComponents);
	});

	// Command: Delete note at cursor
	const deleteNoteAtCursorCommand = vscode.commands.registerCommand("vibe-notes.deleteNoteAtCursor", async () => {
		const { note, handler, workspaceFolder } = await findNoteAtCursor(noteHandlers);

		if (!note || !handler || !workspaceFolder) {
			vscode.window.showInformationMessage("No note found at cursor");
			return;
		}

		await deleteNote(note, handler, workspaceFolder, updateUIComponents);
	});

	// Command: Edit note at line (for CodeLens)
	const editNoteAtLineCommand = vscode.commands.registerCommand(
		"vibe-notes.editNoteAtLine",
		async (uri: vscode.Uri, line: number) => {
			const { note, handler, workspaceFolder } = await findNoteAtLine(uri, line, noteHandlers);
			if (note && handler && workspaceFolder) {
				await editNote(note, handler, workspaceFolder, tempFileManagers, updateUIComponents);
			}
		},
	);

	// Command: Delete note at line (for CodeLens)
	const deleteNoteAtLineCommand = vscode.commands.registerCommand(
		"vibe-notes.deleteNoteAtLine",
		async (uri: vscode.Uri, line: number) => {
			const { note, handler, workspaceFolder } = await findNoteAtLine(uri, line, noteHandlers);
			if (note && handler && workspaceFolder) {
				await deleteNote(note, handler, workspaceFolder, updateUIComponents);
			}
		},
	);

	// Command: Edit note as markdown at line (for CodeLens)
	const editNoteAtLineAsMarkdownCommand = vscode.commands.registerCommand(
		"vibe-notes.editNoteAtLineAsMarkdown",
		async (uri: vscode.Uri, line: number) => {
			const { note, handler, workspaceFolder } = await findNoteAtLine(uri, line, noteHandlers);
			if (!note || !handler || !workspaceFolder) {
				vscode.window.showInformationMessage("No note found at line");
				return;
			}

			try {
				// Generate and save markdown
				const markdownPath = await MarkdownFileManager.generateAndSaveMarkdown(handler, workspaceFolder);
				
				// Open the file
				const editor = await MarkdownFileManager.openMarkdownFile(markdownPath);
				
				// Get the content to search for the note
				const markdownContent = editor.document.getText();
				
				// Find the note in the markdown
				const targetLine = MarkdownFileManager.findNoteInMarkdown(markdownContent, note);
				
				if (targetLine !== -1) {
					// Navigate to the note position
					EditorNavigator.navigateToLine(editor, targetLine);
				}
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to create markdown file: ${error}`);
			}
		},
	);

	// Register all commands
	context.subscriptions.push(
		addNoteCommand,
		editNoteAtCursorCommand,
		deleteNoteAtCursorCommand,
		editNoteAtLineCommand,
		deleteNoteAtLineCommand,
		editNoteAtLineAsMarkdownCommand,
	);
}
