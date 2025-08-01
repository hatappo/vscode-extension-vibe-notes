import * as vscode from "vscode";
import * as path from "path";
import { promises as fs } from "fs";
import { parseReviewFileWithErrors, ReviewComment } from "./reviewCommentParser";
import { parseMarkdownComments, applyMarkdownChanges } from "./markdownParser";

export class MemoFileHandler {
	private static readonly COMMENTS_DIR = ".comments";  // Still needed for temp files
	private static readonly DEFAULT_MEMO_FILE = ".comments.local.txt";
	private static readonly MARKDOWN_FILE = ".comments.local.md";
	private memoFilePath: string;
	private markdownFilePath: string;
	private fileWatcher: vscode.FileSystemWatcher | undefined;
	private markdownWatcher: vscode.FileSystemWatcher | undefined;
	private isUpdatingFromMarkdown = false;

	constructor(private workspaceFolder: vscode.WorkspaceFolder) {
		// File is now in workspace root
		this.memoFilePath = path.join(workspaceFolder.uri.fsPath, MemoFileHandler.DEFAULT_MEMO_FILE);
		this.markdownFilePath = path.join(workspaceFolder.uri.fsPath, MemoFileHandler.MARKDOWN_FILE);
	}

	/**
	 * Initialize the memo file handler and set up file watching
	 */
	async initialize(): Promise<void> {
		// Ensure comments directory exists for temp files
		await this.ensureCommentsDirectory();

		// Set up file watcher (even if file doesn't exist yet)
		const pattern = new vscode.RelativePattern(
			this.workspaceFolder,
			MemoFileHandler.DEFAULT_MEMO_FILE,
		);
		this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
		
		// Set up markdown file watcher
		const markdownPattern = new vscode.RelativePattern(
			this.workspaceFolder,
			MemoFileHandler.MARKDOWN_FILE,
		);
		this.markdownWatcher = vscode.workspace.createFileSystemWatcher(markdownPattern);
		
		// Handle markdown file changes
		this.markdownWatcher.onDidChange(async () => {
			if (!this.isUpdatingFromMarkdown) {
				await this.syncFromMarkdown();
			}
		});
	}

	/**
	 * Ensure comments directory exists (needed for temp files)
	 */
	private async ensureCommentsDirectory(): Promise<void> {
		const commentsDir = path.join(this.workspaceFolder.uri.fsPath, MemoFileHandler.COMMENTS_DIR);
		try {
			await fs.mkdir(commentsDir, { recursive: true });
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
	 * Escape comment text for storage
	 */
	private escapeComment(comment: string): string {
		return comment.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
	}

	/**
	 * Read all comments from the memo file
	 */
	public async readComments(): Promise<ReviewComment[]> {
		try {
			// Check if file exists first
			try {
				await fs.access(this.memoFilePath);
			} catch {
				// File doesn't exist yet, return empty array
				return [];
			}

			const content = await fs.readFile(this.memoFilePath, "utf8");
			const result = parseReviewFileWithErrors(content);

			if (result.errors && result.errors.length > 0) {
				const errorMessage = result.errors.map((e: any) => `Line ${e.line}: ${e.error}`).join("\n");
				vscode.window.showWarningMessage(`Some comments could not be parsed:\n${errorMessage}`);
			}

			return result.comments || [];
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to read memo file: ${error}`);
			return [];
		}
	}

	/**
	 * Add a new comment to the memo file
	 */
	async addComment(
		filePath: string,
		startLine: number,
		endLine: number,
		comment: string,
	): Promise<void> {
		try {
			// Ensure comments directory exists
			await this.ensureCommentsDirectory();

			// Read existing content, or use empty string if file doesn't exist
			let content = "";
			try {
				content = await fs.readFile(this.memoFilePath, "utf8");
			} catch {
				// File doesn't exist yet, will be created
			}

			// Format the new comment with new format
			const lineSpec = this.formatLineSpec(startLine, endLine);
			const escapedComment = this.escapeComment(comment);
			const newLine = `${filePath}#L${lineSpec} "${escapedComment}"`;

			// Append to file
			const newContent = content.trim() ? `${content.trim()}\n${newLine}\n` : `${newLine}\n`;
			await fs.writeFile(this.memoFilePath, newContent, "utf8");

			vscode.window.showInformationMessage("Comment added successfully");
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to add comment: ${error}`);
		}
	}

	/**
	 * Update an existing comment
	 */
	async updateComment(oldComment: ReviewComment, newCommentText: string): Promise<void> {
		try {
			const content = await fs.readFile(this.memoFilePath, "utf8");
			const lines = content.split("\n");

			// Find and replace the line
			const updatedLines = lines.map((line) => {
				if (line.trim() === oldComment.raw) {
					const lineSpec = this.formatLineSpec(
						oldComment.startLine,
						oldComment.endLine,
					);
					const escapedComment = this.escapeComment(newCommentText);
					return `${oldComment.filePath}#L${lineSpec} "${escapedComment}"`;
				}
				return line;
			});

			await fs.writeFile(this.memoFilePath, updatedLines.join("\n"), "utf8");
			vscode.window.showInformationMessage("Comment updated successfully");
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to update comment: ${error}`);
		}
	}

	/**
	 * Delete a comment
	 */
	async deleteComment(comment: ReviewComment): Promise<void> {
		try {
			const content = await fs.readFile(this.memoFilePath, "utf8");
			const lines = content.split("\n");

			// Filter out the comment line
			const updatedLines = lines.filter((line) => line.trim() !== comment.raw);

			await fs.writeFile(this.memoFilePath, updatedLines.join("\n"), "utf8");
			vscode.window.showInformationMessage("Comment deleted successfully");
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to delete comment: ${error}`);
		}
	}

	/**
	 * Get comments for a specific file
	 */
	async getCommentsForFile(filePath: string): Promise<ReviewComment[]> {
		const allComments = await this.readComments();
		const relativePath = path.relative(this.workspaceFolder.uri.fsPath, filePath);
		return allComments.filter((comment) => comment.filePath === relativePath);
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
			const content = await fs.readFile(this.memoFilePath, "utf8");
			return content;
		} catch {
			// File doesn't exist yet
			return "";
		}
	}

	/**
	 * Sync changes from markdown file to comments file
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
			
			// Read both files
			const markdownContent = await fs.readFile(this.markdownFilePath, "utf8");
			const existingComments = await this.readComments();
			
			// Parse markdown
			const markdownComments = parseMarkdownComments(markdownContent);
			
			// Apply changes (only updates existing comments)
			const { updatedComments, hasChanges } = applyMarkdownChanges(existingComments, markdownComments);
			
			if (hasChanges) {
				// Update comments file
				this.isUpdatingFromMarkdown = true;
				try {
					for (const updatedComment of updatedComments) {
						await this.updateComment(updatedComment, updatedComment.comment);
					}
					vscode.window.showInformationMessage(`Updated ${updatedComments.length} comment(s) from markdown`);
				} finally {
					this.isUpdatingFromMarkdown = false;
				}
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
	}
}
