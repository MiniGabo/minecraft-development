const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

function _isVelocityProject(workspaceRoot) {
    const buildGradle = path.join(workspaceRoot, 'build.gradle');
    const buildGradleKts = path.join(workspaceRoot, 'build.gradle.kts');
    const pomXml = path.join(workspaceRoot, 'pom.xml');

    for (const file of [buildGradle, buildGradleKts, pomXml]) {
        if (fs.existsSync(file)) {
            const content = fs.readFileSync(file, 'utf8');
            if (content.includes('velocity-api')) return true;
        }
    }
    return false;
}

class ProjectStructureProvider {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.searchText = '';
        this._searchBox = this._createSearchBox();
        this._setupFileWatcher();
        this._setupAutoRefresh();
        this._fileCache = new Map();
    }

    _setupFileWatcher() {
        if (this.workspaceRoot) {
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(this.workspaceRoot, '**/*'),
                false,
                false,
                false
            );

            watcher.onDidDelete(uri => {
                const deletedPath = uri.fsPath;
                if (fs.existsSync(deletedPath)) {
                    this._fileCache.delete(deletedPath);
                } else {
                    for (const [cachedPath] of this._fileCache) {
                        if (cachedPath.startsWith(deletedPath)) {
                            this._fileCache.delete(cachedPath);
                        }
                    }
                }
                this.refresh();
            });

            watcher.onDidCreate(uri => {
                const createdPath = uri.fsPath;
                if (createdPath.endsWith('.java') || createdPath.endsWith('.kt')) {
                    this._updateFileCache(createdPath);
                }
                this.refresh();
            });

            watcher.onDidChange(uri => {
                const changedPath = uri.fsPath;
                if (changedPath.endsWith('.java') || changedPath.endsWith('.kt')) {
                    this._updateFileCache(changedPath);
                }
                this.refresh();
            });
        }
    }

    async _updateFileCache(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                const fileInfo = await this._getFileInfo(filePath);
                this._fileCache.set(filePath, {
                    exists: true,
                    info: fileInfo
                });
            } else {
                this._fileCache.delete(filePath);
            }
        } catch (error) {
            console.error(`Error updating file cache for ${filePath}:`, error);
            this._fileCache.delete(filePath);
        }
    }

    _setupAutoRefresh() {
        setInterval(async () => {
            await this._cleanCache();
            this.refresh();
        }, 30000);
    }

    async _cleanCache() {
        for (const [filePath] of this._fileCache) {
            try {
                if (!fs.existsSync(filePath)) {
                    this._fileCache.delete(filePath);
                }
            } catch (error) {
                console.error(`Error cleaning cache for ${filePath}:`, error);
                this._fileCache.delete(filePath);
            }
        }
    }

    updateSearch(text) {
        this.searchText = text;
        this._onDidChangeTreeData.fire();
    }

    _createSearchBox() {
        const searchBox = vscode.window.createInputBox();
        searchBox.placeholder = 'Search project files...';
        searchBox.onDidChangeValue(text => {
            this.searchText = text.toLowerCase();
            this.refresh();
        });
        return searchBox;
    }

    showSearch() {
        this._searchBox.show();
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    getChildren(element) {
        if (!this.workspaceRoot) {
            return Promise.resolve([]);
        }

        if (!element) {
            return this._scanForSourceFiles(this.workspaceRoot);
        }

        return Promise.resolve([]);
    }

    async _scanForSourceFiles(directory) {
        if (!fs.existsSync(directory)) {
            for (const [cachedPath] of this._fileCache) {
                if (cachedPath.startsWith(directory)) {
                    this._fileCache.delete(cachedPath);
                }
            }
            return [];
        }

        const items = [];
        const sourceFiles = await this._findAllSourceFiles(directory);

        for (const file of sourceFiles) {
            if (!fs.existsSync(file)) {
                this._fileCache.delete(file);
                continue;
            }

            const relativePath = path.relative(this.workspaceRoot, file);
            const fileName = path.basename(file);

            if (this.searchText) {
                if (!fileName.toLowerCase().includes(this.searchText) && 
                    !relativePath.toLowerCase().includes(this.searchText)) {
                    continue;
                }
            }

            let fileInfo;
            if (this._fileCache.has(file)) {
                fileInfo = this._fileCache.get(file).info;
            } else {
                fileInfo = await this._getFileInfo(file);
                this._fileCache.set(file, {
                    exists: true,
                    info: fileInfo
                });
            }

            items.push(new SourceFileItem(
                fileName,
                vscode.Uri.file(file),
                relativePath,
                fileInfo
            ));
        }

        return items.sort((a, b) => {
            if (a.isMainClass && !b.isMainClass) return -1;
            if (!a.isMainClass && b.isMainClass) return 1;
            return a.label.toString().localeCompare(b.label.toString());
        });
    }

    async _findAllSourceFiles(dir) {
        const files = [];
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target' || entry.name === 'build') continue;
                files.push(...await this._findAllSourceFiles(fullPath));
            } else if (entry.name.endsWith('.java') || entry.name.endsWith('.kt')) {
                if (fs.existsSync(fullPath)) {
                    files.push(fullPath);
                }
            }
        }

        return files;
    }

    async _getFileInfo(filePath) {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const isMainClass = content.includes('extends JavaPlugin') || content.includes('implements ModInitializer');
            const fileType = this._getFileType(content);
            return { isMainClass, fileType };
        } catch (error) {
            return { isMainClass: false, fileType: 'Unknown' };
        }
    }

    _getFileType(content) {
        if (content.includes('extends JavaPlugin')) return 'Main Class (Spigot)';
        if (content.includes('implements ModInitializer')) return 'Main Class (Fabric)';
        if (content.includes('implements Listener') || content.includes('@EventHandler')) return 'Listener';
        if (content.includes('implements CommandExecutor') || content.includes('@Command')) return 'Command';
        if (content.includes('class') && content.includes('Manager')) return 'Manager';
        if (content.includes('class') && content.includes('Utils')) return 'Utility';
        return 'Source File';
    }
}

class SourceFileItem extends vscode.TreeItem {
    constructor(label, resourceUri, relativePath, fileInfo) {
        super(label);
        
        this.resourceUri = resourceUri;
        this.tooltip = `Type: ${fileInfo.fileType}\nPath: ${relativePath}`;
        this.isMainClass = fileInfo.isMainClass;
        
        this.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [resourceUri]
        };

        this.description = fileInfo.fileType;
        this.iconPath = this._getFileIcon(fileInfo.fileType);
    }

    _getFileIcon(fileType) {
        if (fileType.includes('Main Class')) {
            return new vscode.ThemeIcon('vm', new vscode.ThemeColor('charts.blue'));
        }
        switch(fileType) {
            case 'Listener':
                return new vscode.ThemeIcon('symbol-event');
            case 'Command':
                return new vscode.ThemeIcon('symbol-method');
            case 'Manager':
                return new vscode.ThemeIcon('symbol-class');
            case 'Utility':
                return new vscode.ThemeIcon('tools');
            default:
                return new vscode.ThemeIcon('symbol-file');
        }
    }
}

class ProjectToolsProvider {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    getChildren() {
        const workspaceRoot = this.workspaceRoot;
        
        // Basic item always present
        const newProjectItem = new ToolTreeItem('New Project', 'minecraft-plugin-development.createNewPlugin', 'file-add', 'Create a new Minecraft project (Plugin or Mod)');

        if (!workspaceRoot) {
            return [newProjectItem];
        }

        const isFabric = fs.existsSync(path.join(workspaceRoot, 'src', 'main', 'resources', 'fabric.mod.json'));
        const isForge = fs.existsSync(path.join(workspaceRoot, 'src', 'main', 'resources', 'META-INF', 'mods.toml')) || 
                        fs.existsSync(path.join(workspaceRoot, 'src', 'main', 'resources', 'mcmod.info'));
        const isVelocity = _isVelocityProject(workspaceRoot);
        const isSpigot = fs.existsSync(path.join(workspaceRoot, 'src', 'main', 'resources', 'plugin.yml')) || 
                         fs.existsSync(path.join(workspaceRoot, 'pom.xml'));
        
        const items = [newProjectItem];

        if (isFabric) {
            items.push(
                new ToolTreeItem('Add Fabric Item', 'minecraft-plugin-development.addFabricItem', 'symbol-variable', 'Create a new Fabric item with models and lang'),
                new ToolTreeItem('Add Fabric Block', 'minecraft-plugin-development.addFabricBlock', 'layout-centered', 'Create a new Fabric block with states, models and lang'),
                new ToolTreeItem('Add Fabric Recipe', 'minecraft-plugin-development.addFabricRecipe', 'symbol-color', 'Create a new JSON recipe'),
                new ToolTreeItem('Add Fabric Entity', 'minecraft-plugin-development.addFabricEntity', 'github-action', 'Create and register a new Fabric entity')
            );
        } else if (isForge) {
            items.push(
                new ToolTreeItem('Add Forge Item', 'minecraft-plugin-development.addForgeItem', 'symbol-variable', 'Create a new Forge item with models and lang'),
                new ToolTreeItem('Add Forge Block', 'minecraft-plugin-development.addForgeBlock', 'layout-centered', 'Create a new Forge block with states, models and lang'),
                new ToolTreeItem('Add Forge Recipe', 'minecraft-plugin-development.addForgeRecipe', 'symbol-color', 'Create a new JSON recipe'),
                new ToolTreeItem('Add Forge Entity', 'minecraft-plugin-development.addForgeEntity', 'github-action', 'Create and register a new Forge entity')
            );
        } else if (isVelocity) {
            items.push(
                new ToolTreeItem('Add Command', 'minecraft-plugin-development.addCommand', 'symbol-method', 'Add a new Velocity command'),
                new ToolTreeItem('Add Event Listener', 'minecraft-plugin-development.addListener', 'symbol-event', 'Add a new event listener'),
                new ToolTreeItem('Add Config File', 'minecraft-plugin-development.addConfig', 'settings-gear', 'Add a configuration file')
            );
        } else if (isSpigot) {
            items.push(
                new ToolTreeItem('Add Command', 'minecraft-plugin-development.addCommand', 'symbol-method', 'Add a new command to your project'),
                new ToolTreeItem('Add Event Listener', 'minecraft-plugin-development.addListener', 'symbol-event', 'Add a new event listener'),
                new ToolTreeItem('Add Config File', 'minecraft-plugin-development.addConfig', 'settings-gear', 'Add a configuration file (yml)')
            );
        }

        items.push(new ToolTreeItem('Generate Getters/Setters', 'minecraft-plugin-development.generateGettersSetters', 'symbol-property', 'Generate boilerplate code for selected fields'));
        
        return items;
    }
}

class ToolTreeItem extends vscode.TreeItem {
    constructor(label, command, icon, tooltip) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.command = {
            command: command,
            title: label
        };
        this.iconPath = new vscode.ThemeIcon(icon);
        this.tooltip = tooltip;
    }
}

module.exports = {
    ProjectStructureProvider,
    ProjectToolsProvider
};