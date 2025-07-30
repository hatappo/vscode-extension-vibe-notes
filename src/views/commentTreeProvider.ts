import * as vscode from 'vscode';
import * as path from 'path';
import { MemoFileHandler } from '../util/memoFileHandler';
import { ReviewComment } from '../util/reviewCommentParser';

export class CommentTreeProvider implements vscode.TreeDataProvider<CommentItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<CommentItem | undefined | null | void> = new vscode.EventEmitter<CommentItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<CommentItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private comments: ReviewComment[] = [];

  constructor(
    private memoHandler: MemoFileHandler,
    private workspaceFolder: vscode.WorkspaceFolder
  ) {}

  refresh(): void {
    this.loadComments();
    this._onDidChangeTreeData.fire();
  }

  async loadComments(): Promise<void> {
    this.comments = await this.memoHandler.readComments();
  }

  getTreeItem(element: CommentItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CommentItem): Thenable<CommentItem[]> {
    if (!element) {
      // Root level - show files
      return Promise.resolve(this.getFileItems());
    } else if (element.contextValue === 'file') {
      // File level - show comments
      return Promise.resolve(this.getCommentItems(element.filePath!));
    }
    return Promise.resolve([]);
  }

  private getFileItems(): CommentItem[] {
    const fileMap = new Map<string, number>();
    
    // Count comments per file
    for (const comment of this.comments) {
      const count = fileMap.get(comment.filePath) || 0;
      fileMap.set(comment.filePath, count + 1);
    }

    // Create file items
    const items: CommentItem[] = [];
    for (const [filePath, count] of fileMap) {
      const item = new CommentItem(
        filePath,
        `${count} comment${count > 1 ? 's' : ''}`,
        vscode.TreeItemCollapsibleState.Collapsed,
        'file'
      );
      item.filePath = filePath;
      item.iconPath = vscode.ThemeIcon.File;
      items.push(item);
    }

    return items.sort((a, b) => a.label!.toString().localeCompare(b.label!.toString()));
  }

  private getCommentItems(filePath: string): CommentItem[] {
    const fileComments = this.comments.filter(c => c.filePath === filePath);
    
    return fileComments.map(comment => {
      let label: string;
      if (comment.startLine === comment.endLine) {
        if (comment.startColumn !== undefined) {
          label = `L${comment.startLine}:${comment.startColumn}`;
        } else {
          label = `L${comment.startLine}`;
        }
      } else {
        if (comment.startColumn !== undefined && comment.endColumn !== undefined) {
          label = `L${comment.startLine}:${comment.startColumn}-${comment.endLine}:${comment.endColumn}`;
        } else {
          label = `L${comment.startLine}-${comment.endLine}`;
        }
      }

      const item = new CommentItem(
        label,
        comment.comment,
        vscode.TreeItemCollapsibleState.None,
        'comment'
      );
      
      item.tooltip = comment.comment;
      item.comment = comment;
      
      // Add command to navigate to comment location
      item.command = {
        command: 'vscode-extension-vibe-letter.goToComment',
        title: 'Go to Comment',
        arguments: [comment]
      };

      return item;
    });
  }
}

export class CommentItem extends vscode.TreeItem {
  public filePath?: string;
  public comment?: ReviewComment;

  constructor(
    public readonly label: string | vscode.TreeItemLabel,
    public readonly description?: string,
    public readonly collapsibleState?: vscode.TreeItemCollapsibleState,
    public readonly contextValue?: string
  ) {
    super(label, collapsibleState);
  }
}