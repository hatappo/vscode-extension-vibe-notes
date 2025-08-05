import * as vscode from "vscode";
import * as path from "path";
import { spawn } from "child_process";
import { NoteFileHandler } from "../notes/NoteFileHandler";
import { promptGitignoreSetup } from "../workspace/GitignoreHelper";
import { generateEnhancedMarkdown } from "../formatting/MarkdownGenerator";
import { getHandlerWithWorkspace } from "../notes/NoteFinder";
import { Note } from "../notes/NoteParser";

/**
 * Helper to validate workspace and git repository
 */
async function validateWorkspaceAndGit(): Promise<vscode.WorkspaceFolder | null> {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		vscode.window.showErrorMessage("No workspace folder found");
		return null;
	}

	// Check if it's a git repository
	const gitDir = path.join(workspaceFolder.uri.fsPath, ".git");
	try {
		await vscode.workspace.fs.stat(vscode.Uri.file(gitDir));
	} catch {
		vscode.window.showErrorMessage("Not a git repository");
		return null;
	}

	return workspaceFolder;
}

/**
 * Helper to get notes from handler
 */
async function getNotesFromHandler(
	noteHandlers: Map<string, NoteFileHandler>,
	workspaceFolder: vscode.WorkspaceFolder,
): Promise<Note[] | null> {
	const handler = noteHandlers.get(workspaceFolder.uri.fsPath);
	if (!handler) {
		vscode.window.showErrorMessage("No memo handler found");
		return null;
	}

	const notes = await handler.readNotes();
	if (notes.length === 0) {
		vscode.window.showInformationMessage("No notes found");
		return null;
	}

	return notes;
}

/**
 * Helper to execute git notes command
 */
async function executeGitNotesCommand(
	args: string[],
	content: string,
	workspaceFolder: vscode.WorkspaceFolder,
): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const gitProcess = spawn("git", ["notes", ...args], {
			cwd: workspaceFolder.uri.fsPath,
		});

		let stderr = "";

		// Collect stderr for error messages
		gitProcess.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		// Handle process exit
		gitProcess.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`Git notes failed: ${stderr}`));
			}
		});

		// Handle process errors
		gitProcess.on("error", (err) => {
			reject(err);
		});

		// Write content to stdin
		gitProcess.stdin.write(content);
		gitProcess.stdin.end();
	});
}

/**
 * Register all integration-related commands (Git, LLM, etc.)
 */
export function registerIntegrationCommands(
	context: vscode.ExtensionContext,
	noteHandlers: Map<string, NoteFileHandler>,
) {
	// Command: Save to Git Notes
	const saveToGitNotesCommand = vscode.commands.registerCommand("vibe-notes.saveToGitNotes", async () => {
		const workspaceFolder = await validateWorkspaceAndGit();
		if (!workspaceFolder) {
			return;
		}

		const notes = await getNotesFromHandler(noteHandlers, workspaceFolder);
		if (!notes) {
			return;
		}

		try {

			// Show confirmation dialog
			const confirmation = await vscode.window.showWarningMessage(
				"Save notes to Git Notes? This will overwrite any existing notes on the current HEAD commit.",
				"Save",
				"Cancel",
			);

			if (confirmation !== "Save") {
				return;
			}

			// Generate markdown content without preamble
			const content = await generateEnhancedMarkdown(notes, workspaceFolder, true, false);

			// Execute git notes command using stdin for security
			await executeGitNotesCommand(["add", "-f", "-F", "-"], content, workspaceFolder);

			vscode.window.showInformationMessage("Notes saved to git notes");
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to save to git notes: ${error}`);
		}
	});

	// Command: Append to Git Notes
	const appendToGitNotesCommand = vscode.commands.registerCommand("vibe-notes.appendToGitNotes", async () => {
		const workspaceFolder = await validateWorkspaceAndGit();
		if (!workspaceFolder) {
			return;
		}

		const notes = await getNotesFromHandler(noteHandlers, workspaceFolder);
		if (!notes) {
			return;
		}

		try {
			// Show confirmation dialog
			const confirmation = await vscode.window.showWarningMessage(
				"Append notes to Git Notes? This will add to any existing notes on the current HEAD commit.",
				"Append",
				"Cancel",
			);

			if (confirmation !== "Append") {
				return;
			}

			// Generate markdown content without preamble
			const content = await generateEnhancedMarkdown(notes, workspaceFolder, true, false);

			// Add separator before new content
			const contentWithSeparator = "\n\n---\n\n" + content;

			// Execute git notes append command using stdin for security
			await executeGitNotesCommand(["append", "-F", "-"], contentWithSeparator, workspaceFolder);

			vscode.window.showInformationMessage("Notes appended to git notes");
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to append to git notes: ${error}`);
		}
	});

	// Command: Setup .gitignore
	const setupGitignoreCommand = vscode.commands.registerCommand("vibe-notes.setupGitignore", async () => {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			vscode.window.showErrorMessage("No workspace folder found");
			return;
		}

		await promptGitignoreSetup(workspaceFolder);
	});

	// Command: Copy for LLM Agent
	const copyForLLMCommand = vscode.commands.registerCommand("vibe-notes.copyForLLM", async () => {
		// Get handler and workspace folder
		const { handler, workspaceFolder } = getHandlerWithWorkspace(noteHandlers);

		if (!handler || !workspaceFolder) {
			vscode.window.showErrorMessage("No workspace folder found");
			return;
		}

		// Get all notes
		const notes = await handler.readNotes();
		if (notes.length === 0) {
			vscode.window.showInformationMessage("No notes found");
			return;
		}

		// Get user's configuration
		const config = vscode.workspace.getConfiguration("vibe-notes");
		const includeCode = config.get<boolean>("copyForLLMIncludeCode");
		const prompt = config.get<string>("copyForLLMPrompt");

		// Generate enhanced markdown content for LLM
		const enhancedMarkdown = await generateEnhancedMarkdown(notes, workspaceFolder, includeCode, true);

		// Add prompt only if not empty
		const llmContent = prompt ? `${prompt}\n\n${enhancedMarkdown}` : enhancedMarkdown;

		// Copy to clipboard
		await vscode.env.clipboard.writeText(llmContent);
		vscode.window.showInformationMessage(`Copied ${notes.length} notes for LLM Agent`);
	});

	// Register all commands
	context.subscriptions.push(saveToGitNotesCommand, appendToGitNotesCommand, setupGitignoreCommand, copyForLLMCommand);
}
