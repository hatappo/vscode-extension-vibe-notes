/** Note */
interface Note {
	filePath: string;
	startLine: number;
	endLine: number;
	comment: string;
	raw: string; // Holds the entire original line
}

/** Parse result */
interface ParseResult {
	success: boolean;
	notes?: Note[];
	errors?: ParseError[];
}

/** Parse error */
interface ParseError {
	line: number;
	content: string;
	error: string;
}

/** Regular expression for parsing notes */
// Matches: file.ts#L7 or file.ts#L7-9
const noteLineRegex: RegExp = /^(.+?)#L(\d+(?:-\d+)?)\s+"((?:[^"\\]|\\.)*)"\s*$/;


/** Parse a single line note */
function parseNote(line: string): Note | null {
	const match = line.match(noteLineRegex);
	if (!match) {
		return null;
	}

	const [, filePath, positionSpec, rawComment] = match;

	// Unescape the comment
	const comment = rawComment.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");

	// Parse positions
	let startLine: number;
	let endLine: number;

	if (positionSpec.includes("-")) {
		// Range: L7-9
		const [startPos, endPos] = positionSpec.split("-");
		startLine = Number(startPos);
		endLine = Number(endPos);
	} else {
		// Single position: L7
		startLine = Number(positionSpec);
		endLine = startLine;
	}

	return {
		filePath,
		startLine,
		endLine,
		comment: comment,
		raw: line, // Holds the entire original line
	};
}

/** Parse multiple line notes (with error handling) */
function parseNoteFileWithErrors(content: string): ParseResult {
	const lines = content.split("\n");
	const notes: Note[] = [];
	const errors: ParseError[] = [];

	lines.forEach((line, index) => {
		if (!line.trim()) {
			return;
		} // Skip empty lines

		const parsed = parseNote(line);
		if (parsed) {
			notes.push(parsed);
		} else {
			errors.push({
				line: index + 1,
				content: line,
				error: "Invalid format",
			});
		}
	});

	return {
		success: errors.length === 0,
		notes,
		errors: errors.length > 0 ? errors : undefined,
	};
}

export { parseNote, parseNoteFileWithErrors };

export type { Note, ParseResult, ParseError };
