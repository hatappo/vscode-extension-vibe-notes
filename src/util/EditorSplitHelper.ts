import * as vscode from "vscode";
import { EditorSplitMode } from "../types/EditorSplitMode";

export class EditorSplitHelper {
	/**
	 * Show a document in the editor according to the configured split mode
	 * @param document The document to show
	 * @param configKey Optional config key to read split mode from (defaults to "vibe-notes.editorSplitMode")
	 * @returns The text editor showing the document
	 */
	static async showDocumentWithSplitMode(
		document: vscode.TextDocument,
		configKey: string = "vibe-notes.editorSplitMode",
	): Promise<vscode.TextEditor> {
		const splitMode = vscode.workspace.getConfiguration().get<EditorSplitMode>(configKey, "horizontal");
		
		switch (splitMode) {
			case "none":
				// Open in current editor
				return await vscode.window.showTextDocument(document);
				
			case "vertical":
				// Split vertically (side by side)
				return await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
				
			case "horizontal":
			default:
				// Split horizontally (above/below)
				const currentActiveEditor = vscode.window.activeTextEditor;
				if (currentActiveEditor) {
					// Create a new empty editor group below
					await vscode.commands.executeCommand("workbench.action.newGroupBelow");
					// Show the document in the new group
					return await vscode.window.showTextDocument(document);
				} else {
					// No active editor, just open normally
					return await vscode.window.showTextDocument(document);
				}
		}
	}

	/**
	 * Get the current editor split mode from configuration
	 * @param configKey Optional config key to read split mode from (defaults to "vibe-notes.editorSplitMode")
	 * @returns The configured editor split mode
	 */
	static getEditorSplitMode(configKey: string = "vibe-notes.editorSplitMode"): EditorSplitMode {
		return vscode.workspace.getConfiguration().get<EditorSplitMode>(configKey, "horizontal");
	}
}