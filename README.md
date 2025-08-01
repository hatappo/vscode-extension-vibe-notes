# Shadow Comments

Keep private code comments that live in the shadows - never touching your source files or git history. Perfect for personal notes, code reviews, and AI-assisted coding workflows.

## Features

- Add comments to any line **without making any changes to the source file**.
- Comments appear at the end of the line
- **Visual indicators** at the next to line numbers in editor (editor gutter).
- Edit/Delete comments via **CodeLens buttons** or right-click menu
- **Tree view** to browse all comments
- Show as **Markdown**
- Copy comments to **`git notes`**.

## Quick Start

1. **Add a comment**: Right-click on any line → "Add Shadow Comment to Line" (opens a temporary editor)
2. **Edit/Delete**: Use the CodeLens buttons above commented lines
3. **View all comments**: Open the Shadow Comments panel in the Activity Bar

## Storage

Comments are stored in `.comments/comments.local.txt`.

> [!IMPORTANT]
> Add the `.comments` directory to your `.gitignore`.

```
src/file.ts#L10 "TODO: Refactor this function"
src/file.ts#L20-25 "This logic needs review"
```

## Commands

Access via Command Palette (Cmd/Ctrl+Shift+P):
- `Shadow Comments: Add Comment to Line`
- `Shadow Comments: Show Comments as Markdown`
- `Shadow Comments: Show Comments as JSON`
- `Shadow Comments: Save to Git Notes`

## Tips

- Comments appear as 💬 at line end (hover to see full text)
- Multi-line comments show with ".." suffix
- Save comments with Ctrl+S / Cmd+S in the temporary editor
- Use Git Notes to share comments: Save → `git push --push-notes`

## Requirements

- VS Code 1.101.0 or higher

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for details.
