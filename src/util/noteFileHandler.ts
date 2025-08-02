import * as vscode from "vscode";
import * as path from "path";
import { promises as fs } from "fs";
import { parseNoteFileWithErrors, Note } from "./noteParser";
import { parseMarkdownToNotes, ParsedNote } from "./markdownParser";
import { promptGitignoreSetup } from "./gitignoreHelper";

export class NoteFileHandler {
	private static readonly NOTES_DIR = ".notes";
	private static readonly DEFAULT_NOTE_FILE = "data.txt";
	private static readonly MARKDOWN_FILE = ".notes.local.md";
	private noteFilePath: string;
	private markdownFilePath: string;
	private fileWatcher: vscode.FileSystemWatcher | undefined;
	private markdownWatcher: vscode.FileSystemWatcher | undefined;
	private isUpdatingFromMarkdown = false;
	private _onNotesChanged = new vscode.EventEmitter<void>();
	public readonly onNotesChanged = this._onNotesChanged.event;

	constructor(private workspaceFolder: vscode.WorkspaceFolder) {
		// Data file in .notes directory
		this.noteFilePath = path.join(
			workspaceFolder.uri.fsPath,
			NoteFileHandler.NOTES_DIR,
			NoteFileHandler.DEFAULT_NOTE_FILE,
		);
		// Markdown file in workspace root for user editing
		this.markdownFilePath = path.join(workspaceFolder.uri.fsPath, NoteFileHandler.MARKDOWN_FILE);
	}

	/**
	 * Initialize the note file handler and set up file watching
	 */
	async initialize(): Promise<void> {
		// Ensure notes directory exists for temp files
		await this.ensureNotesDirectory();

		// Set up file watcher (even if file doesn't exist yet)
		const pattern = new vscode.RelativePattern(
			this.workspaceFolder,
			path.join(NoteFileHandler.NOTES_DIR, NoteFileHandler.DEFAULT_NOTE_FILE),
		);
		this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

		// Set up markdown file watcher
		const markdownPattern = new vscode.RelativePattern(this.workspaceFolder, NoteFileHandler.MARKDOWN_FILE);
		this.markdownWatcher = vscode.workspace.createFileSystemWatcher(markdownPattern);

		// Handle markdown file changes
		this.markdownWatcher.onDidChange(async () => {
			if (!this.isUpdatingFromMarkdown) {
				await this.syncFromMarkdown();
			}
		});
	}

	/**
	 * Ensure notes directory exists (needed for temp files)
	 */
	private async ensureNotesDirectory(): Promise<void> {
		const notesDir = path.join(this.workspaceFolder.uri.fsPath, NoteFileHandler.NOTES_DIR);
		try {
			await fs.mkdir(notesDir, { recursive: true });
		} catch (error) {
			// Directory might already exist, which is fine
		}
	}

	/**
	 * Format line specification
	 */
	private formatLineSpec(startLine: number, endLine: number): string {
		if (startLine === endLine) {
			return `${startLine}`;
		} else {
			return `${startLine}-${endLine}`;
		}
	}

	/**
	 * Escape note text for storage
	 */
	private escapeNote(note: string): string {
		return note.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
	}

	/**
	 * Read all notes from the note file
	 */
	public async readNotes(): Promise<Note[]> {
		try {
			// Check if file exists first
			try {
				await fs.access(this.noteFilePath);
			} catch {
				// File doesn't exist yet, return empty array
				return [];
			}

			const content = await fs.readFile(this.noteFilePath, "utf8");
			const result = parseNoteFileWithErrors(content);

			if (result.errors && result.errors.length > 0) {
				const errorMessage = result.errors.map((e: any) => `Line ${e.line}: ${e.error}`).join("\n");
				vscode.window.showWarningMessage(`Some notes could not be parsed:\n${errorMessage}`);
			}

			return result.notes || [];
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to read note file: ${error}`);
			return [];
		}
	}

	/**
	 * Add a new note to the note file
	 */
	async addNote(filePath: string, startLine: number, endLine: number, note: string): Promise<void> {
		try {
			// Ensure notes directory exists
			await this.ensureNotesDirectory();

			// Read existing content, or use empty string if file doesn't exist
			let content = "";
			let isFirstNote = false;
			try {
				content = await fs.readFile(this.noteFilePath, "utf8");
			} catch {
				// File doesn't exist yet, will be created
				isFirstNote = true;
			}

			// Format the new note with new format
			const lineSpec = this.formatLineSpec(startLine, endLine);
			const escapedNote = this.escapeNote(note);
			const newLine = `${filePath}#L${lineSpec} "${escapedNote}"`;

			// Append to file
			const newContent = content.trim() ? `${content.trim()}\n${newLine}\n` : `${newLine}\n`;
			await fs.writeFile(this.noteFilePath, newContent, "utf8");

			vscode.window.showInformationMessage("Note added successfully");

			// Prompt for .gitignore setup on first note
			if (isFirstNote) {
				// Run async without waiting
				promptGitignoreSetup(this.workspaceFolder);
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to add note: ${error}`);
		}
	}

	/**
	 * Update an existing note
	 */
	async updateNote(oldNote: Note, newNoteText: string): Promise<void> {
		try {
			const content = await fs.readFile(this.noteFilePath, "utf8");
			const lines = content.split("\n");

			// Find and replace the line
			const updatedLines = lines.map((line) => {
				if (line.trim() === oldNote.raw) {
					const lineSpec = this.formatLineSpec(oldNote.startLine, oldNote.endLine);
					const escapedNote = this.escapeNote(newNoteText);
					return `${oldNote.filePath}#L${lineSpec} "${escapedNote}"`;
				}
				return line;
			});

			await fs.writeFile(this.noteFilePath, updatedLines.join("\n"), "utf8");
			vscode.window.showInformationMessage("Note updated successfully");
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to update note: ${error}`);
		}
	}

	/**
	 * Delete a note
	 */
	async deleteNote(note: Note): Promise<void> {
		try {
			const content = await fs.readFile(this.noteFilePath, "utf8");
			const lines = content.split("\n");

			// Filter out the note line
			const updatedLines = lines.filter((line) => line.trim() !== note.raw);

			await fs.writeFile(this.noteFilePath, updatedLines.join("\n"), "utf8");
			vscode.window.showInformationMessage("Note deleted successfully");
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to delete note: ${error}`);
		}
	}

	/**
	 * Get notes for a specific file
	 */
	async getNotesForFile(filePath: string): Promise<Note[]> {
		const allNotes = await this.readNotes();
		const relativePath = path.relative(this.workspaceFolder.uri.fsPath, filePath);
		return allNotes.filter((note) => note.filePath === relativePath);
	}

	/**
	 * Get file watcher
	 */
	getFileWatcher(): vscode.FileSystemWatcher | undefined {
		return this.fileWatcher;
	}

	/**
	 * Get raw content
	 */
	async getRawContent(): Promise<string> {
		try {
			const content = await fs.readFile(this.noteFilePath, "utf8");
			return content;
		} catch {
			// File doesn't exist yet
			return "";
		}
	}

	/**
	 * Replace all notes with new ones
	 */
	async replaceAllNotes(newNotes: ParsedNote[]): Promise<void> {
		try {
			// Build new file content
			const lines: string[] = [];

			for (const note of newNotes) {
				const lineSpec = this.formatLineSpec(note.startLine, note.endLine);
				const escapedNote = this.escapeNote(note.comment);
				lines.push(`${note.filePath}#L${lineSpec} "${escapedNote}"`);
			}

			// Write to file
			const content = lines.join("\n") + (lines.length > 0 ? "\n" : "");
			await fs.writeFile(this.noteFilePath, content, "utf8");
		} catch (error) {
			throw new Error(`Failed to replace notes: ${error}`);
		}
	}

	/**
	 * Sync changes from markdown file to notes file
	 */
	private async syncFromMarkdown(): Promise<void> {
		try {
			// Check if markdown file exists
			try {
				await fs.access(this.markdownFilePath);
			} catch {
				// Markdown file doesn't exist, nothing to sync
				return;
			}

			// Read markdown file
			const markdownContent = await fs.readFile(this.markdownFilePath, "utf8");

			// Parse markdown to get all notes
			const { notes, errors } = parseMarkdownToNotes(markdownContent);

			// Check for errors
			if (errors.length > 0) {
				vscode.window.showErrorMessage(`Failed to parse markdown: ${errors.length} error(s)\n${errors.join("\n")}`);
				return;
			}

			// Replace all notes
			this.isUpdatingFromMarkdown = true;
			try {
				await this.replaceAllNotes(notes);
				vscode.window.showInformationMessage(`Updated notes from markdown: ${notes.length} note(s)`);

				// Emit event to update UI
				this._onNotesChanged.fire();
			} finally {
				this.isUpdatingFromMarkdown = false;
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to sync from markdown: ${error}`);
		}
	}

	/**
	 * Get markdown file watcher
	 */
	getMarkdownWatcher(): vscode.FileSystemWatcher | undefined {
		return this.markdownWatcher;
	}

	/**
	 * Dispose resources
	 */
	dispose(): void {
		this.fileWatcher?.dispose();
		this.markdownWatcher?.dispose();
		this._onNotesChanged.dispose();
	}
}
