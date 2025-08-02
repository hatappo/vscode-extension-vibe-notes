import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";

export class TempFileManager {
	private static readonly TEMP_DIR = ".notes/tmp";
	private tempFileWatchers: Map<string, vscode.Disposable[]> = new Map();
	private tempFileCallbacks: Map<string, (content: string | null) => Promise<void>> = new Map();
	private tempFileOpenTimes: Map<string, number> = new Map();

	constructor(private workspaceRoot: string) {}

	/**
	 * Open a temporary file in the editor for user input
	 * @param fileName The name of the temporary file
	 * @param initialContent Initial content to display in the file
	 * @param callback Function to call when the file is saved (content) or closed without saving (null)
	 */
	async openTempFile(
		fileName: string,
		initialContent: string,
		callback: (content: string | null) => Promise<void>,
	): Promise<void> {
		const tempDir = path.join(this.workspaceRoot, TempFileManager.TEMP_DIR);
		const tempFilePath = path.join(tempDir, fileName);

		try {
			// Create temp directory if it doesn't exist
			await fs.mkdir(tempDir, { recursive: true });

			// Write initial content to temp file
			await fs.writeFile(tempFilePath, initialContent);

			// Open the file in editor
			const document = await vscode.workspace.openTextDocument(tempFilePath);
			const editor = await vscode.window.showTextDocument(document);

			// Store callback for this file
			this.tempFileCallbacks.set(tempFilePath, callback);
			this.tempFileOpenTimes.set(tempFilePath, Date.now());

			// Set up listeners for this file
			const disposables: vscode.Disposable[] = [];

			// Listen for save events
			const saveListener = vscode.workspace.onDidSaveTextDocument(async (savedDoc) => {
				if (savedDoc.uri.fsPath === tempFilePath) {
					const content = savedDoc.getText();
					const cb = this.tempFileCallbacks.get(tempFilePath);
					if (cb) {
						await cb(content);

						// Close all editors showing this document
						const editorsToClose = vscode.window.visibleTextEditors.filter(
							(editor) => editor.document.uri.fsPath === tempFilePath,
						);

						// Close the editors
						for (const editor of editorsToClose) {
							await vscode.window.showTextDocument(editor.document, editor.viewColumn);
							await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
						}

						await this.cleanupTempFile(tempFilePath);
					}
				}
			});
			disposables.push(saveListener);

			// Listen for close events
			const closeListener = vscode.workspace.onDidCloseTextDocument(async (closedDoc) => {
				if (closedDoc.uri.fsPath === tempFilePath) {
					// Check if this is a premature close (within 1 second of opening)
					const openTime = this.tempFileOpenTimes.get(tempFilePath);
					if (openTime && Date.now() - openTime < 1000) {
						return;
					}

					// Check if file still exists (wasn't saved and cleaned up)
					try {
						await fs.access(tempFilePath);
						// File exists, user closed without saving
						const cb = this.tempFileCallbacks.get(tempFilePath);
						if (cb) {
							await cb(null);
						}
						await this.cleanupTempFile(tempFilePath);
					} catch {
						// File already cleaned up
					}
				}
			});
			disposables.push(closeListener);

			// Also listen for editor visibility changes
			const visibilityListener = vscode.window.onDidChangeVisibleTextEditors(async () => {
				// Check current visible editors directly instead of relying on event args
				const isTempFileVisible = vscode.window.visibleTextEditors.some(
					(editor) => editor.document.uri.fsPath === tempFilePath,
				);

				if (!isTempFileVisible && this.tempFileCallbacks.has(tempFilePath)) {
					// Temp file is no longer visible, check if it still exists
					try {
						await fs.access(tempFilePath);
						// File exists but no editor is showing it
						const cb = this.tempFileCallbacks.get(tempFilePath);
						if (cb) {
							await cb(null);
						}
						await this.cleanupTempFile(tempFilePath);
					} catch {
						// File already cleaned up
					}
				}
			});
			disposables.push(visibilityListener);

			this.tempFileWatchers.set(tempFilePath, disposables);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to create temporary file: ${error}`);
			throw error;
		}
	}

	/**
	 * Clean up a temporary file and its listeners
	 */
	private async cleanupTempFile(tempFilePath: string): Promise<void> {
		// Dispose of listeners
		const disposables = this.tempFileWatchers.get(tempFilePath);
		if (disposables) {
			disposables.forEach((d) => d.dispose());
			this.tempFileWatchers.delete(tempFilePath);
		}

		// Remove callback and open time
		this.tempFileCallbacks.delete(tempFilePath);
		this.tempFileOpenTimes.delete(tempFilePath);

		// Delete the file
		try {
			await fs.unlink(tempFilePath);
		} catch {
			// File might already be deleted
		}

		// Try to remove temp directory if empty
		try {
			const tempDir = path.dirname(tempFilePath);
			const files = await fs.readdir(tempDir);
			if (files.length === 0) {
				await fs.rmdir(tempDir);
			}
		} catch {
			// Directory might not be empty or already deleted
		}
	}

	/**
	 * Clean up all temporary files and listeners
	 */
	async dispose(): Promise<void> {
		// Clean up all temp files
		for (const tempFilePath of this.tempFileWatchers.keys()) {
			await this.cleanupTempFile(tempFilePath);
		}
	}
}
