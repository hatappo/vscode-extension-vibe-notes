/**
 * Parsed note from markdown
 */
export interface ParsedNote {
	filePath: string;
	startLine: number;
	endLine: number;
	comment: string;
}

/**
 * Parse markdown and extract all notes as complete Note objects
 */
export function parseMarkdownToNotes(markdownContent: string): {
	notes: ParsedNote[];
	errors: string[];
} {
	const notes: ParsedNote[] = [];
	const errors: string[] = [];
	const lines = markdownContent.split("\n");

	let currentFile: string | null = null;
	let currentLineSpec: string | null = null;
	let collectingNote = false;
	let noteLines: string[] = [];
	let foundSeparator = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Skip all lines until we find the separator starting with "---"
		if (!foundSeparator) {
			if (line.startsWith("---")) {
				foundSeparator = true;
			}
			continue;
		}

		// Match General section: ## / or ## / followed by any text
		if (line === "## /" || line.startsWith("## / ")) {
			// Save previous note if exists
			if (currentFile && currentLineSpec && noteLines.length > 0) {
				const parsed = parseLineSpec(currentFile, currentLineSpec, noteLines.join("\n").trim());
				if (parsed.error) {
					errors.push(parsed.error);
				} else if (parsed.note) {
					notes.push(parsed.note);
				}
			}

			currentFile = "/";
			currentLineSpec = "0"; // Use "0" as special line spec for general notes
			collectingNote = true;
			noteLines = [];
			continue;
		}

		// Match file header: ## [src/file.ts](src/file.ts)
		const fileMatch = line.match(/^##\s+\[(.+?)\]/);
		if (fileMatch) {
			// Save previous note if exists
			if (currentFile && currentLineSpec && noteLines.length > 0) {
				const parsed = parseLineSpec(currentFile, currentLineSpec, noteLines.join("\n").trim());
				if (parsed.error) {
					errors.push(parsed.error);
				} else if (parsed.note) {
					notes.push(parsed.note);
				}
			}

			currentFile = fileMatch[1];
			currentLineSpec = null;
			collectingNote = false;
			noteLines = [];
			continue;
		}

		// Match line header: ### [L10](src/file.ts#L10) or ### [L10-20](src/file.ts#L10)
		const lineMatch = line.match(/^###\s+\[L([\d\-]+)\]\(.*?\)/);
		if (lineMatch && currentFile && currentFile !== "/") {
			// Save previous note if exists
			if (currentLineSpec && noteLines.length > 0) {
				const parsed = parseLineSpec(currentFile, currentLineSpec, noteLines.join("\n").trim());
				if (parsed.error) {
					errors.push(parsed.error);
				} else if (parsed.note) {
					notes.push(parsed.note);
				}
			}

			currentLineSpec = lineMatch[1];
			collectingNote = true;
			noteLines = [];
			continue;
		}

		// Collect note lines
		if (collectingNote) {
			// Special handling for General Notes - collect everything until next ## section
			if (currentFile === "/") {
				// Check if this line starts a new section (## )
				if (line.startsWith("## ")) {
					// Process the line in the next iteration
					i--;
					collectingNote = false;
					if (currentLineSpec && noteLines.length > 0) {
						const parsed = parseLineSpec(currentFile, currentLineSpec, noteLines.join("\n").trim());
						if (parsed.error) {
							errors.push(parsed.error);
						} else if (parsed.note) {
							notes.push(parsed.note);
						}
					}
					noteLines = [];
				} else {
					// Include everything in General Notes (including ### headers)
					noteLines.push(line);
				}
			} else {
				// Normal file notes handling
				// Skip quote blocks (code preview)
				if (line.startsWith("> ")) {
					continue;
				}

				// Stop collecting at next header or empty line followed by header
				const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
				if (line === "" && (nextLine.startsWith("##") || nextLine.startsWith("###"))) {
					collectingNote = false;
					if (currentFile && currentLineSpec && noteLines.length > 0) {
						const parsed = parseLineSpec(currentFile, currentLineSpec, noteLines.join("\n").trim());
						if (parsed.error) {
							errors.push(parsed.error);
						} else if (parsed.note) {
							notes.push(parsed.note);
						}
					}
					noteLines = [];
				} else if (line !== "" || noteLines.length > 0) {
					// Include empty lines within notes, but not leading empty lines
					noteLines.push(line);
				}
			}
		}
	}

	// Save last note if exists
	if (currentFile && currentLineSpec && noteLines.length > 0) {
		const parsed = parseLineSpec(currentFile, currentLineSpec, noteLines.join("\n").trim());
		if (parsed.error) {
			errors.push(parsed.error);
		} else if (parsed.note) {
			notes.push(parsed.note);
		}
	}

	return { notes, errors };
}

/**
 * Parse line specification and create ParsedNote
 */
function parseLineSpec(
	filePath: string,
	lineSpec: string,
	noteText: string,
): {
	note?: ParsedNote;
	error?: string;
} {
	if (!noteText) {
		return { error: `Empty note for ${filePath}#L${lineSpec}` };
	}

	// Parse line spec: "10" or "10-20"
	if (lineSpec.includes("-")) {
		const [startStr, endStr] = lineSpec.split("-");
		const startLine = parseInt(startStr, 10);
		const endLine = parseInt(endStr, 10);

		if (isNaN(startLine) || isNaN(endLine)) {
			return { error: `Invalid line range: ${lineSpec}` };
		}

		if (startLine < 0 || endLine < 0) {
			return { error: `Line numbers must be non-negative: ${lineSpec}` };
		}

		if (startLine > endLine) {
			return { error: `Invalid range (start > end): ${lineSpec}` };
		}

		return {
			note: {
				filePath,
				startLine,
				endLine,
				comment: noteText,
			},
		};
	} else {
		const line = parseInt(lineSpec, 10);

		if (isNaN(line)) {
			return { error: `Invalid line number: ${lineSpec}` };
		}

		if (line < 0) {
			return { error: `Line number must be non-negative: ${lineSpec}` };
		}

		return {
			note: {
				filePath,
				startLine: line,
				endLine: line,
				comment: noteText,
			},
		};
	}
}
