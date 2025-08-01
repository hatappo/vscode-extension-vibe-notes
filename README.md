# Vibe Notes

Private code notes that vibe with your workflow - never touching your source files or git history. Perfect for personal notes, code reviews, and AI-assisted coding workflows.

## Features

- Add notes to any line **without making any changes to the source file**.
- Notes appear at the end of the line
- **Visual indicators** at the next to line numbers in editor (editor gutter).
- Edit/Delete notes via **CodeLens buttons** or right-click menu
- **Tree view** to browse all notes
- Show as **Markdown**
- Copy notes to **`git notes`**.

## Quick Start

1. **Add a note**: Right-click on any line → "Add Vibe Note to Line" (opens a temporary editor)
2. **Edit/Delete**: Use the CodeLens buttons above noted lines
3. **View all notes**: Open the Vibe Notes panel in the Activity Bar

## Storage

Note data is stored in the `.notes` folder.

> [!IMPORTANT]
> Add the `.notes` directory and `.notes.local.md` file to your `.gitignore`.

```bash
# Add to .gitignore
echo "" >> .gitignore
echo "# Vibe Notes" >> .gitignore
echo ".notes/" >> .gitignore
echo ".notes.local.md" >> .gitignore
```

## Commands

Access via Command Palette (Cmd/Ctrl+Shift+P):
- `Vibe Notes: Add Note to Line`
- `Vibe Notes: Open Notes as Markdown`
- `Vibe Notes: Save to Git Notes`

## Tips

- Notes appear as 💬 at line end (hover to see full text)
- Multi-line notes show with ".." suffix
- Save notes with Ctrl+S / Cmd+S in the temporary editor
- Use Git Notes to share notes: Save → `git push --push-notes`

## Requirements

- VS Code 1.101.0 or higher

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for details.