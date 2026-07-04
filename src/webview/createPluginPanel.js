const vscode = require('vscode');
const path = require('path');
const { 
    fetchMinecraftVersions, 
    fetchPaperVersions, 
    fetchFabricGameVersions, 
    fetchForgeVersions,
    fetchVelocityVersions
} = require('../utils/minecraftUtils');
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
                    case 'getRecommendedVersions':
                        const { getRecommendedJavaVersion } = require('../utils/minecraftUtils');
                        const recommendedJava = getRecommendedJavaVersion(message.minecraftVersion);

                        if (message.platform === 'fabric') {
                            const { getFabricVersionData } = require('../utils/fabricUtils');
                            const versionData = getFabricVersionData(message.minecraftVersion);
                            this.panel.webview.postMessage({
                                command: 'setFabricDefaults',
                                loom: versionData.loom_version,
                                loader: versionData.loader_version,
                                yarn: versionData.yarn_mappings,
                                fabric: versionData.fabric_version,
                                javaVersion: recommendedJava
                            });
                        } else if (message.platform === 'forge') {
                            const { getForgeVersionData } = require('../utils/forgeUtils');
                            const versionData = getForgeVersionData(message.minecraftVersion);
                            this.panel.webview.postMessage({
                                command: 'setForgeDefaults',
                                forge: versionData.forge,
                                mappingsChannel: versionData.mappingsChannel,
                                mappingsVersion: versionData.mappingsVersion,
                                javaVersion: recommendedJava
                            });
                        } else if (message.platform === 'plugin') {
                            this.panel.webview.postMessage({
                                command: 'setPluginDefaults',
                                javaVersion: recommendedJava
                            });
                        } else if (message.platform === 'velocity') {
                            this.panel.webview.postMessage({
                                command: 'setVelocityDefaults',
                                javaVersion: recommendedJava
                            });
                        }
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
        const [spigotVersions, paperVersions, fabricVersions, forgeVersions, velocityVersions, fabricApi] = await Promise.all([
            fetchMinecraftVersions(),
            fetchPaperVersions(),
            fetchFabricGameVersions(),
            fetchForgeVersions(),
            fetchVelocityVersions(),
            require('../utils/fabricUtils').fetchFabricApiVersions()
        ]);

        // Send all version sets to webview
        this.panel.webview.postMessage({
            command: 'setVersions',
            spigot: spigotVersions,
            paper: paperVersions,
            fabric: fabricVersions,
            forge: forgeVersions,
            velocity: velocityVersions,
            fabricApi: fabricApi
        });
    }

    async _createPlugin(data) {
        try {
            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                title: 'Select Location for Minecraft Project'
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

            // Generate project using the generator factory
            const generator = ProjectGenerator.createGenerator(data, this.context);
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
