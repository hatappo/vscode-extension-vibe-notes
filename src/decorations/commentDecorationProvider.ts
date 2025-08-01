import * as vscode from 'vscode';
import * as path from 'path';
import { MemoFileHandler } from '../util/memoFileHandler';
import { ReviewComment } from '../util/reviewCommentParser';

export class CommentDecorationProvider {
  private gutterDecorationType: vscode.TextEditorDecorationType;
  private inlineDecorationTypes = new Map<string, vscode.TextEditorDecorationType>();
  private decorations = new Map<string, vscode.DecorationOptions[]>();
  private inlineDecorations = new Map<string, { decoration: vscode.DecorationOptions, type: vscode.TextEditorDecorationType }[]>();
  
  constructor(private memoHandler: MemoFileHandler, private workspaceFolder: vscode.WorkspaceFolder) {
    // Create gutter decoration type
    this.gutterDecorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: vscode.Uri.parse('data:image/svg+xml;utf8,<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 10 6 A 3 3 0 1 0 10 10" stroke="%234285f4" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>'),
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
    this.inlineDecorations.clear();
    
    // Dispose old inline decoration types
    for (const decorationType of this.inlineDecorationTypes.values()) {
      decorationType.dispose();
    }
    this.inlineDecorationTypes.clear();
    
    // Group comments by file
    for (const comment of comments) {
      const filePath = path.join(this.workspaceFolder.uri.fsPath, comment.filePath);
      if (!this.decorations.has(filePath)) {
        this.decorations.set(filePath, []);
        this.inlineDecorations.set(filePath, []);
      }
      
      // Create gutter decoration for the first line only
      const gutterDecoration: vscode.DecorationOptions = {
        range: new vscode.Range(comment.startLine - 1, 0, comment.startLine - 1, 0)
      };
      this.decorations.get(filePath)!.push(gutterDecoration);
      
      // Create inline decoration for the first line
      const lines = comment.comment.split('\n');
      const firstLineText = lines[0];
      const isMultiline = lines.length > 1;
      const truncatedText = firstLineText.length > 40 ? firstLineText.substring(0, 40) + '..' : firstLineText;
      const displayText = `💬 ${truncatedText}${isMultiline ? ' .. ' : ''}`;
      
      // Create a unique decoration type for this comment
      const decorationKey = `${filePath}:${comment.startLine}`;
      const inlineDecorationType = vscode.window.createTextEditorDecorationType({
        after: {
          contentText: displayText,
          color: '#999999',
          margin: '0 0 0 1em',
          fontStyle: 'italic'
        },
        isWholeLine: true
      });
      this.inlineDecorationTypes.set(decorationKey, inlineDecorationType);
      
      // Get the editor to find the line end position
      const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath === filePath);
      if (editor) {
        const line = editor.document.lineAt(comment.startLine - 1);
        const inlineDecoration: vscode.DecorationOptions = {
          range: new vscode.Range(comment.startLine - 1, line.text.length, comment.startLine - 1, line.text.length),
          hoverMessage: new vscode.MarkdownString(`**Comment:**\n\n${comment.comment.replace(/\n/g, '  \n')}`)
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
    this.gutterDecorationType.dispose();
    for (const decorationType of this.inlineDecorationTypes.values()) {
      decorationType.dispose();
    }
  }
}