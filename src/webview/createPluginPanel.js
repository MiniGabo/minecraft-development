const vscode = require('vscode');
const path = require('path');
const { fetchMinecraftVersions, fetchFabricGameVersions, fetchForgeVersions } = require('../utils/minecraftUtils');
const ProjectGenerator = require('../utils/projectGenerator');

class CreatePluginPanel {
    static currentPanel = undefined;

    static createOrShow(context) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (CreatePluginPanel.currentPanel) {
            CreatePluginPanel.currentPanel.panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'createMinecraftProject',
            'New Minecraft Project',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath, 'resources')),
                    vscode.Uri.file(path.join(context.extensionPath, 'images'))
                ],
                retainContextWhenHidden: true
            }
        );

        panel.iconPath = {
            light: vscode.Uri.file(path.join(context.extensionPath, 'images', 'icon.png')),
            dark: vscode.Uri.file(path.join(context.extensionPath, 'images', 'icon.png'))
        };

        CreatePluginPanel.currentPanel = new CreatePluginPanel(panel, context);
    }

    constructor(panel, context) {
        this.panel = panel;
        this.context = context;
        this._disposables = [];

        this._initHtml();

        this.panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this.panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'ready':
                        await this._sendVersions();
                        return;
                    case 'createPlugin':
                        await this._createPlugin(message.data);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    dispose() {
        CreatePluginPanel.currentPanel = undefined;
        this.panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    async _initHtml() {
        // Initial HTML load
        this.panel.webview.html = await this._getHtmlContent([]);
    }

    async _sendVersions() {
        const [spigotVersions, fabricVersions, forgeVersions] = await Promise.all([
            fetchMinecraftVersions(),
            fetchFabricGameVersions(),
            fetchForgeVersions()
        ]);

        // Send all version sets to webview
        this.panel.webview.postMessage({
            command: 'setVersions',
            spigot: spigotVersions,
            fabric: fabricVersions,
            forge: forgeVersions
        });
    }

    async _createPlugin(data) {
        try {
            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                title: 'Select Location for Minecraft Plugin Project'
            });

            if (!uri || uri.length === 0) return;

            const projectDirUri = uri[0];
            const pluginDirUri = vscode.Uri.joinPath(projectDirUri, data.projectName);
            const sourcePath = data.language === 'kotlin' ? 'kotlin' : 'java';
            const basePackagePath = vscode.Uri.joinPath(pluginDirUri, 'src', 'main', sourcePath, ...data.packageName.split('.'));

            // Create structure using VS Code FileSystem API
            await vscode.workspace.fs.createDirectory(pluginDirUri);
            await vscode.workspace.fs.createDirectory(basePackagePath);
            await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(pluginDirUri, 'src', 'main', 'resources'));

            // Create sub-packages based on project type
            let packages = [];
            if (data.projectType === 'plugin') {
                packages = ['managers', 'listeners', 'utils'];
            } else if (data.projectType === 'fabric') {
                packages = ['mixin', 'registry', 'items'];
            } else if (data.projectType === 'forge') {
                packages = ['init', 'item', 'block'];
            }

            for (const pkg of packages) {
                await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(basePackagePath, pkg));
            }

            // Generate project using the generator factory
            const generator = ProjectGenerator.createGenerator(data);
            await generator.generate(pluginDirUri, basePackagePath);

            vscode.commands.executeCommand('vscode.openFolder', pluginDirUri);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create project: ${error.message}`);
        }
    }

    async _getHtmlContent(versions) {
        const htmlUri = vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'resources', 'createProject.html'));
        const htmlBuffer = await vscode.workspace.fs.readFile(htmlUri);
        let htmlContent = Buffer.from(htmlBuffer).toString('utf8');
        
        const versionOptions = versions.map(v => `<option value="${v}">${v}</option>`).join('');
        
        htmlContent = htmlContent.replace(
            /<select id="minecraftVersion">[\s\S]*?<\/select>/,
            `<select id="minecraftVersion">${versionOptions}</select>`
        );
        
        return htmlContent;
    }
}

module.exports = CreatePluginPanel;
