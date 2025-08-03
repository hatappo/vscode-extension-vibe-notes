import * as vscode from "vscode";
import * as path from "path";
import { NoteFileHandler } from "../notes/NoteFileHandler";
import { Note } from "../notes/NoteParser";

interface WorkspaceNotes {
	workspaceFolder: vscode.WorkspaceFolder;
	handler: NoteFileHandler;
	notes: Note[];
}

export class MultiWorkspaceTreeProvider implements vscode.TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<
		TreeItem | undefined | null | void
	>();
	readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private workspaceData: Map<string, WorkspaceNotes> = new Map();

	constructor() {}

	addWorkspace(workspaceFolder: vscode.WorkspaceFolder, handler: NoteFileHandler): void {
		this.workspaceData.set(workspaceFolder.uri.fsPath, {
			workspaceFolder,
			handler,
			notes: [],
		});
	}

	async refresh(): Promise<void> {
		await this.loadAllNotes();
		this._onDidChangeTreeData.fire();
	}

	async loadAllNotes(): Promise<void> {
		for (const [key, data] of this.workspaceData) {
			data.notes = await data.handler.readNotes();
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
			// File level - show notes
			const data = this.workspaceData.get(element.workspacePath!);
			if (data) {
				return Promise.resolve(this.getNoteItems(data, element.filePath!));
			}
		}
		return Promise.resolve([]);
	}

	private getWorkspaceItems(): TreeItem[] {
		const items: TreeItem[] = [];

		for (const [key, data] of this.workspaceData) {
			const item = new TreeItem(
				data.workspaceFolder.name,
				`${data.notes.length} note${data.notes.length !== 1 ? "s" : ""}`,
				vscode.TreeItemCollapsibleState.Expanded,
				"workspace",
			);
			item.workspacePath = key;
			item.iconPath = vscode.ThemeIcon.Folder;
			items.push(item);
		}

		return items;
	}

	private getFileItems(data: WorkspaceNotes): TreeItem[] {
		const fileMap = new Map<string, number>();

		// Count notes per file
		for (const note of data.notes) {
			const count = fileMap.get(note.filePath) || 0;
			fileMap.set(note.filePath, count + 1);
		}

		// Create file items
		const items: TreeItem[] = [];
		for (const [filePath, count] of fileMap) {
			const label = filePath === "/" ? "/ (General Notes)" : filePath;
			const item = new TreeItem(
				label,
				`${count} note${count > 1 ? "s" : ""}`,
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

	private getNoteItems(data: WorkspaceNotes, filePath: string): TreeItem[] {
		const fileNotes = data.notes.filter((n) => n.filePath === filePath);

		return fileNotes.map((note) => {
			let label: string;
			if (note.startLine === 0) {
				label = "-";
			} else if (note.startLine === note.endLine) {
				label = `L${note.startLine}`;
			} else {
				label = `L${note.startLine}-${note.endLine}`;
			}

			const item = new TreeItem(label, note.comment, vscode.TreeItemCollapsibleState.None, "note");

			item.tooltip = note.comment;
			item.note = note;
			item.workspacePath = data.workspaceFolder.uri.fsPath;

			// Add command to navigate to note location
			item.command = {
				command: "vibe-notes.goToNote",
				title: "Go to Note",
				arguments: [note, data.workspaceFolder],
			};

			return item;
		});
	}
}

export class TreeItem extends vscode.TreeItem {
	public filePath?: string;
	public note?: Note;
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
