/** Review comment */
interface ReviewComment {
  filePath: string;
  startLine: number;
  endLine: number;
  comment: string;
  raw: string;  // Holds the entire original line
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
const reviewLineRegex: RegExp = /^(.+?):(\d+(?:-\d+)?)\s+"((?:[^"\\]|\\.)*)"\s*$/;

/** Parse a single line review comment */
function parseReviewComment(line: string): ReviewComment | null {
  const match = line.match(reviewLineRegex);
  if (!match) {return null;}
  
  const [, filePath, lineSpec, rawComment] = match;
  
  // Unescape the comment
  const comment = rawComment
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
  
  // Parse line numbers
  const lineNumbers = lineSpec.includes('-')
    ? lineSpec.split('-').map(Number)
    : [Number(lineSpec), Number(lineSpec)];
  
  return {
    filePath,
    startLine: lineNumbers[0],
    endLine: lineNumbers[1],
    comment,
    raw: line  // Holds the entire original line
  };
}

/** Parse multiple line review comments */
function parseReviewFile(content: string): ReviewComment[] {
  return content
    .split('\n')
    .filter((line: string) => line.trim()) // Exclude empty lines
    .map(parseReviewComment)
    .filter((comment): comment is ReviewComment => comment !== null); // Exclude lines that failed to parse
}

/** Parse multiple line review comments (with error handling) */
function parseReviewFileWithErrors(content: string): ParseResult {
  const lines = content.split('\n');
  const comments: ReviewComment[] = [];
  const errors: ParseError[] = [];
  
  lines.forEach((line, index) => {
    if (!line.trim()) {return;} // Skip empty lines
    
    const parsed = parseReviewComment(line);
    if (parsed) {
      comments.push(parsed);
    } else {
      errors.push({
        line: index + 1,
        content: line,
        error: 'Invalid format'
      });
    }
  });
  
  return {
    success: errors.length === 0,
    comments,
    errors: errors.length > 0 ? errors : undefined
  };
}

/** Convert multiple line review comments to markdown */
function convertToMarkdown(comments: ReviewComment[]): string {
  if (comments.length === 0) {return '';}
  
  // Group by file path
  const groupedByFile = comments.reduce((acc, comment) => {
    if (!acc[comment.filePath]) {
      acc[comment.filePath] = [];
    }
    acc[comment.filePath].push(comment);
    return acc;
  }, {} as Record<string, ReviewComment[]>);
  
  // Generate markdown
  const markdownSections: string[] = [];
  
  for (const [filePath, fileComments] of Object.entries(groupedByFile)) {
    // File path header
    markdownSections.push(`## ${filePath}`);
    markdownSections.push('');
    
    // Each comment
    for (const comment of fileComments) {
      // Line number header
      const lineHeader = comment.startLine === comment.endLine
        ? `### line: ${comment.startLine}`
        : `### line: ${comment.startLine}-${comment.endLine}`;
      
      markdownSections.push(lineHeader);
      markdownSections.push('');
      markdownSections.push(comment.comment);
      markdownSections.push('');
    }
  }
  
  // Remove the last empty line
  if (markdownSections[markdownSections.length - 1] === '') {
    markdownSections.pop();
  }
  
  return markdownSections.join('\n');
}

export {
  parseReviewComment,
  parseReviewFile,
  parseReviewFileWithErrors,
  convertToMarkdown
};

export type {
  ReviewComment,
  ParseResult,
  ParseError
};
