import * as vscode from "vscode";
import * as path from "path";
import { Note } from "./noteParser";
import { NoteFileHandler } from "./noteFileHandler";

/**
 * Result type for note finding operations
 */
export interface FindNoteResult {
	note: Note | undefined;
	handler: NoteFileHandler | undefined;
	workspaceFolder: vscode.WorkspaceFolder | undefined;
}

/**
 * Get the current NoteFileHandler based on active editor
 * @param noteHandlers Map of workspace paths to NoteFileHandlers
 * @returns The NoteFileHandler for the current workspace or undefined
 */
export function getCurrentHandler(noteHandlers: Map<string, NoteFileHandler>): NoteFileHandler | undefined {
	const activeEditor = vscode.window.activeTextEditor;
	if (!activeEditor) {
		return undefined;
	}

	const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
	if (!workspaceFolder) {
		return undefined;
	}

	return noteHandlers.get(workspaceFolder.uri.fsPath);
}

/**
 * Find note at current cursor position
 * @param noteHandlers Map of workspace paths to NoteFileHandlers
 * @returns Note finding result with note, handler, and workspace folder
 */
export async function findNoteAtCursor(noteHandlers: Map<string, NoteFileHandler>): Promise<FindNoteResult> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return { note: undefined, handler: undefined, workspaceFolder: undefined };
	}

	const handler = getCurrentHandler(noteHandlers);
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
}

/**
 * Find note at specific line in a file
 * @param uri File URI
 * @param line Line number (1-based)
 * @param noteHandlers Map of workspace paths to NoteFileHandlers
 * @returns Note finding result with note, handler, and workspace folder
 */
export async function findNoteAtLine(
	uri: vscode.Uri,
	line: number,
	noteHandlers: Map<string, NoteFileHandler>
): Promise<FindNoteResult> {
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
}