import * as vscode from "vscode";
import * as path from "path";
import { NoteFileHandler } from "../notes/NoteFileHandler";
import { Note } from "../notes/NoteParser";

export class NoteDecorationManager {
	private gutterDecorationType: vscode.TextEditorDecorationType;
	private inlineDecorationTypes = new Map<string, vscode.TextEditorDecorationType>();
	private decorations = new Map<string, vscode.DecorationOptions[]>();
	private inlineDecorations = new Map<
		string,
		{ decoration: vscode.DecorationOptions; type: vscode.TextEditorDecorationType }[]
	>();

	constructor(
		private noteHandler: NoteFileHandler,
		private workspaceFolder: vscode.WorkspaceFolder,
	) {
		// Create gutter decoration type
		this.gutterDecorationType = vscode.window.createTextEditorDecorationType({
			gutterIconPath: vscode.Uri.parse(
				'data:image/svg+xml;utf8,<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 10 6 A 3 3 0 1 0 10 10" stroke="%234285f4" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
			),
			gutterIconSize: "contain",
			overviewRulerColor: "#4285f4",
			overviewRulerLane: vscode.OverviewRulerLane.Right,
		});
	}

	/**
	 * Update decorations for all visible editors
	 */
	async updateDecorations(): Promise<void> {
		const notes = await this.noteHandler.readNotes();
		this.decorations.clear();
		this.inlineDecorations.clear();

		// Dispose old inline decoration types
		for (const decorationType of this.inlineDecorationTypes.values()) {
			decorationType.dispose();
		}
		this.inlineDecorationTypes.clear();

		// Group notes by file
		for (const note of notes) {
			// Skip General Notes
			if (note.filePath === "/") {
				continue;
			}
			
			const filePath = path.join(this.workspaceFolder.uri.fsPath, note.filePath);
			if (!this.decorations.has(filePath)) {
				this.decorations.set(filePath, []);
				this.inlineDecorations.set(filePath, []);
			}

			// Create gutter decoration for the first line only
			const gutterDecoration: vscode.DecorationOptions = {
				range: new vscode.Range(note.startLine - 1, 0, note.startLine - 1, 0),
			};
			this.decorations.get(filePath)!.push(gutterDecoration);

			// Create inline decoration for the first line
			const lines = note.comment.split("\n");
			const firstLineText = lines[0];
			const isMultiline = lines.length > 1;
			const truncatedText = firstLineText.length > 40 ? firstLineText.substring(0, 40) + ".." : firstLineText;
			const displayText = `💬 ${truncatedText}${isMultiline ? " .. " : ""}`;

			// Create a unique decoration type for this note
			const decorationKey = `${filePath}:${note.startLine}`;
			const inlineDecorationType = vscode.window.createTextEditorDecorationType({
				after: {
					contentText: displayText,
					color: "#999999",
					margin: "0 0 0 1em",
					fontStyle: "italic",
				},
				isWholeLine: true,
			});
			this.inlineDecorationTypes.set(decorationKey, inlineDecorationType);

			// Get the editor to find the line end position
			const editor = vscode.window.visibleTextEditors.find((e) => e.document.uri.fsPath === filePath);
			if (editor) {
				const line = editor.document.lineAt(note.startLine - 1);
				const inlineDecoration: vscode.DecorationOptions = {
					range: new vscode.Range(note.startLine - 1, line.text.length, note.startLine - 1, line.text.length),
					hoverMessage: new vscode.MarkdownString(`**Note:**\n\n${note.comment.replace(/\n/g, "  \n")}`),
				};
				this.inlineDecorations.get(filePath)!.push({ decoration: inlineDecoration, type: inlineDecorationType });
			}
		}

		// Apply decorations to visible editors
		for (const editor of vscode.window.visibleTextEditors) {
			const gutterDecorations = this.decorations.get(editor.document.uri.fsPath) || [];
			editor.setDecorations(this.gutterDecorationType, gutterDecorations);

			// Apply inline decorations
			const inlineDecorationsData = this.inlineDecorations.get(editor.document.uri.fsPath) || [];
			for (const { decoration, type } of inlineDecorationsData) {
				editor.setDecorations(type, [decoration]);
			}
		}
	}

	/**
	 * Apply decorations to a specific editor
	 */
	applyDecorationsToEditor(editor: vscode.TextEditor): void {
		const gutterDecorations = this.decorations.get(editor.document.uri.fsPath) || [];
		editor.setDecorations(this.gutterDecorationType, gutterDecorations);

		// Apply inline decorations
		const inlineDecorationsData = this.inlineDecorations.get(editor.document.uri.fsPath) || [];
		for (const { decoration, type } of inlineDecorationsData) {
			editor.setDecorations(type, [decoration]);
		}
	}

	/**
	 * Get comment at specific position
	 */
	async getNoteAtPosition(document: vscode.TextDocument, position: vscode.Position): Promise<Note | undefined> {
		const relativePath = path.relative(this.workspaceFolder.uri.fsPath, document.uri.fsPath);
		const notes = await this.noteHandler.getNotesForFile(document.uri.fsPath);
		const lineNumber = position.line + 1; // Convert to 1-based

		return notes.find(
			(note) => note.filePath === relativePath && lineNumber >= note.startLine && lineNumber <= note.endLine,
		);
	}

	/**
	 * Dispose resources
	 */
	dispose(): void {
		this.gutterDecorationType.dispose();
		for (const decorationType of this.inlineDecorationTypes.values()) {
			decorationType.dispose();
		}
	}
}
