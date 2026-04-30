const vscode = require('vscode');
const CreatePluginPanel = require('./webview/createPluginPanel');
const { PluginStructureProvider, PluginToolsProvider } = require('./views/pluginExplorer');
const { addCommand, addListener, addConfig } = require('./commands/fileCommands');
const { generateGettersSetters } = require('./commands/getterSetterCommands');

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
            const version = await vscode.window.showQuickPick([
                '1.21.10', '1.21.9', '1.21.8', '1.21.7', '1.21.6', '1.21.5', '1.21.4', '1.21.3', '1.21.2', '1.21.1', '1.21',
                '1.20.6', '1.20.5', '1.20.4', '1.20.3', '1.20.2', '1.20.1',
                '1.19.4', '1.19.3', '1.19.2', '1.19.1', '1.19',
                '1.18.2', '1.18.1', '1.18',
                '1.17.1', '1.17',
                '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1',
                '1.15.2', '1.15.1', '1.15',
                '1.14.4', '1.14.3', '1.14.2', '1.14.1', '1.14',
                '1.13.2', '1.13.1', '1.13',
                '1.12.2', '1.12.1', '1.12',
                '1.11.2', '1.11.1', '1.11',
                '1.10.2', '1.10.1', '1.10',
                '1.9.4', '1.9.3', '1.9.2', '1.9.1', '1.9',
                '1.8.9', '1.8.8',
            ], {
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
