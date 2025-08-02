import * as vscode from "vscode";
import { Note } from "../util/noteParser";
import { NoteFileHandler } from "../util/noteFileHandler";
import { TempFileManager } from "../util/tempFileManager";

/**
 * Edit a note using a temporary file
 * @param note The note to edit
 * @param handler The NoteFileHandler for the workspace
 * @param workspaceFolder The workspace folder
 * @param tempFileManagers Map of workspace paths to TempFileManagers
 * @param updateUIComponents Function to update UI components
 */
export async function editNote(
	note: Note,
	handler: NoteFileHandler,
	workspaceFolder: vscode.WorkspaceFolder,
	tempFileManagers: Map<string, TempFileManager>,
	updateUIComponents: (workspaceFolder: vscode.WorkspaceFolder) => Promise<void>
): Promise<void> {
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
}

/**
 * Delete a note with confirmation
 * @param note The note to delete
 * @param handler The NoteFileHandler for the workspace
 * @param workspaceFolder The workspace folder
 * @param updateUIComponents Function to update UI components
 */
export async function deleteNote(
	note: Note,
	handler: NoteFileHandler,
	workspaceFolder: vscode.WorkspaceFolder,
	updateUIComponents: (workspaceFolder: vscode.WorkspaceFolder) => Promise<void>
): Promise<void> {
	// Confirm deletion
	const confirmation = await vscode.window.showWarningMessage("Delete this note?", "Delete", "Cancel");

	if (confirmation === "Delete") {
		await handler.deleteNote(note);
		await updateUIComponents(workspaceFolder);
	}
}