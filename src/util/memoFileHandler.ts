import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import { parseReviewFileWithErrors, ReviewComment, convertToMarkdown } from './reviewCommentParser';

export class MemoFileHandler {
  private static readonly COMMENTS_DIR = '.comments';
  private static readonly DEFAULT_MEMO_FILE = 'comments.local.txt';
  private static readonly LEGACY_MEMO_FILE = '.local.comments.txt';
  private memoFilePath: string;
  private legacyFilePath: string;
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  
  constructor(private workspaceFolder: vscode.WorkspaceFolder) {
    const commentsDir = path.join(workspaceFolder.uri.fsPath, MemoFileHandler.COMMENTS_DIR);
    this.memoFilePath = path.join(commentsDir, MemoFileHandler.DEFAULT_MEMO_FILE);
    this.legacyFilePath = path.join(workspaceFolder.uri.fsPath, MemoFileHandler.LEGACY_MEMO_FILE);
  }
  
  /**
   * Initialize the memo file handler and set up file watching
   */
  async initialize(): Promise<void> {
    // Migrate from legacy file if needed
    await this.migrateFromLegacyFile();
    
    // Ensure comments directory exists
    await this.ensureCommentsDirectory();
    
    // Set up file watcher (even if file doesn't exist yet)
    const pattern = new vscode.RelativePattern(this.workspaceFolder, `${MemoFileHandler.COMMENTS_DIR}/${MemoFileHandler.DEFAULT_MEMO_FILE}`);
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
  }
  
  /**
   * Ensure comments directory exists
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
   * Migrate from legacy file location
   */
  private async migrateFromLegacyFile(): Promise<void> {
    try {
      // Check if legacy file exists
      try {
        await fs.access(this.legacyFilePath);
      } catch {
        // Legacy file doesn't exist, nothing to migrate
        return;
      }
      
      // Check if new file already exists
      try {
        await fs.access(this.memoFilePath);
        // New file already exists, don't migrate
        return;
      } catch {
        // New file doesn't exist, proceed with migration
      }
      
      // Ensure comments directory exists
      await this.ensureCommentsDirectory();
      
      // Read legacy file content
      const content = await fs.readFile(this.legacyFilePath, 'utf8');
      
      // Write to new location
      await fs.writeFile(this.memoFilePath, content, 'utf8');
      
      // Delete legacy file
      await fs.unlink(this.legacyFilePath);
      
      vscode.window.showInformationMessage('Comments file migrated to new location: .comments/comments.local.txt');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to migrate comments file: ${error}`);
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
  public async readComments(): Promise<ReviewComment[]> {
    try {
      // Check if file exists first
      try {
        await fs.access(this.memoFilePath);
      } catch {
        // File doesn't exist yet, return empty array
        return [];
      }
      
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
      // Ensure comments directory exists
      await this.ensureCommentsDirectory();
      
      // Read existing content, or use empty string if file doesn't exist
      let content = '';
      try {
        content = await fs.readFile(this.memoFilePath, 'utf8');
      } catch {
        // File doesn't exist yet, will be created
      }
      
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
   * Get raw content
   */
  async getRawContent(): Promise<string> {
    try {
      const content = await fs.readFile(this.memoFilePath, 'utf8');
      return content;
    } catch {
      // File doesn't exist yet
      return '';
    }
  }
  
  /**
   * Get content as markdown
   */
  async getMarkdownContent(): Promise<string> {
    const comments = await this.readComments();
    return convertToMarkdown(comments);
  }
  
  /**
   * Dispose resources
   */
  dispose(): void {
    this.fileWatcher?.dispose();
  }
}