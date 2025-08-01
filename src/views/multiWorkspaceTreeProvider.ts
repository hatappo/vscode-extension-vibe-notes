import * as vscode from "vscode";
import * as path from "path";
import { MemoFileHandler } from "../util/memoFileHandler";
import { ReviewComment } from "../util/reviewCommentParser";

interface WorkspaceComments {
	workspaceFolder: vscode.WorkspaceFolder;
	handler: MemoFileHandler;
	comments: ReviewComment[];
}

export class MultiWorkspaceTreeProvider implements vscode.TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<
		TreeItem | undefined | null | void
	>();
	readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private workspaceData: Map<string, WorkspaceComments> = new Map();

	constructor() {}

	addWorkspace(workspaceFolder: vscode.WorkspaceFolder, handler: MemoFileHandler): void {
		this.workspaceData.set(workspaceFolder.uri.fsPath, {
			workspaceFolder,
			handler,
			comments: [],
		});
	}

	async refresh(): Promise<void> {
		await this.loadAllComments();
		this._onDidChangeTreeData.fire();
	}

	async loadAllComments(): Promise<void> {
		for (const [key, data] of this.workspaceData) {
			data.comments = await data.handler.readComments();
		}
	}

	getTreeItem(element: TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: TreeItem): Thenable<TreeItem[]> {
		if (!element) {
			// Root level - show workspaces if multiple, or files if single
			if (this.workspaceData.size === 0) {
				return Promise.resolve([]);
			} else if (this.workspaceData.size === 1) {
				// Single workspace - show files directly
				const data = Array.from(this.workspaceData.values())[0];
				return Promise.resolve(this.getFileItems(data));
			} else {
				// Multiple workspaces - show workspace folders
				return Promise.resolve(this.getWorkspaceItems());
			}
		} else if (element.contextValue === "workspace") {
			// Workspace level - show files
			const data = this.workspaceData.get(element.workspacePath!);
			if (data) {
				return Promise.resolve(this.getFileItems(data));
			}
		} else if (element.contextValue === "file") {
			// File level - show comments
			const data = this.workspaceData.get(element.workspacePath!);
			if (data) {
				return Promise.resolve(this.getCommentItems(data, element.filePath!));
			}
		}
		return Promise.resolve([]);
	}

	private getWorkspaceItems(): TreeItem[] {
		const items: TreeItem[] = [];

		for (const [key, data] of this.workspaceData) {
			const item = new TreeItem(
				data.workspaceFolder.name,
				`${data.comments.length} comment${data.comments.length !== 1 ? "s" : ""}`,
				vscode.TreeItemCollapsibleState.Expanded,
				"workspace",
			);
			item.workspacePath = key;
			item.iconPath = vscode.ThemeIcon.Folder;
			items.push(item);
		}

		return items;
	}

	private getFileItems(data: WorkspaceComments): TreeItem[] {
		const fileMap = new Map<string, number>();

		// Count comments per file
		for (const comment of data.comments) {
			const count = fileMap.get(comment.filePath) || 0;
			fileMap.set(comment.filePath, count + 1);
		}

		// Create file items
		const items: TreeItem[] = [];
		for (const [filePath, count] of fileMap) {
			const item = new TreeItem(
				filePath,
				`${count} comment${count > 1 ? "s" : ""}`,
				vscode.TreeItemCollapsibleState.Collapsed,
				"file",
			);
			item.filePath = filePath;
			item.workspacePath = data.workspaceFolder.uri.fsPath;
			item.iconPath = vscode.ThemeIcon.File;
			items.push(item);
		}

		return items.sort((a, b) => a.label!.toString().localeCompare(b.label!.toString()));
	}

	private getCommentItems(data: WorkspaceComments, filePath: string): TreeItem[] {
		const fileComments = data.comments.filter((c) => c.filePath === filePath);

		return fileComments.map((comment) => {
			let label: string;
			if (comment.startLine === comment.endLine) {
				label = `L${comment.startLine}`;
			} else {
				label = `L${comment.startLine}-${comment.endLine}`;
			}

			const item = new TreeItem(label, comment.comment, vscode.TreeItemCollapsibleState.None, "comment");

			item.tooltip = comment.comment;
			item.comment = comment;
			item.workspacePath = data.workspaceFolder.uri.fsPath;

			// Add command to navigate to comment location
			item.command = {
				command: "shadow-comments.goToComment",
				title: "Go to Comment",
				arguments: [comment, data.workspaceFolder],
			};

			return item;
		});
	}
}

export class TreeItem extends vscode.TreeItem {
	public filePath?: string;
	public comment?: ReviewComment;
	public workspacePath?: string;

	constructor(
		public readonly label: string | vscode.TreeItemLabel,
		public readonly description?: string,
		public readonly collapsibleState?: vscode.TreeItemCollapsibleState,
		public readonly contextValue?: string,
	) {
		super(label, collapsibleState);
	}
}
