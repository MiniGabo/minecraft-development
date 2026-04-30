const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

class PluginStructureProvider {
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
            // Observar tanto archivos Java como directorios
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(this.workspaceRoot, '**/*'),
                false, // No ignorar creación
                false, // No ignorar cambios
                false  // No ignorar eliminaciones
            );

            watcher.onDidDelete(uri => {
                const deletedPath = uri.fsPath;
                // Si es un directorio, eliminar todos los archivos en el caché que comiencen con esta ruta
                if (fs.existsSync(deletedPath)) {
                    // Es un archivo que fue renombrado/movido
                    this._fileCache.delete(deletedPath);
                } else {
                    // Podría ser un directorio o archivo eliminado
                    for (const [cachedPath] of this._fileCache) {
                        if (cachedPath.startsWith(deletedPath)) {
                            this._fileCache.delete(cachedPath);
                        }
                    }
                }
                this.refresh();
            });

            // Al crear o modificar un archivo, actualizamos el cache
            watcher.onDidCreate(uri => {
                const createdPath = uri.fsPath;
                if (createdPath.endsWith('.java')) {
                    this._updateFileCache(createdPath);
                }
                this.refresh();
            });

            watcher.onDidChange(uri => {
                const changedPath = uri.fsPath;
                if (changedPath.endsWith('.java')) {
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
        // Actualizar cada 30 segundos y limpiar el cache
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
        searchBox.placeholder = 'Search Java files...';
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
            return this._scanForJavaFiles(this.workspaceRoot);
        }

        return Promise.resolve([]); // No sub-elementos, vista plana
    }

    async _scanForJavaFiles(directory) {
        if (!fs.existsSync(directory)) {
            // Limpiar el caché si el directorio no existe
            for (const [cachedPath] of this._fileCache) {
                if (cachedPath.startsWith(directory)) {
                    this._fileCache.delete(cachedPath);
                }
            }
            return [];
        }

        const items = [];
        const javaFiles = await this._findAllJavaFiles(directory);

        for (const file of javaFiles) {
            // Verificar si el archivo realmente existe
            if (!fs.existsSync(file)) {
                this._fileCache.delete(file);
                continue;
            }

            const relativePath = path.relative(this.workspaceRoot, file);
            const fileName = path.basename(file);

            // Filtrar por búsqueda si hay texto
            if (this.searchText) {
                if (!fileName.toLowerCase().includes(this.searchText) && 
                    !relativePath.toLowerCase().includes(this.searchText)) {
                    continue;
                }
            }

            // Obtener o actualizar la información del archivo del cache
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

            items.push(new JavaFileItem(
                fileName,
                vscode.Uri.file(file),
                relativePath,
                fileInfo
            ));
        }

        // Ordenar por tipo de archivo (Main class primero, luego el resto alfabéticamente)
        return items.sort((a, b) => {
            if (a.isMainClass && !b.isMainClass) return -1;
            if (!a.isMainClass && b.isMainClass) return 1;
            return a.label.toString().localeCompare(b.label.toString());
        });
    }

    async _findAllJavaFiles(dir) {
        const files = [];
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...await this._findAllJavaFiles(fullPath));
            } else if (entry.name.endsWith('.java')) {
                // Solo incluir el archivo si existe
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
            const isMainClass = content.includes('extends JavaPlugin');
            const fileType = this._getJavaFileType(content);
            return { isMainClass, fileType };
        } catch (error) {
            return { isMainClass: false, fileType: 'Unknown' };
        }
    }

    _getJavaFileType(content) {
        if (content.includes('extends JavaPlugin')) return 'Main Class';
        if (content.includes('implements Listener')) return 'Listener';
        if (content.includes('implements CommandExecutor')) return 'Command';
        if (content.includes('class') && content.includes('Manager')) return 'Manager';
        if (content.includes('class') && content.includes('Utils')) return 'Utility';
        return 'Class';
    }
}

class JavaFileItem extends vscode.TreeItem {
    constructor(label, resourceUri, relativePath, fileInfo) {
        super(label);
        
        this.resourceUri = resourceUri;
        this.tooltip = relativePath;
        this.isMainClass = fileInfo.isMainClass;
        
        // Comando para abrir el archivo
        this.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [resourceUri]
        };

        // Descripción que muestra el tipo de archivo
        this.description = fileInfo.fileType;

        // Iconos específicos según el tipo de archivo
        this.iconPath = this._getFileIcon(fileInfo.fileType);
    }

    _getFileIcon(fileType) {
        switch(fileType) {
            case 'Main Class':
                return new vscode.ThemeIcon('vm', new vscode.ThemeColor('charts.blue'));
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

class PluginToolsProvider {
    getTreeItem(element) {
        return element;
    }

    getChildren() {
        const items = [
            new ToolTreeItem('Add Command', 'minecraft-plugin-development.addCommand', 'symbol-method'),
            new ToolTreeItem('Add Event Listener', 'minecraft-plugin-development.addListener', 'symbol-event'),
            new ToolTreeItem('Add Config File', 'minecraft-plugin-development.addConfig', 'settings-gear'),
            new ToolTreeItem('Generate Getters/Setters', 'minecraft-plugin-development.generateGettersSetters', 'symbol-property'),
            new ToolTreeItem('Create Plugin', 'minecraft-plugin-development.createNewPlugin', 'file-add'),
        ];
        return items;
    }
}

class ToolTreeItem extends vscode.TreeItem {
    constructor(label, command, icon) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.command = {
            command: command,
            title: label
        };
        this.iconPath = new vscode.ThemeIcon(icon);
    }
}

module.exports = {
    PluginStructureProvider,
    PluginToolsProvider
};