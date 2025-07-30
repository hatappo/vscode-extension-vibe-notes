import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import { parseReviewFileWithErrors, ReviewComment, convertToMarkdown } from './reviewCommentParser';

export class MemoFileHandler {
  private static readonly DEFAULT_MEMO_FILE = '.local.comments.txt';
  private memoFilePath: string;
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  
  constructor(private workspaceFolder: vscode.WorkspaceFolder) {
    this.memoFilePath = path.join(workspaceFolder.uri.fsPath, MemoFileHandler.DEFAULT_MEMO_FILE);
  }
  
  /**
   * Initialize the memo file handler and set up file watching
   */
  async initialize(): Promise<void> {
    // Ensure memo file exists
    await this.ensureMemoFileExists();
    
    // Set up file watcher
    const pattern = new vscode.RelativePattern(this.workspaceFolder, MemoFileHandler.DEFAULT_MEMO_FILE);
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
  }
  
  /**
   * Ensure the memo file exists, create if not
   */
  private async ensureMemoFileExists(): Promise<void> {
    try {
      await fs.access(this.memoFilePath);
    } catch {
      await fs.writeFile(this.memoFilePath, '', 'utf8');
    }
  }
  
  /**
   * Format line specification
   */
  private formatLineSpec(startLine: number, endLine: number, startColumn?: number, endColumn?: number): string {
    if (startLine === endLine) {
      return startColumn !== undefined ? `${startLine},${startColumn}` : `${startLine}`;
    } else {
      if (startColumn !== undefined && endColumn !== undefined) {
        return `${startLine},${startColumn}-${endLine},${endColumn}`;
      } else {
        return `${startLine}-${endLine}`;
      }
    }
  }
  
  /**
   * Escape comment text for storage
   */
  private escapeComment(comment: string): string {
    return comment
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }
  
  /**
   * Read all comments from the memo file
   */
  async readComments(): Promise<ReviewComment[]> {
    try {
      const content = await fs.readFile(this.memoFilePath, 'utf8');
      const result = parseReviewFileWithErrors(content);
      
      if (result.errors && result.errors.length > 0) {
        const errorMessage = result.errors
          .map((e: any) => `Line ${e.line}: ${e.error}`)
          .join('\n');
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
  async addComment(filePath: string, startLine: number, endLine: number, comment: string, startColumn?: number, endColumn?: number): Promise<void> {
    try {
      // Read existing content
      const content = await fs.readFile(this.memoFilePath, 'utf8');
      
      // Format the new comment with new format
      const lineSpec = this.formatLineSpec(startLine, endLine, startColumn, endColumn);
      const escapedComment = this.escapeComment(comment);
      const newLine = `${filePath}#L${lineSpec} "${escapedComment}"`;
      
      // Append to file
      const newContent = content.trim() ? `${content.trim()}\n${newLine}\n` : `${newLine}\n`;
      await fs.writeFile(this.memoFilePath, newContent, 'utf8');
      
      vscode.window.showInformationMessage('Comment added successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to add comment: ${error}`);
    }
  }
  
  /**
   * Update an existing comment
   */
  async updateComment(oldComment: ReviewComment, newCommentText: string): Promise<void> {
    try {
      const content = await fs.readFile(this.memoFilePath, 'utf8');
      const lines = content.split('\n');
      
      // Find and replace the line
      const updatedLines = lines.map(line => {
        if (line.trim() === oldComment.raw) {
          const lineSpec = this.formatLineSpec(oldComment.startLine, oldComment.endLine, oldComment.startColumn, oldComment.endColumn);
          const escapedComment = this.escapeComment(newCommentText);
          return `${oldComment.filePath}#L${lineSpec} "${escapedComment}"`;
        }
        return line;
      });
      
      await fs.writeFile(this.memoFilePath, updatedLines.join('\n'), 'utf8');
      vscode.window.showInformationMessage('Comment updated successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update comment: ${error}`);
    }
  }
  
  /**
   * Delete a comment
   */
  async deleteComment(comment: ReviewComment): Promise<void> {
    try {
      const content = await fs.readFile(this.memoFilePath, 'utf8');
      const lines = content.split('\n');
      
      // Filter out the comment line
      const updatedLines = lines.filter(line => line.trim() !== comment.raw);
      
      await fs.writeFile(this.memoFilePath, updatedLines.join('\n'), 'utf8');
      vscode.window.showInformationMessage('Comment deleted successfully');
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
    return allComments.filter(comment => comment.filePath === relativePath);
  }
  
  /**
   * Get file watcher
   */
  getFileWatcher(): vscode.FileSystemWatcher | undefined {
    return this.fileWatcher;
  }
  
  /**
   * Copy raw content to clipboard
   */
  async copyRawContent(): Promise<void> {
    try {
      const content = await fs.readFile(this.memoFilePath, 'utf8');
      await vscode.env.clipboard.writeText(content);
      vscode.window.showInformationMessage('Raw content copied to clipboard');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to copy content: ${error}`);
    }
  }
  
  /**
   * Copy content as markdown to clipboard
   */
  async copyAsMarkdown(): Promise<void> {
    try {
      const comments = await this.readComments();
      const markdown = convertToMarkdown(comments);
      await vscode.env.clipboard.writeText(markdown);
      vscode.window.showInformationMessage('Markdown content copied to clipboard');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to copy markdown: ${error}`);
    }
  }
  
  /**
   * Copy content as JSON to clipboard
   */
  async copyAsJson(): Promise<void> {
    try {
      const comments = await this.readComments();
      const json = JSON.stringify(comments, null, 2);
      await vscode.env.clipboard.writeText(json);
      vscode.window.showInformationMessage('JSON content copied to clipboard');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to copy JSON: ${error}`);
    }
  }
  
  /**
   * Dispose resources
   */
  dispose(): void {
    this.fileWatcher?.dispose();
  }
}