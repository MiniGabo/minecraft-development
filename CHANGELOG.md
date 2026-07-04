# Change Log

All notable changes to the "Minecraft Development" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.1] - 2026-07-01

### Added
- **Java 25 Support**: Minecraft 26.1+ now automatically uses Java 25.
- **Forge Kotlin Support**: Full Kotlin support for Forge projects.
  - Automatic Kotlin plugin, stdlib dependency, and buildscript configuration.
  - Compatible Kotlin versions per era: 1.3.72 (Legacy/Gradle 4.x), 1.9.22 (FG4/FG5), 2.0.21 (Modern).
- **Velocity Plugin Support**: Full project scaffolding for Velocity proxy plugins.
  - Automatic project generation with `@Plugin` annotation and Guice dependency injection.
  - Maven and Gradle (Groovy/Kotlin DSL) build system support.
  - Kotlin and Lombok support with proper annotation processor configuration.
  - Plugin dependency declarations via `@Dependency` annotations (e.g., Vault, PlaceholderAPI).
  - Pre-built templates: Main class, PluginManager singleton, PlayerListener.
  - Auto-detection of Velocity projects in status bar and project explorer.
- **Java Auto-Recommendation**: Fabric and Spigot/Paper projects now auto-recommend Java version based on Minecraft version (previously only Forge did this).

### Fixed
- **Forge Kotlin Plugin Missing**: The Kotlin Gradle plugin was not being added to `build.gradle` for Forge projects, causing Kotlin code to not compile.
- **Forge Kotlin stdlib Missing**: The `kotlin-stdlib` dependency was not included in Forge projects, causing "Unresolved reference" errors for standard Kotlin functions.
- **Forge Content Generators Using Wrong Mappings**: Items, Blocks, and Entities generated for Forge FG4/FG5 projects incorrectly used Mojang mappings instead of MCP mappings, causing compilation errors.
- **Forge Legacy Kotlin Compatibility**: Fixed Kotlin version for Legacy Forge (1.8-1.12.2) to use 1.3.72, compatible with Gradle 4.x (previous versions required Gradle 6.8+).
- **Paper Version Fetching Broken**: PaperMC deprecated the v2 API (`api.papermc.io/v2`) and migrated to v3 (`fill.papermc.io/v3`). Updated all Paper API calls to use the new endpoint with required User-Agent header.

## [1.3.0] - 2026-06-11

### Added
- **Full Gradle Support**: Centralized Gradle wrapper templates (`gradlew`, `.jar`, `.properties`) for all platforms.
- **Paper Integration**: Full support for PaperMC API fetching, including historical versions down to 1.7.10.
- **Advanced Project Settings**: Added platform-specific configurations for Forge and Fabric during project creation.
- **Template-Based Architecture**: Migrated from hardcoded code strings to an external file-based template system for better maintainability.
- **Full Forge Tooling**: Added specialized tools for Forge items, blocks, recipes, and entities, including full asset generation (models, textures, lang).
- **Universal Lombok Support**: Integrated Lombok support for both Forge and Fabric Java projects.
- **Fabric Split Environment**: New advanced option to separate Client and Server/Common code and resources.

### Improved
- **Dynamic Gradle Versioning**: Automatic selection of optimal Gradle versions based on Minecraft version and platform (Forge, Fabric, Spigot/Paper).
- **Intelligent Version Fetching**:
  - Implemented a more robust version sorting algorithm that handles pre-releases (e.g., `1.13-pre7`) and sub-versions correctly.
  - Optimized Spigot metadata fetching with internal caching to reduce network overhead.
- **Paper Dependency Resolution**: Updated Maven/Gradle logic to use correct GroupIDs (`io.papermc.paper` or `com.destroystokyo.paper`) based on the selected Minecraft version.
- **Kotlin Compatibility**: Enhanced Getter/Setter generator and other tools to properly recognize Kotlin files in all environments.
- **Environment-Aware Commands**: Fabric tools now intelligently place assets in `src/client` while keeping logic/data in `src/main`.
- **Webview UI Overhaul**: Fabric configuration fields are now fully editable text inputs.

## [1.2.0] - 2026-06-07

### Added
- **Complete Rebranding**: The extension is now **Minecraft Development**, supporting the entire ecosystem (Plugins, Fabric, Forge).
- **Forge Support**: Added project scaffolding for both Modern Forge and Legacy (1.8 - 1.12.2).
- **Fabric Enhancements**: New specialized tools for Fabric development:
  - **Add Fabric Item**: Auto-generates class, JSON model, and localizations.
  - **Add Fabric Block**: Auto-generates class, blockstate, models, and BlockItem registration.
  - **Add Fabric Recipe**: Scaffolds shaped recipe JSON files.
  - **Add Fabric Entity**: Fully automated entity creation with automatic registration in the ModInitializer.
- **Smart Registration**: Fabric items, blocks, and entities are now automatically registered in the main mod class upon creation.
- **Real-time Version Fetching**:
  - Live data from Fabric Meta API (filtering stable releases).
  - Live data from Forge Maven (supporting legacy and modern eras).
  - Live data from Spigot Nexus.
- **Dynamic Project Wizard**: Reactive UI that adapts fields and build systems based on the selected platform.

### Improved
- **Contextual UI**: Side bar tools now adapt to show only relevant commands for the current project type.
- **Status Bar 2.0**: New intelligent status bar that detects and displays the current environment (Mod/Plugin) and project type.
- **File Detection**: Enhanced Project Structure view with specific icons for Mixins, ModInitializers, and more.

## [1.1.0] - 2026-05-01

### Added
- **Kotlin Support:** Full support for creating plugins in Kotlin, including specific templates and automatic detection.
- **Gradle Support:** Support for Maven, Gradle (Groovy), and Gradle (Kotlin DSL).
- **Dynamic Versions:** Real-time Minecraft version fetching directly from Spigot's Nexus repository.

### Improved
- **Language Awareness:** Commands and listeners now adapt to the project's language (Java or Kotlin).
- **Reliability:** Replaced synchronous operations with asynchronous native VS Code APIs.
- **UI Consistency:** Standardized Minecraft version sorting (descending).

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