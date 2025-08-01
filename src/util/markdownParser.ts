import { ReviewComment } from "./reviewCommentParser";

/**
 * Parse markdown content and extract comments
 * Only extracts content of existing comments, does not support adding/removing comments
 */
export function parseMarkdownComments(markdownContent: string): Map<string, string> {
	const commentMap = new Map<string, string>();
	const lines = markdownContent.split("\n");
	
	let currentFile: string | null = null;
	let currentLineSpec: string | null = null;
	let collectingComment = false;
	let commentLines: string[] = [];
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		
		// Match file header: ## [src/file.ts](src/file.ts)
		const fileMatch = line.match(/^##\s+\[(.+?)\]/);
		if (fileMatch) {
			// Save previous comment if exists
			if (currentFile && currentLineSpec && commentLines.length > 0) {
				const key = `${currentFile}#L${currentLineSpec}`;
				commentMap.set(key, commentLines.join("\n").trim());
			}
			
			currentFile = fileMatch[1];
			currentLineSpec = null;
			collectingComment = false;
			commentLines = [];
			continue;
		}
		
		// Match line header: ### [Line 10](src/file.ts#L10) or ### [Lines 10-20](src/file.ts#L10)
		const lineMatch = line.match(/^###\s+\[Lines?\s+([\d\-]+)\]/);
		if (lineMatch && currentFile) {
			// Save previous comment if exists
			if (currentLineSpec && commentLines.length > 0) {
				const key = `${currentFile}#L${currentLineSpec}`;
				commentMap.set(key, commentLines.join("\n").trim());
			}
			
			currentLineSpec = lineMatch[1];
			collectingComment = true;
			commentLines = [];
			continue;
		}
		
		// Collect comment lines
		if (collectingComment) {
			// Stop collecting at next header or empty line followed by header
			const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
			if (line === "" && (nextLine.startsWith("##") || nextLine.startsWith("###"))) {
				collectingComment = false;
				if (currentFile && currentLineSpec && commentLines.length > 0) {
					const key = `${currentFile}#L${currentLineSpec}`;
					commentMap.set(key, commentLines.join("\n").trim());
				}
				commentLines = [];
			} else if (line !== "" || commentLines.length > 0) {
				// Include empty lines within comments, but not leading empty lines
				commentLines.push(line);
			}
		}
	}
	
	// Save last comment if exists
	if (currentFile && currentLineSpec && commentLines.length > 0) {
		const key = `${currentFile}#L${currentLineSpec}`;
		commentMap.set(key, commentLines.join("\n").trim());
	}
	
	return commentMap;
}

/**
 * Find matching comment in the list by file and line range
 */
export function findMatchingComment(
	comments: ReviewComment[],
	filePath: string,
	lineSpec: string
): ReviewComment | undefined {
	return comments.find(comment => {
		if (comment.filePath !== filePath) {
			return false;
		}
		
		// Build expected line spec for this comment
		const expectedLineSpec = comment.startLine === comment.endLine
			? `${comment.startLine}`
			: `${comment.startLine}-${comment.endLine}`;
		
		return expectedLineSpec === lineSpec;
	});
}

/**
 * Apply markdown changes to comments (only updates content, no add/delete)
 */
export function applyMarkdownChanges(
	existingComments: ReviewComment[],
	markdownComments: Map<string, string>
): { updatedComments: ReviewComment[], hasChanges: boolean } {
	let hasChanges = false;
	const updatedComments: ReviewComment[] = [];
	
	for (const comment of existingComments) {
		const lineSpec = comment.startLine === comment.endLine
			? `${comment.startLine}`
			: `${comment.startLine}-${comment.endLine}`;
		const key = `${comment.filePath}#L${lineSpec}`;
		
		const newContent = markdownComments.get(key);
		if (newContent !== undefined && newContent !== comment.comment) {
			// Content changed
			hasChanges = true;
			updatedComments.push({
				...comment,
				comment: newContent
			});
		}
	}
	
	return { updatedComments, hasChanges };
}