import { ReviewComment } from "./reviewCommentParser";

/**
 * Parsed comment from markdown
 */
export interface ParsedComment {
	filePath: string;
	startLine: number;
	endLine: number;
	comment: string;
}

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
		
		// Match line header: ### [L10](src/file.ts#L10) or ### [L10-20](src/file.ts#L10)
		const lineMatch = line.match(/^###\s+\[L([\d\-]+)\]\(.*?\)/);
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
			// Skip quote blocks (code preview)
			if (line.startsWith("> ")) {
				continue;
			}
			
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

/**
 * Parse markdown and extract all comments as complete ReviewComment objects
 */
export function parseMarkdownToComments(markdownContent: string): { 
	comments: ParsedComment[]; 
	errors: string[];
} {
	const comments: ParsedComment[] = [];
	const errors: string[] = [];
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
				const parsed = parseLineSpec(currentFile, currentLineSpec, commentLines.join("\n").trim());
				if (parsed.error) {
					errors.push(parsed.error);
				} else if (parsed.comment) {
					comments.push(parsed.comment);
				}
			}
			
			currentFile = fileMatch[1];
			currentLineSpec = null;
			collectingComment = false;
			commentLines = [];
			continue;
		}
		
		// Match line header: ### [L10](src/file.ts#L10) or ### [L10-20](src/file.ts#L10)
		const lineMatch = line.match(/^###\s+\[L([\d\-]+)\]\(.*?\)/);
		if (lineMatch && currentFile) {
			// Save previous comment if exists
			if (currentLineSpec && commentLines.length > 0) {
				const parsed = parseLineSpec(currentFile, currentLineSpec, commentLines.join("\n").trim());
				if (parsed.error) {
					errors.push(parsed.error);
				} else if (parsed.comment) {
					comments.push(parsed.comment);
				}
			}
			
			currentLineSpec = lineMatch[1];
			collectingComment = true;
			commentLines = [];
			continue;
		}
		
		// Collect comment lines
		if (collectingComment) {
			// Skip quote blocks (code preview)
			if (line.startsWith("> ")) {
				continue;
			}
			
			// Stop collecting at next header or empty line followed by header
			const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
			if (line === "" && (nextLine.startsWith("##") || nextLine.startsWith("###"))) {
				collectingComment = false;
				if (currentFile && currentLineSpec && commentLines.length > 0) {
					const parsed = parseLineSpec(currentFile, currentLineSpec, commentLines.join("\n").trim());
					if (parsed.error) {
						errors.push(parsed.error);
					} else if (parsed.comment) {
						comments.push(parsed.comment);
					}
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
		const parsed = parseLineSpec(currentFile, currentLineSpec, commentLines.join("\n").trim());
		if (parsed.error) {
			errors.push(parsed.error);
		} else if (parsed.comment) {
			comments.push(parsed.comment);
		}
	}
	
	return { comments, errors };
}

/**
 * Parse line specification and create ParsedComment
 */
function parseLineSpec(filePath: string, lineSpec: string, commentText: string): {
	comment?: ParsedComment;
	error?: string;
} {
	if (!commentText) {
		return { error: `Empty comment for ${filePath}#L${lineSpec}` };
	}
	
	// Parse line spec: "10" or "10-20"
	if (lineSpec.includes("-")) {
		const [startStr, endStr] = lineSpec.split("-");
		const startLine = parseInt(startStr, 10);
		const endLine = parseInt(endStr, 10);
		
		if (isNaN(startLine) || isNaN(endLine)) {
			return { error: `Invalid line range: ${lineSpec}` };
		}
		
		if (startLine <= 0 || endLine <= 0) {
			return { error: `Line numbers must be positive: ${lineSpec}` };
		}
		
		if (startLine > endLine) {
			return { error: `Invalid range (start > end): ${lineSpec}` };
		}
		
		return {
			comment: {
				filePath,
				startLine,
				endLine,
				comment: commentText
			}
		};
	} else {
		const line = parseInt(lineSpec, 10);
		
		if (isNaN(line)) {
			return { error: `Invalid line number: ${lineSpec}` };
		}
		
		if (line <= 0) {
			return { error: `Line number must be positive: ${lineSpec}` };
		}
		
		return {
			comment: {
				filePath,
				startLine: line,
				endLine: line,
				comment: commentText
			}
		};
	}
}