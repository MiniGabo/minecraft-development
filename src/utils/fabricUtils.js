const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * Gets Fabric mod info from fabric.mod.json
 */
function getFabricModInfo(workspacePath) {
    const modJsonPath = path.join(workspacePath, 'src', 'main', 'resources', 'fabric.mod.json');
    if (!fs.existsSync(modJsonPath)) return null;

    try {
        const content = JSON.parse(fs.readFileSync(modJsonPath, 'utf8'));
        return {
            id: content.id,
            name: content.name,
            version: content.version,
            entrypoints: content.entrypoints
        };
    } catch (e) {
        return null;
    }
}

/**
 * Checks if the current project is a Fabric project
 */
function isFabricProject(workspacePath) {
    return fs.existsSync(path.join(workspacePath, 'src', 'main', 'resources', 'fabric.mod.json'));
}

module.exports = {
    getFabricModInfo,
    isFabricProject
};
