const vscode = require('vscode');

/**
 * @typedef {Object} ProjectData
 * @property {string} projectName
 * @property {string} packageName
 * @property {string} pluginVersion
 * @property {string} authorName
 * @property {string} website
 * @property {string} minecraftVersion
 * @property {string} javaVersion
 * @property {string} buildSystem
 * @property {string} language
 */

class BaseGenerator {
    /**
     * @param {ProjectData} data 
     */
    constructor(data) {
        this.data = data;
    }

    /**
     * Writes content to a file using VS Code FileSystem API
     * @param {vscode.Uri} uri 
     * @param {string} content 
     */
    async writeFile(uri, content) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
    }

    /**
     * Main generation method to be implemented by subclasses
     * @param {vscode.Uri} projectDirUri 
     * @param {vscode.Uri} basePackagePathUri 
     */
    async generate(projectDirUri, basePackagePathUri) {
        throw new Error('Method generate() must be implemented');
    }
}

module.exports = BaseGenerator;
