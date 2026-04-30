# Change Log

All notable changes to the "Minecraft Plugin Development" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.9] - 2026-04-13

### Added
- Added support for Minecraft versions 26.1, 26.1.1, 26.1.2.
- Added support for Paper API as a project type.
- Added optional Lombok support with automatic annotation processor configuration.

## [1.0.8] - 2025-10-24

### Added
- Added support for Minecraft versions 1.21.10, 1.21.9, 1.21.8, 1.21.6, 1.21.5 and 1.21.2.

## [1.0.7] - 2025-10-22

### Added
- Added support for Visual Studio Code >= 1.78.2.

## [1.0.6] - 25-07-21

### Fixed
- Fixed the extension activation issue

## [1.0.5] - 2025-07-19

### Added
- Added Menu Editor for creating custom GUI menus visually

### Improved
- Getter/Setter Generator:
  - Now detects existing getters and setters to avoid duplication
  - Fixed static modifier handling for non-static fields
  - Added support for underscore-prefixed getter/setter methods
  - Improved field detection with better regex patterns

### Fixed
- Fixed incorrect static modifier being added to non-static field getters/setters
- Fixed field type detection for generic types

## [1.0.4] - 2025-07-18

### Added
- New Getter/Setter Generator feature:
  - Support for static and non-static fields
  - Batch generation capability
  - Smart field type detection including generics
  - Option to generate getters only, setters only, or both
  - Context-aware static modifier handling
- Extended version support:
  - Complete version coverage from 1.8.x to 1.21.x

### Changed
- Improved field detection algorithm to handle more complex cases
- Enhanced UI for field selection in getter/setter generation

## [1.0.2] - 2025-04-11

### Added
- New Plugin Explorer view with advanced features:
  - Live-updating Java files explorer
  - Automatic file type detection (Main Class, Listeners, Commands)
  - Real-time search functionality
  - Visual indicators for different file types
- Improved Plugin Tools section:
  - Interactive command creation with package selection
  - Enhanced event listener generation with event type selection
  - Configuration file templates
- Auto-refresh functionality for file changes
- Improved file watching and caching system

### Changed
- Reorganized extension structure for better maintainability
- Enhanced user interface for plugin development tools
- Improved performance with file caching system

### Fixed
- Fixed plugin explorer not updating when a package directory is deleted
- Improved file watching system to handle package deletions correctly
- Improved file caching system to maintain sync with filesystem changes

## [1.0.1] - 2025-04-09

### Added
- Extended Minecraft version support in the creation form:
  - Added versions from 1.8.8 to 1.20.4
  - Full compatibility range now includes 1.8.8 through 1.20.4

### Changed
- Updated Utils class generation to be version-aware:
  - Uses modern ChatColor.of() method for versions 1.16+
  - Falls back to legacy color codes for versions below 1.16
  - Improved color handling compatibility across all versions

### Fixed
- Improved form validation in the plugin creation wizard
- Fixed package name validation in Java files
- Corrected POM.xml template formatting

## [1.0.0] - 2025-04-01

### Added
- Initial release of Minecraft Plugin Development extension
- Beautiful UI for plugin creation with material design
- Support for Minecraft versions 1.8.8 to 1.20.4
- Support for Java versions 8, 11, 16, 17, and 21
- Automatic project structure generation
- Maven project configuration
- Built-in support for hex colors in newer versions
- Pre-configured package structure with essential classes:
  - Main plugin class
  - Plugin manager with singleton pattern
  - Basic event listener
  - Utils class with color support