import * as vscode from "vscode";
import * as path from "path";
import { NoteFileHandler } from "../notes/NoteFileHandler";
import { Note } from "../notes/NoteParser";

export class NoteCodeLensProvider implements vscode.CodeLensProvider {
	private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

	constructor(
		private noteHandler: NoteFileHandler,
		private workspaceFolder: vscode.WorkspaceFolder,
	) {}

	public refresh(): void {
		this._onDidChangeCodeLenses.fire();
	}

	async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
		const codeLenses: vscode.CodeLens[] = [];

		// Get relative path for this document
		const relativePath = path.relative(this.workspaceFolder.uri.fsPath, document.uri.fsPath);

		// Get all notes for this file
		const notes = await this.noteHandler.getNotesForFile(document.uri.fsPath);

		// Create CodeLens for each note
		for (const note of notes) {
			// Skip General Notes
			if (note.filePath === "/" || note.startLine === 0) {
				continue;
			}
			
			if (note.filePath === relativePath) {
				// Create range for the first line of the note
				const range = new vscode.Range(note.startLine - 1, 0, note.startLine - 1, 0);

				// Define code lens actions
				const lensActions = [
					{ icon: "trash", title: "Delete Note", command: "vibe-notes.deleteNoteAtLine" },
					{ icon: "edit", title: "Edit Note", command: "vibe-notes.editNoteAtLine" },
					{ icon: "edit", title: "Edit Note as Markdown", command: "vibe-notes.editNoteAtLineAsMarkdown" },
				];

				// Create code lenses
				const lenses = lensActions.map(action => 
					new vscode.CodeLens(range, {
						title: `$(${action.icon}) ${action.title}`,
						command: action.command,
						arguments: [document.uri, note.startLine],
					})
				);

				codeLenses.push(...lenses);
			}
		}

		return codeLenses;
	}
}
