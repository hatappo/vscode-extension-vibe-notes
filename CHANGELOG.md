# Change Log

All notable changes to the "shadow-comments" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.4.0] - 2025-08-05

### Added
- "Append to Git Notes" command to append notes to existing git notes
- Editor split mode configuration (none/horizontal/vertical)
- "Edit Note as Markdown" CodeLens button
- All commands now have "Vibe Notes: " prefix for better discoverability
- Git Notes commands in Tree View toolbar

### Changed
- Save to Git Notes now exports in markdown format
- Updated CodeLens button titles for clarity
- Hide "Collapse All" button in Tree View
- Improved button icons for consistency

### Fixed
- Horizontal split editor behavior when opening note editor

## [0.3.1] - 2025-08-04

### Fixed
- Minor README fixes

## [0.3.0] - 2025-08-03

### Added
- General Notes support for project-wide notes not tied to specific files
  - Use `## /` in markdown format to create general notes
  - Display as "/ (General Notes)" in tree view
- Extension icon for marketplace display
- .vscodeignore file to optimize package size
- Configuration option to show/hide markdown preamble

### Changed
- Temp file headers now use HTML comments for language neutrality
- Markdown preamble changed to HTML comment format
- Tree view button order (Open as Markdown is now first)
- Command titles are now English-only for simplicity

### Fixed
- Negative line number errors for General Notes in UI components

## [0.2.0] - 2025-08-03

### Added
- Copy for AI/LLM feature with configurable prompt and code inclusion options
- Internationalization (i18n) support for Japanese and English
- "Vibe Notes:" prefix to all command titles for better discoverability

### Changed
- Major folder structure reorganization based on responsibilities
- Renamed NoteDecorationProvider to NoteDecorationManager
- Refactored extension.ts from 779 to ~150 lines (80% reduction)
- Enhanced multi-line code preview with proper line number alignment
- Improved markdown format with instructions before main content
- Reordered toolbar buttons for better workflow

### Fixed
- Code indentation normalization in markdown quotes
- Resource cleanup using VSCode's standard disposable pattern

## [0.1.0] - 2025-08-01

### Added
- Inline comment display with 💬 emoji at line end
- Multi-line comment indicator with ".." suffix
- Hover support for full comment text on inline display
- Temporary file editor for adding/editing multi-line comments
- Auto-close editor after saving comment

### Changed
- Migrated storage from `.local.comments.txt` to `.comments/comments.local.txt`
- Automatic migration for existing users
- Replaced copy commands with show commands (open in editor with auto-select)
- Changed "Sync to Git Notes" to "Save to Git Notes" with 💾 icon
- All commands now have "Shadow Comments:" prefix for better discoverability
- Tree view title simplified (removed duplicate "Comments")

### Removed
- Show button in CodeLens (after implementation review)
- Debug console.log statements

### Fixed
- Code duplication in edit/delete commands (refactored with common functions)

## [0.0.3] - 2025-07-31

### Changed
- Lower the supported version of VSCode to 1.101.0.

## [0.0.2] - 2025-07-31

### Fixed
- .local.comments.txt file is now created only when adding the first comment
- No longer creates empty files in repositories just by having the extension installed

## [0.0.1] - 2025-07-31

### Added
- Initial release
- Add/edit/delete comments via context menu and CodeLens
- Visual indicators with C-shaped arc in editor gutter
- Comments tree view in side panel
- Export comments in multiple formats (Raw/Markdown/JSON)
- Git Notes integration for permanent storage
- Multi-workspace support
- File watching for automatic updates