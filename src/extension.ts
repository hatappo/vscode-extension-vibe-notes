// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { NoteFileHandler } from "./util/noteFileHandler";
import { NoteDecorationProvider } from "./decorations/noteDecorationProvider";
import { MultiWorkspaceTreeProvider } from "./views/multiWorkspaceTreeProvider";
import { NoteCodeLensProvider } from "./providers/noteCodeLensProvider";
import { TempFileManager } from "./util/tempFileManager";
import { registerNoteCommands } from "./commands/noteCommands";
import { registerViewCommands } from "./commands/viewCommands";
import { registerIntegrationCommands } from "./commands/integrationCommands";

// Global map to store temp file managers for cleanup on deactivate
const tempFileManagers = new Map<string, TempFileManager>();

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	// Initialize note file handlers and decoration providers for each workspace
	const noteHandlers = new Map<string, NoteFileHandler>();
	const decorationProviders = new Map<string, NoteDecorationProvider>();
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

		// Create decoration provider
		const decorationProvider = new NoteDecorationProvider(handler, folder);
		decorationProviders.set(folder.uri.fsPath, decorationProvider);

		// Create CodeLens provider
		const codeLensProvider = new NoteCodeLensProvider(handler, folder);
		codeLensProviders.set(folder.uri.fsPath, codeLensProvider);

		// Create temp file manager
		const tempFileManager = new TempFileManager(folder.uri.fsPath);
		tempFileManagers.set(folder.uri.fsPath, tempFileManager);

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
		showCollapseAll: true,
	});
	context.subscriptions.push(treeView);

	// Get handler for current workspace

	// Register all commands
	registerNoteCommands(context, noteHandlers, tempFileManagers, updateUIComponents);
	registerViewCommands(context, noteHandlers, treeProvider);
	registerIntegrationCommands(context, noteHandlers);
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

	// Clean up handlers on deactivation
	context.subscriptions.push({
		dispose: () => {
			noteHandlers.forEach((handler) => {
				handler.dispose();
			});
			decorationProviders.forEach((decorationProvider) => {
				decorationProvider.dispose();
			});
		},
	});
}

// This method is called when your extension is deactivated
export async function deactivate() {
	// Clean up all temp file managers
	for (const [_, tempFileManager] of tempFileManagers) {
		await tempFileManager.dispose();
	}
}
