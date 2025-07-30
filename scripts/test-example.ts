import { convertToMarkdown, parseReviewComment, ReviewComment } from "../src/util/reviewCommentParser";

const testLines: string[] = [
  'src/extension.ts:7 "Make this function name simpler and clearer"',
  'src/extension.ts:13-15 "These comments are unnecessary.\\nPlease remove them."',
  'src/test/extension.test.ts:11 "Please add an explanation. Change quotes from \\"\\\" to \'\'."'
];

testLines.forEach((line: string) => {
  console.log('Input:', line);
  console.log('Parsed:', parseReviewComment(line));
  console.log('---');
});

console.log('\n=== Markdown Output ===\n');
const allComments = testLines.map(parseReviewComment).filter((c): c is ReviewComment => c !== null);
console.log(convertToMarkdown(allComments));
