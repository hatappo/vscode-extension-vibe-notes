import { parseNote, Note } from "../src/util/noteParser";

const testLines: string[] = [
	'src/extension.ts#L7 "Make this function name simpler and clearer"',
	'src/extension.ts#L13-15 "These notes are unnecessary.\\nPlease remove them."',
	'src/test/extension.test.ts#L11 "Please add an explanation. Change quotes from \\"\\" to \'\'."',
];

testLines.forEach((line: string) => {
	console.log("Input:", line);
	console.log("Parsed:", parseNote(line));
	console.log("---");
});

console.log("\n=== Note Parsing Test Complete ===\n");
const allNotes = testLines.map(parseNote).filter((n): n is Note => n !== null);
console.log(`Parsed ${allNotes.length} notes successfully.`);
allNotes.forEach((note, index) => {
	console.log(`\nNote ${index + 1}:`);
	console.log(`  File: ${note.filePath}`);
	console.log(`  Lines: ${note.startLine}-${note.endLine}`);
	console.log(`  Content: ${note.comment}`);
});