# Change Log

All notable changes to the "shadow-comments" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.0.5] - 2025-08-04

### Notice
- Added migration notice to README - Shadow Comments has been replaced by Vibe Notes
- Updated repository URL to point to new location

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