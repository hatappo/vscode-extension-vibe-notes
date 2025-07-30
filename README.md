# VSCode Extension - Vibe Letter

A VSCode extension for managing line-specific comments in a local memo file. Perfect for code reviews and AI-assisted coding workflows.

## Features

- **Add Comments to Lines**: Right-click on any line or selection to add a comment
- **Visual Indicators**: See comment indicators in the editor gutter with a blue "C" icon
- **Multiple Export Formats**: Copy comments as raw text, markdown, or JSON
- **Auto-sync**: Comments are automatically saved to `.local.memo.txt`
- **Hover Support**: Hover over comment indicators to see the comment content

## Usage

### Adding Comments

1. Select a line or range of lines in your code
2. Right-click and select "Add Comment to Line"
3. Enter your comment in the dialog box

### Viewing Comments

- Comments are indicated by a blue "C" icon in the editor gutter
- Hover over the icon to see the comment content

### Exporting Comments

Use the Command Palette (Cmd/Ctrl+Shift+P) to access:
- `Copy Comments as Raw`: Copy the raw `.local.memo.txt` content
- `Copy Comments as Markdown`: Copy formatted markdown with clickable links
- `Copy Comments as JSON`: Copy comments as JSON structure

### Storage Format

Comments are stored in `.local.memo.txt` in your workspace root:

```
src/extension.ts:7 "Make this function name simpler and clearer"
src/extension.ts:13-15 "These comments are unnecessary.\nPlease remove them."
src/test/extension.test.ts:11 "Please add an explanation."
```

### Markdown Output Example

When copying as markdown, you get formatted output with clickable links:

```markdown
## [src/extension.ts](src/extension.ts)

### [line: 7](src/extension.ts:7)

Make this function name simpler and clearer

### [line: 13-15](src/extension.ts:13)

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

- Click-to-edit functionality on comment indicators is not yet implemented
- No markdown preview panel or comment list view (planned features)

## Release Notes

### 0.0.1

Initial release with core functionality:
- Add comments via context menu
- Display comment indicators in editor
- Copy comments in multiple formats
- File watching for automatic updates

## Development

See [docs/dev](./docs/dev) for development documentation.

## Notes

- The `.local.memo.txt` file is automatically added to `.gitignore`
- Comments support multi-line text with `\n` escaping
- File paths in markdown output are clickable links for easy navigation

**Enjoy!**