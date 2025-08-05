// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { NoteFileHandler } from "./notes/NoteFileHandler";
import { NoteDecorationManager } from "./ui/NoteDecorationManager";
import { MultiWorkspaceTreeProvider } from "./ui/MultiWorkspaceTreeProvider";
import { NoteCodeLensProvider } from "./ui/NoteCodeLensProvider";
import { TempFileManager } from "./workspace/TempFileManager";
import { registerNoteCommands } from "./commands/noteCommands";
import { registerViewCommands } from "./commands/viewCommands";
import { registerIntegrationCommands } from "./commands/integrationCommands";

// Global map to store temp file managers
const tempFileManagers = new Map<string, TempFileManager>();

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	// ===== 1/3 Initialize resources and providers =====

	// Initialize note file handlers and decoration providers for each workspace
	const noteHandlers = new Map<string, NoteFileHandler>();
	const decorationProviders = new Map<string, NoteDecorationManager>();
	const codeLensProviders = new Map<string, NoteCodeLensProvider>();

	// Create a single tree provider for all workspaces
	const treeProvider = new MultiWorkspaceTreeProvider();

	// Update UI components after note changes
	const updateUIComponents = async (workspaceFolder: vscode.WorkspaceFolder): Promise<void> => {
		const decorationProvider = decorationProviders.get(workspaceFolder.uri.fsPath);
		if (decorationProvider) {
			await decorationProvider.updateDecorations();
		}

		const codeLensProvider = codeLensProviders.get(workspaceFolder.uri.fsPath);
		if (codeLensProvider) {
			codeLensProvider.refresh();
		}

		await treeProvider.refresh();
	};

	// Initialize handlers for existing workspace folders
	if (!vscode.workspace.workspaceFolders) {
		return;
	}

	for (const folder of vscode.workspace.workspaceFolders) {
		const handler = new NoteFileHandler(folder);
		await handler.initialize();
		noteHandlers.set(folder.uri.fsPath, handler);
		context.subscriptions.push(handler);

		// Create decoration provider
		const decorationProvider = new NoteDecorationManager(handler, folder);
		decorationProviders.set(folder.uri.fsPath, decorationProvider);
		context.subscriptions.push(decorationProvider);

		// Create CodeLens provider
		const codeLensProvider = new NoteCodeLensProvider(handler, folder);
		codeLensProviders.set(folder.uri.fsPath, codeLensProvider);

		// Create temp file manager
		const tempFileManager = new TempFileManager(folder.uri.fsPath);
		tempFileManagers.set(folder.uri.fsPath, tempFileManager);
		context.subscriptions.push(tempFileManager);

		// Register CodeLens provider
		const codeLensDisposable = vscode.languages.registerCodeLensProvider(
			{ scheme: "file", pattern: new vscode.RelativePattern(folder, "**/*") },
			codeLensProvider,
		);
		context.subscriptions.push(codeLensDisposable);

		// Initial decoration update
		decorationProvider.updateDecorations();

		// Add workspace to tree provider
		treeProvider.addWorkspace(folder, handler);

		// Set up file watcher
		const watcher = handler.getFileWatcher();
		if (watcher) {
			watcher.onDidChange(() => updateUIComponents(folder));
			watcher.onDidCreate(() => updateUIComponents(folder));
			watcher.onDidDelete(() => updateUIComponents(folder));
		}

		// Listen for notes changed event from handler
		handler.onNotesChanged(async () => {
			await updateUIComponents(folder);
		});
	}

	// Register tree view after all workspaces are initialized
	await treeProvider.refresh();
	const treeView = vscode.window.createTreeView("vibeNotesView", {
		treeDataProvider: treeProvider,
		showCollapseAll: false,
	});
	context.subscriptions.push(treeView);

	// ===== 2/3 Register commands =====

	// Register all commands
	registerNoteCommands(context, noteHandlers, tempFileManagers, updateUIComponents);
	registerViewCommands(context, noteHandlers, treeProvider);
	registerIntegrationCommands(context, noteHandlers);

	// ===== 3/3 Setup event listeners =====

	// Update decorations when editor becomes visible
	context.subscriptions.push(
		vscode.window.onDidChangeVisibleTextEditors(() => {
			decorationProviders.forEach((decorationProvider) => {
				decorationProvider.updateDecorations();
			});
		}),
	);

	// Apply decorations to new editors
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (!editor) {
				return;
			}

			const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
			if (!workspaceFolder) {
				return;
			}

			const decorationProvider = decorationProviders.get(workspaceFolder.uri.fsPath);
			if (!decorationProvider) {
				return;
			}

			decorationProvider.applyDecorationsToEditor(editor);
		}),
	);
}

// This method is called when your extension is deactivated
export async function deactivate() {
	// Cleanup is handled automatically via context.subscriptions
}
