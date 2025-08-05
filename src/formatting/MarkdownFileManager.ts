import * as vscode from "vscode";
import * as path from "path";
import { Note } from "../notes/NoteParser";
import { NoteFileHandler } from "../notes/NoteFileHandler";
import { generateMarkdownFileContent } from "./MarkdownGenerator";

export class MarkdownFileManager {
	private static readonly MARKDOWN_FILENAME = ".notes.local.md";

	/**
	 * Generate and save markdown file for the given notes
	 * @param handler The NoteFileHandler to read notes from
	 * @param workspaceFolder The workspace folder
	 * @returns The path to the generated markdown file
	 */
	static async generateAndSaveMarkdown(
		handler: NoteFileHandler,
		workspaceFolder: vscode.WorkspaceFolder,
	): Promise<string> {
		// Read notes
		const notes = await handler.readNotes();
		
		// Generate markdown content
		const markdownContent = await generateMarkdownFileContent(notes, workspaceFolder);
		
		// Get markdown file path
		const markdownPath = path.join(workspaceFolder.uri.fsPath, this.MARKDOWN_FILENAME);
		const markdownUri = vscode.Uri.file(markdownPath);
		
		// Write the markdown file
		await vscode.workspace.fs.writeFile(markdownUri, Buffer.from(markdownContent, "utf8"));
		
		return markdownPath;
	}

	/**
	 * Open markdown file in editor
	 * @param markdownPath Path to the markdown file
	 * @returns The text editor showing the markdown
	 */
	static async openMarkdownFile(markdownPath: string): Promise<vscode.TextEditor> {
		const markdownUri = vscode.Uri.file(markdownPath);
		const doc = await vscode.workspace.openTextDocument(markdownUri);
		return await vscode.window.showTextDocument(doc);
	}

	/**
	 * Generate, save and open markdown file
	 * @param handler The NoteFileHandler to read notes from
	 * @param workspaceFolder The workspace folder
	 * @returns The text editor showing the markdown
	 */
	static async generateAndShowMarkdown(
		handler: NoteFileHandler,
		workspaceFolder: vscode.WorkspaceFolder,
	): Promise<vscode.TextEditor> {
		const markdownPath = await this.generateAndSaveMarkdown(handler, workspaceFolder);
		return await this.openMarkdownFile(markdownPath);
	}

	/**
	 * Find a note's position in the markdown content
	 * @param markdownContent The markdown content to search in
	 * @param note The note to find
	 * @returns The line number where the note is found, or -1 if not found
	 */
	static findNoteInMarkdown(markdownContent: string, note: Note): number {
		const lines = markdownContent.split('\n');
		const noteIdentifier = `${note.filePath}#L${note.startLine}`;
		
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].includes(noteIdentifier)) {
				// Found the note identifier, look for the comment on the next lines
				for (let j = i + 1; j < lines.length && j < i + 5; j++) {
					if (lines[j].trim().startsWith(note.comment.trim().substring(0, 20))) {
						return j;
					}
				}
				return i;
			}
		}
		
		return -1;
	}

	/**
	 * Get the markdown file path for a workspace
	 * @param workspaceFolder The workspace folder
	 * @returns The markdown file path
	 */
	static getMarkdownPath(workspaceFolder: vscode.WorkspaceFolder): string {
		return path.join(workspaceFolder.uri.fsPath, this.MARKDOWN_FILENAME);
	}
}