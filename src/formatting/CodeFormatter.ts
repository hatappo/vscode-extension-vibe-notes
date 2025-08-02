/**
 * Calculate minimum indent for a set of lines (treating tabs as 4 spaces)
 * @param lines Array of code lines
 * @returns Minimum indent level in spaces
 */
function calculateMinimumIndent(lines: string[]): number {
	let minIndent = Infinity;

	for (const line of lines) {
		const trimmedLine = line.trim();
		if (trimmedLine.length > 0) {
			// Count leading whitespace
			let indent = 0;
			for (const char of line) {
				if (char === " ") {
					indent += 1;
				} else if (char === "\t") {
					indent += 4;
				} else {
					break;
				}
			}
			minIndent = Math.min(minIndent, indent);
		}
	}

	return minIndent === Infinity ? 0 : minIndent;
}

/**
 * Remove specified amount of indent from a line
 * @param line Code line to process
 * @param indentToRemove Amount of indent to remove (in spaces)
 * @returns Line with indent removed
 */
function removeIndent(line: string, indentToRemove: number): string {
	if (indentToRemove === 0 || line.trim().length === 0) {
		return line;
	}

	let removedCount = 0;
	let i = 0;

	while (i < line.length && removedCount < indentToRemove) {
		if (line[i] === " ") {
			removedCount += 1;
			i += 1;
		} else if (line[i] === "\t") {
			removedCount += 4;
			i += 1;
		} else {
			break;
		}
	}

	return line.substring(i);
}

/**
 * Generate code preview with normalized indentation
 * @param fileLines All lines in the file
 * @param startLine Starting line number (1-based)
 * @param endLine Ending line number (1-based)
 * @returns Array of formatted preview lines
 */
export function generateCodePreview(fileLines: string[], startLine: number, endLine: number): string[] {
	const codePreviewLines: string[] = [];

	if (fileLines.length === 0) {
		return codePreviewLines;
	}

	const actualEndLine = Math.min(endLine, fileLines.length);
	const maxLineNumWidth = actualEndLine.toString().length;

	// Collect target lines
	const targetLines: { lineNum: number; content: string }[] = [];
	const rawLines: string[] = [];

	for (let lineNum = startLine; lineNum <= actualEndLine; lineNum++) {
		const content = fileLines[lineNum - 1];
		if (content !== undefined) {
			targetLines.push({ lineNum, content });
			rawLines.push(content);
		}
	}

	// Calculate minimum indent
	const minIndent = calculateMinimumIndent(rawLines);

	// Process each line
	for (const { lineNum, content } of targetLines) {
		const processedLine = removeIndent(content, minIndent);
		const paddedLineNum = lineNum.toString().padStart(maxLineNumWidth, " ");
		codePreviewLines.push(`> ${paddedLineNum}: ${processedLine}`);
	}

	return codePreviewLines;
}
