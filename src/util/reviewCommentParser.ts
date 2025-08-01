/** Review comment */
interface ReviewComment {
	filePath: string;
	startLine: number;
	endLine: number;
	comment: string;
	raw: string; // Holds the entire original line
}

/** Parse result */
interface ParseResult {
	success: boolean;
	comments?: ReviewComment[];
	errors?: ParseError[];
}

/** Parse error */
interface ParseError {
	line: number;
	content: string;
	error: string;
}

/** Regular expression for parsing review comments */
// Matches: file.ts#L7 or file.ts#L7-9
const reviewLineRegex: RegExp = /^(.+?)#L(\d+(?:-\d+)?)\s+"((?:[^"\\]|\\.)*)"\s*$/;


/** Parse a single line review comment */
function parseReviewComment(line: string): ReviewComment | null {
	const match = line.match(reviewLineRegex);
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
		comment,
		raw: line, // Holds the entire original line
	};
}

/** Parse multiple line review comments (with error handling) */
function parseReviewFileWithErrors(content: string): ParseResult {
	const lines = content.split("\n");
	const comments: ReviewComment[] = [];
	const errors: ParseError[] = [];

	lines.forEach((line, index) => {
		if (!line.trim()) {
			return;
		} // Skip empty lines

		const parsed = parseReviewComment(line);
		if (parsed) {
			comments.push(parsed);
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
		comments,
		errors: errors.length > 0 ? errors : undefined,
	};
}

export { parseReviewComment, parseReviewFileWithErrors };

export type { ReviewComment, ParseResult, ParseError };
