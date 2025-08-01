import * as vscode from "vscode";
import * as path from "path";
import { MemoFileHandler } from "../util/memoFileHandler";
import { ReviewComment } from "../util/reviewCommentParser";

export class CommentCodeLensProvider implements vscode.CodeLensProvider {
	private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

	constructor(
		private memoHandler: MemoFileHandler,
		private workspaceFolder: vscode.WorkspaceFolder,
	) {}

	public refresh(): void {
		this._onDidChangeCodeLenses.fire();
	}

	async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
		const codeLenses: vscode.CodeLens[] = [];

		// Get relative path for this document
		const relativePath = path.relative(this.workspaceFolder.uri.fsPath, document.uri.fsPath);

		// Get all comments for this file
		const comments = await this.memoHandler.getCommentsForFile(document.uri.fsPath);

		// Create CodeLens for each comment
		for (const comment of comments) {
			if (comment.filePath === relativePath) {
				// Create range for the first line of the comment
				const range = new vscode.Range(comment.startLine - 1, 0, comment.startLine - 1, 0);

				// Create Edit CodeLens
				const editLens = new vscode.CodeLens(range, {
					title: "$(edit) Edit",
					command: "shadow-comments.editCommentAtLine",
					arguments: [document.uri, comment.startLine],
				});

				// Create Delete CodeLens
				const deleteLens = new vscode.CodeLens(range, {
					title: "$(trash) Delete",
					command: "shadow-comments.deleteCommentAtLine",
					arguments: [document.uri, comment.startLine],
				});

				codeLenses.push(editLens, deleteLens);
			}
		}

		return codeLenses;
	}
}
