import * as vscode from 'vscode';
import * as path from 'path';
import { MemoFileHandler } from '../util/memoFileHandler';
import { ReviewComment } from '../util/reviewCommentParser';

export class CommentDecorationProvider {
  private decorationType: vscode.TextEditorDecorationType;
  private decorations = new Map<string, vscode.DecorationOptions[]>();
  
  constructor(private memoHandler: MemoFileHandler, private workspaceFolder: vscode.WorkspaceFolder) {
    // Create decoration type with a simple indicator
    this.decorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: vscode.Uri.parse('data:image/svg+xml;utf8,<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 12 3 A 7 7 0 1 1 12 13" stroke="%234285f4" stroke-width="3" fill="none" stroke-linecap="round"/></svg>'),
      gutterIconSize: 'contain',
      overviewRulerColor: '#4285f4',
      overviewRulerLane: vscode.OverviewRulerLane.Right
    });
  }
  
  /**
   * Update decorations for all visible editors
   */
  async updateDecorations(): Promise<void> {
    const comments = await this.memoHandler.readComments();
    this.decorations.clear();
    
    // Group comments by file
    for (const comment of comments) {
      const filePath = path.join(this.workspaceFolder.uri.fsPath, comment.filePath);
      if (!this.decorations.has(filePath)) {
        this.decorations.set(filePath, []);
      }
      
      // Create decoration for each line in the range
      for (let line = comment.startLine - 1; line <= comment.endLine - 1; line++) {
        const decoration: vscode.DecorationOptions = {
          range: new vscode.Range(line, 0, line, 0),
          hoverMessage: new vscode.MarkdownString(`**Comment:** ${comment.comment}`)
        };
        this.decorations.get(filePath)!.push(decoration);
      }
    }
    
    // Apply decorations to visible editors
    for (const editor of vscode.window.visibleTextEditors) {
      const decorations = this.decorations.get(editor.document.uri.fsPath) || [];
      editor.setDecorations(this.decorationType, decorations);
    }
  }
  
  /**
   * Apply decorations to a specific editor
   */
  applyDecorationsToEditor(editor: vscode.TextEditor): void {
    const decorations = this.decorations.get(editor.document.uri.fsPath) || [];
    editor.setDecorations(this.decorationType, decorations);
  }
  
  /**
   * Get comment at specific position
   */
  async getCommentAtPosition(document: vscode.TextDocument, position: vscode.Position): Promise<ReviewComment | undefined> {
    const relativePath = path.relative(this.workspaceFolder.uri.fsPath, document.uri.fsPath);
    const comments = await this.memoHandler.getCommentsForFile(document.uri.fsPath);
    const lineNumber = position.line + 1; // Convert to 1-based
    
    return comments.find(comment => 
      comment.filePath === relativePath &&
      lineNumber >= comment.startLine && 
      lineNumber <= comment.endLine
    );
  }
  
  /**
   * Dispose resources
   */
  dispose(): void {
    this.decorationType.dispose();
  }
}