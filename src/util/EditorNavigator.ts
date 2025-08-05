import * as vscode from "vscode";

export class EditorNavigator {
	/**
	 * Navigate to a specific line in the editor
	 * @param editor The text editor
	 * @param line The line number (0-based)
	 * @param column Optional column number (0-based)
	 * @param revealType How to reveal the range
	 */
	static navigateToLine(
		editor: vscode.TextEditor,
		line: number,
		column: number = 0,
		revealType: vscode.TextEditorRevealType = vscode.TextEditorRevealType.InCenter,
	): void {
		const position = new vscode.Position(line, column);
		const range = new vscode.Range(position, position);
		editor.selection = new vscode.Selection(position, position);
		editor.revealRange(range, revealType);
	}

	/**
	 * Navigate to the top of the document
	 * @param editor The text editor
	 */
	static navigateToTop(editor: vscode.TextEditor): void {
		this.navigateToLine(editor, 0, 0, vscode.TextEditorRevealType.AtTop);
	}

	/**
	 * Navigate to a specific position with a selection
	 * @param editor The text editor
	 * @param startLine Start line (0-based)
	 * @param startColumn Start column (0-based)
	 * @param endLine End line (0-based)
	 * @param endColumn End column (0-based)
	 * @param revealType How to reveal the range
	 */
	static navigateToRange(
		editor: vscode.TextEditor,
		startLine: number,
		startColumn: number,
		endLine: number,
		endColumn: number,
		revealType: vscode.TextEditorRevealType = vscode.TextEditorRevealType.InCenter,
	): void {
		const startPosition = new vscode.Position(startLine, startColumn);
		const endPosition = new vscode.Position(endLine, endColumn);
		const range = new vscode.Range(startPosition, endPosition);
		editor.selection = new vscode.Selection(startPosition, endPosition);
		editor.revealRange(range, revealType);
	}
}