import { convertToMarkdown, parseReviewComment, ReviewComment } from "../src/util/reviewCommentParser";

const testLines: string[] = [
  'src/extension.ts#L7 "Make this function name simpler and clearer"',
  'src/extension.ts#L7,10 "Column 10 needs attention"',
  'src/extension.ts#L13-15 "These comments are unnecessary.\\nPlease remove them."',
  'src/extension.ts#L7,10-8,12 "This range needs refactoring"',
  'src/test/extension.test.ts#L11 "Please add an explanation. Change quotes from \\"\\\" to \'\'."'
];

testLines.forEach((line: string) => {
  console.log('Input:', line);
  console.log('Parsed:', parseReviewComment(line));
  console.log('---');
});

console.log('\n=== Markdown Output ===\n');
const allComments = testLines.map(parseReviewComment).filter((c): c is ReviewComment => c !== null);
console.log(convertToMarkdown(allComments));
