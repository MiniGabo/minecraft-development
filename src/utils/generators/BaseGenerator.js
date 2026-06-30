const vscode = require('vscode');
const path = require('path');
const { readTemplate, processTemplate } = require('../templateUtils');

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
     * @param {vscode.ExtensionContext} context
     */
    constructor(data, context) {
        this.data = data;
        this.context = context;
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
     * Copies a file from extension resources to project
     */
    async copyResource(resourcePath, targetUri) {
        const sourceUri = vscode.Uri.file(path.join(this.context.extensionPath, resourcePath));
        await vscode.workspace.fs.copy(sourceUri, targetUri, { overwrite: true });
    }

    /**
     * Copies Gradle wrapper files to the project directory
     * @param {vscode.Uri} projectDirUri 
     * @param {Object} variables
     */
    async copyGradleWrapper(projectDirUri, variables) {
        const commonGradlePath = 'src/resources/templates/common/gradle';
        
        // Create gradle/wrapper directory
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(projectDirUri, 'gradle', 'wrapper'));

        const files = [
            { src: `${commonGradlePath}/gradlew`, dest: 'gradlew' },
            { src: `${commonGradlePath}/gradlew.bat`, dest: 'gradlew.bat' },
            { src: `${commonGradlePath}/gradle/wrapper/gradle-wrapper.jar`, dest: 'gradle/wrapper/gradle-wrapper.jar' }
        ];

        for (const file of files) {
            await this.copyResource(file.src, vscode.Uri.joinPath(projectDirUri, file.dest));
        }

        // Handle gradle-wrapper.properties as a template
        const propsTemplate = await this.readTemplate('common/gradle/gradle/wrapper/gradle-wrapper.properties.template');
        await this.writeFile(
            vscode.Uri.joinPath(projectDirUri, 'gradle', 'wrapper', 'gradle-wrapper.properties'),
            this.processTemplate(propsTemplate, variables)
        );
    }

    /**
     * Reads a template file from extension resources
     */
    async readTemplate(templatePath) {
        return await readTemplate(this.context, templatePath);
    }

    /**
     * Processes a template string by replacing {{VAR}} placeholders
     */
    processTemplate(content, variables) {
        return processTemplate(content, variables);
    }

    /**
     * Main generation method to be implemented by subclasses
     */
    async generate(projectDirUri, basePackagePathUri) {
        throw new Error('Method generate() must be implemented');
    }
}

module.exports = BaseGenerator;
