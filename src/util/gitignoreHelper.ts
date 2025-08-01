import * as vscode from "vscode";
import * as path from "path";
import { promises as fs } from "fs";

/**
 * Check if .gitignore exists and contains required entries
 */
export async function checkGitignoreEntries(workspaceFolder: vscode.WorkspaceFolder): Promise<{
	hasGitignore: boolean;
	hasCommentsDir: boolean;
	hasMarkdownFile: boolean;
}> {
	const gitignorePath = path.join(workspaceFolder.uri.fsPath, ".gitignore");
	
	try {
		const content = await fs.readFile(gitignorePath, "utf8");
		const lines = content.split("\n").map(line => line.trim());
		
		// Check for various possible formats
		const hasCommentsDir = lines.some(line => 
			line === ".comments/" || 
			line === ".comments" ||
			line === "/.comments/" ||
			line === "/.comments"
		);
		
		const hasMarkdownFile = lines.some(line => 
			line === ".comments.local.md" ||
			line === "/.comments.local.md"
		);
		
		return {
			hasGitignore: true,
			hasCommentsDir,
			hasMarkdownFile
		};
	} catch {
		return {
			hasGitignore: false,
			hasCommentsDir: false,
			hasMarkdownFile: false
		};
	}
}

/**
 * Add missing entries to .gitignore
 */
export async function addToGitignore(
	workspaceFolder: vscode.WorkspaceFolder,
	addCommentsDir: boolean,
	addMarkdownFile: boolean
): Promise<void> {
	const gitignorePath = path.join(workspaceFolder.uri.fsPath, ".gitignore");
	
	try {
		let content = "";
		let needsNewline = false;
		
		// Read existing content if file exists
		try {
			content = await fs.readFile(gitignorePath, "utf8");
			// Check if file ends with newline
			needsNewline = content.length > 0 && !content.endsWith("\n");
		} catch {
			// File doesn't exist, will create it
		}
		
		// Build additions
		const additions: string[] = [];
		
		if (needsNewline) {
			additions.push("");
		}
		
		// Add comment header if adding any entry
		if (addCommentsDir || addMarkdownFile) {
			if (content.length > 0) {
				additions.push("");
			}
			additions.push("# Shadow Comments");
		}
		
		if (addCommentsDir) {
			additions.push(".comments/");
		}
		
		if (addMarkdownFile) {
			additions.push(".comments.local.md");
		}
		
		// Write back
		if (additions.length > 0) {
			const newContent = content + additions.join("\n") + "\n";
			await fs.writeFile(gitignorePath, newContent, "utf8");
		}
	} catch (error) {
		throw new Error(`Failed to update .gitignore: ${error}`);
	}
}

/**
 * Prompt user to setup .gitignore
 */
export async function promptGitignoreSetup(workspaceFolder: vscode.WorkspaceFolder): Promise<boolean> {
	const status = await checkGitignoreEntries(workspaceFolder);
	
	if (status.hasCommentsDir && status.hasMarkdownFile) {
		vscode.window.showInformationMessage(".gitignore is already configured correctly");
		
		// Open .gitignore file to show current configuration
		const gitignorePath = path.join(workspaceFolder.uri.fsPath, ".gitignore");
		const document = await vscode.workspace.openTextDocument(gitignorePath);
		await vscode.window.showTextDocument(document);
		
		return true;
	}
	
	const missingItems: string[] = [];
	if (!status.hasCommentsDir) {
		missingItems.push(".comments/");
	}
	if (!status.hasMarkdownFile) {
		missingItems.push(".comments.local.md");
	}
	
	const message = status.hasGitignore
		? `Add Shadow Comments entries to .gitignore?\nMissing: ${missingItems.join(", ")}`
		: "Create .gitignore and add Shadow Comments entries?";
	
	const choice = await vscode.window.showInformationMessage(
		message,
		"Yes",
		"No"
	);
	
	if (choice === "Yes") {
		try {
			await addToGitignore(workspaceFolder, !status.hasCommentsDir, !status.hasMarkdownFile);
			vscode.window.showInformationMessage(".gitignore updated successfully");
			
			// Open .gitignore file
			const gitignorePath = path.join(workspaceFolder.uri.fsPath, ".gitignore");
			const document = await vscode.workspace.openTextDocument(gitignorePath);
			await vscode.window.showTextDocument(document);
			
			return true;
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to update .gitignore: ${error}`);
			return false;
		}
	}
	
	return false;
}