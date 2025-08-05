# Vibe Notes

Private code notes that vibe with your workflow - never touching your source files or git history. Perfect for personal notes, code reviews, and AI-assisted coding workflows.

Japanese Documentation: [README.ja.md](./README.ja.md)

## Features

- Add notes to any line **without making any changes to the source file**
- **General Notes** for project-wide notes not tied to specific files
- Notes appear at the end of the line with 💬 indicator
- **Visual indicators** next to line numbers in editor (editor gutter)
- Edit/Delete notes via **CodeLens buttons** or right-click menu
- **Tree view** to browse all notes by file and project
- Export notes as **Markdown** with customizable format
- **Copy for LLM** with AI-friendly formatting
- Save notes to **`git notes`** for team sharing

## Quick Start

1. **Add a note**: Right-click on any line → "Add Vibe Note to Line" (opens a temporary editor)
2. **Edit/Delete**: Use the CodeLens buttons above noted lines
3. **View all notes**: Open the Vibe Notes panel in the Activity Bar
4. **General Notes**: Use "Open as Markdown" → Add notes under `## /` section
5. **Copy for AI**: Use "Copy for LLM" button in tree view toolbar for AI-friendly format

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
- `Vibe Notes: Add Note to Line` - Add a note to the current line
- `Vibe Notes: Edit Note at Cursor` - Edit existing note
- `Vibe Notes: Delete Note at Cursor` - Delete existing note
- `Vibe Notes: Open Notes as Markdown` - View/edit all notes in markdown format
- `Vibe Notes: Copy for LLM` - Copy notes in AI-friendly format
- `Vibe Notes: Save to Git Notes` - Export notes to git notes
- `Vibe Notes: Append to Git Notes` - Append notes to existing git notes
- `Vibe Notes: Refresh Tree` - Refresh the notes tree view

## Tips

- Notes appear as 💬 at line end (hover to see full text)
- Multi-line notes show with ".." suffix
- Save notes with Ctrl+S / Cmd+S in the temporary editor
- Use Git Notes to share notes: Save → `git push origin refs/notes/commits`
- General Notes (`## /`) are perfect for TODOs, project documentation, and cross-file notes

## Configuration

Available settings:
- `vibe-notes.showMarkdownPreamble` - Show/hide the instructional header in markdown files (default: true)
- `vibe-notes.copyForLLM.defaultPrompt` - Default prompt for LLM copy feature
- `vibe-notes.copyForLLM.includeCode` - Include code snippets when copying for LLM (default: false)
- `vibe-notes.editorSplitMode` - How to split editor when opening notes (none/horizontal/vertical, default: horizontal)

## Requirements

- VS Code 1.101.0 or higher

## Roadmap

Future features under consideration:

- **Diff View Support** - Display and add notes in Git diff views and VS Code's comparison views
- **Semantic Note Anchoring** - Attach notes to code elements (classes, methods, functions) instead of line numbers, so notes follow code through refactoring
- **Git Notes Import** - Import existing git notes into Vibe Notes format, enabling seamless migration and team collaboration
- **Git Appraise Integration** - Export notes in [git-appraise](https://github.com/google/git-appraise) compatible JSON format for code review workflows
- **Custom LLM Prompt Templates** - User-definable formats for LLM prompt generation, allowing customized output structures

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for details.