# Shadow Comments

Keep private code comments that live in the shadows - never touching your source files or git history. Perfect for personal notes, code reviews, and AI-assisted coding workflows.

## Features

- **Add Comments to Lines**: Right-click on any line or selection to add a comment
- **Visual Indicators**: See comment indicators in the editor gutter with a blue "C" icon
- **Comments Tree View**: Browse all comments in a dedicated side panel organized by file
- **Multiple Export Formats**: Copy comments as raw text, markdown, or JSON
- **Auto-sync**: Comments are automatically saved to `.local.comments.txt`
- **Hover Support**: Hover over comment indicators to see the comment content
- **Click to Navigate**: Click on comments in the tree view to jump to their location

## Usage

### Adding Comments

1. Select a line or range of lines in your code
2. Right-click and select "Add Comment to Line"
3. Enter your comment in the dialog box

### Editing/Deleting Comments

1. Place your cursor on a line that has a comment (indicated by blue "C" icon)
2. Right-click to open the context menu
3. Select "Edit Comment" to modify the comment text
4. Select "Delete Comment" to remove the comment (with confirmation)

### Viewing Comments

- Comments are indicated by a blue "C" icon in the editor gutter
- Hover over the icon to see the comment content
- Access the Comments Tree View from the Activity Bar (Shadow Comments icon)
- Tree view shows all comments organized by file
- Click on any comment to navigate to its location in the code

### Exporting Comments

Use the Command Palette (Cmd/Ctrl+Shift+P) to access:
- `Copy Comments as Raw`: Copy the raw `.local.comments.txt` content
- `Copy Comments as Markdown`: Copy formatted markdown with clickable links
- `Copy Comments as JSON`: Copy comments as JSON structure

### Storage Format

Comments are stored in `.local.comments.txt` in your workspace root:

```
src/extension.ts#L7 "Make this function name simpler and clearer"
src/extension.ts#L7,10 "Column 10 needs attention"
src/extension.ts#L13-15 "These comments are unnecessary.\nPlease remove them."
src/extension.ts#L7,10-8,12 "This range needs refactoring"
src/test/extension.test.ts#L11 "Please add an explanation."
```

Format: `filepath#L<line>[,<column>][-<endline>[,<endcolumn>]] "comment"`
- Column positions are optional
- Single line: `#L7` or `#L7,10` 
- Line range: `#L13-15`
- Range with columns: `#L7,10-8,12`

### Markdown Output Example

When copying as markdown, you get formatted output with clickable links:

```markdown
## [src/extension.ts](src/extension.ts)

### [line: 7](src/extension.ts#L7)

Make this function name simpler and clearer

### [line: 7:10](src/extension.ts#L7)

Column 10 needs attention

### [line: 13-15](src/extension.ts#L13)

These comments are unnecessary.
Please remove them.
```

## Requirements

- VS Code 1.102.0 or higher

## Extension Settings

Currently, this extension does not contribute any settings. Future versions may include:
- Custom memo file location
- Comment indicator styles
- Enable/disable features

## Known Issues

- No markdown preview panel (planned feature)

## Release Notes

### 0.0.1

Initial release with core functionality:
- Add comments via context menu
- Edit/Delete comments via context menu
- Display comment indicators in editor
- Comments tree view in side panel
- Copy comments in multiple formats (Raw/Markdown/JSON)
- File watching for automatic updates
- Support for #L notation with optional column positions

## Development

See [docs/dev](./docs/dev) for development documentation.

## Notes

- The `.local.comments.txt` file is automatically added to `.gitignore`
- Comments support multi-line text with `\n` escaping
- File paths in markdown output are clickable links for easy navigation

**Enjoy!**