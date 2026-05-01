const vscode = require('vscode');
const axios = require('axios');
const CreatePluginPanel = require('./webview/createPluginPanel');
const { PluginStructureProvider, PluginToolsProvider } = require('./views/pluginExplorer');
const { addCommand, addListener, addConfig } = require('./commands/fileCommands');
const { generateGettersSetters } = require('./commands/getterSetterCommands');

const { fetchMinecraftVersions } = require('./utils/minecraftUtils');

function activate(context) {
    // Register Plugin Structure View
    const pluginStructureProvider = new PluginStructureProvider(
        vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath
    );
    
    // Create status bar item
    const mcVersionStatusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    mcVersionStatusBar.command = 'minecraft-plugin-development.selectMinecraftVersion';
    updateStatusBarVersion(mcVersionStatusBar, context);
    mcVersionStatusBar.show();
    
    // Register views
    const treeView = vscode.window.createTreeView('minecraftPluginStructure', {
        treeDataProvider: pluginStructureProvider,
        showCollapseAll: true
    });

    vscode.window.registerTreeDataProvider(
        'minecraftPluginTools',
        new PluginToolsProvider()
    );

    // Register Commands
    let disposables = [
        vscode.commands.registerCommand('minecraft-plugin-development.createNewPlugin', () => {
            CreatePluginPanel.createOrShow(context);
        }),

        vscode.commands.registerCommand('minecraft-plugin-development.refreshPluginStructure', () => {
            pluginStructureProvider.refresh();
        }),

        vscode.commands.registerCommand('minecraft-plugin-development.selectMinecraftVersion', async () => {
            const versions = await fetchMinecraftVersions();
            const version = await vscode.window.showQuickPick(versions, {
                placeHolder: 'Select Minecraft Version'
            });

            if (version) {
                await context.globalState.update('minecraftVersion', version);
                updateStatusBarVersion(mcVersionStatusBar, context);
            }
        }),

        vscode.commands.registerCommand('minecraft-plugin-development.searchJavaFiles', () => {
            pluginStructureProvider.showSearch();
        }),

        vscode.commands.registerCommand('minecraft-plugin-development.addCommand', () => addCommand(context)),
        vscode.commands.registerCommand('minecraft-plugin-development.addListener', () => addListener(context)),
        vscode.commands.registerCommand('minecraft-plugin-development.addConfig', () => addConfig(context)),
        vscode.commands.registerCommand('minecraft-plugin-development.generateGettersSetters', generateGettersSetters)
    ];

    context.subscriptions.push(...disposables, mcVersionStatusBar, treeView);
}

function updateStatusBarVersion(statusBar, context) {
    const version = context.globalState.get('minecraftVersion', '1.20.4');
    statusBar.text = `$(versions) MC: ${version}`;
    statusBar.tooltip = 'Click to change Minecraft version';
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
