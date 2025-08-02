import * as vscode from "vscode";
import * as path from "path";
import { Note } from "../notes/NoteParser";
import { generateCodePreview } from "./CodeFormatter";

/**
 * Generate markdown file content with header and instructions
 * @param notes Array of notes to include
 * @param workspaceFolder Workspace folder for resolving paths
 * @returns Complete markdown content with header
 */
export async function generateMarkdownFileContent(
	notes: Note[],
	workspaceFolder: vscode.WorkspaceFolder,
): Promise<string> {
	const enhancedMarkdown = await generateEnhancedMarkdown(notes, workspaceFolder);
	const now = new Date().toLocaleString();

	return `> You can now fully edit this markdown file!
> - Edit existing note content
> - Add new notes
> - Delete notes  
> - Change line numbers
> Save the file (Ctrl+S / Cmd+S) to apply all changes.

Generated: ${now}

---

# Vibe Notes

${enhancedMarkdown}`;
}

/**
 * Generate enhanced markdown with clickable links and optional code snippets
 * @param notes Array of notes to format
 * @param workspaceFolder Workspace folder for resolving paths
 * @param includeCode Whether to include code snippets (default: true)
 * @returns Formatted markdown content
 */
export async function generateEnhancedMarkdown(
	notes: Note[],
	workspaceFolder: vscode.WorkspaceFolder,
	includeCode: boolean = true,
): Promise<string> {
	if (notes.length === 0) {
		return "*No notes found*";
	}

	// Group by file path and sort
	const groupedByFile = notes.reduce(
		(acc, note) => {
			if (!acc[note.filePath]) {
				acc[note.filePath] = [];
			}
			acc[note.filePath].push(note);
			return acc;
		},
		{} as Record<string, Note[]>,
	);

	// Sort file paths
	const sortedFilePaths = Object.keys(groupedByFile).sort();

	// Generate markdown
	const markdownSections: string[] = [];

	for (const filePath of sortedFilePaths) {
		// Try to read the file content (only if includeCode is true)
		let fileLines: string[] = [];
		if (includeCode) {
			try {
				const fullPath = path.join(workspaceFolder.uri.fsPath, filePath);
				const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(fullPath));
				fileLines = Buffer.from(fileContent).toString("utf8").split("\n");
			} catch (error) {
				// File not found or unable to read, continue without code preview
			}
		}

		// File path header with clickable link (using relative path)
		markdownSections.push(`## [${filePath}](${filePath})`);
		markdownSections.push("");

		// Sort notes by line number
		const fileNotes = groupedByFile[filePath].sort((a, b) => a.startLine - b.startLine);

		// Each note
		for (const note of fileNotes) {
			// Create line range text
			const lineSpec = note.startLine === note.endLine ? `L${note.startLine}` : `L${note.startLine}-${note.endLine}`;

			// Create clickable link to specific line (using relative path)
			const lineLink = `${filePath}#L${note.startLine}`;

			// Line number as link
			markdownSections.push(`### [${lineSpec}](${lineLink})`);
			markdownSections.push("");

			// Code preview in quote block (only if includeCode is true)
			if (includeCode && fileLines.length > 0) {
				const codePreviewLines = generateCodePreview(fileLines, note.startLine, note.endLine);
				if (codePreviewLines.length > 0) {
					markdownSections.push(...codePreviewLines);
					markdownSections.push("");
				}
			}

			markdownSections.push(note.comment);
			markdownSections.push("");
		}
	}

	// Remove the last empty line
	if (markdownSections[markdownSections.length - 1] === "") {
		markdownSections.pop();
	}

	return markdownSections.join("\n");
}
