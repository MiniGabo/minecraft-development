const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const CreatePluginPanel = require('./webview/createPluginPanel');
const { ProjectStructureProvider, ProjectToolsProvider } = require('./views/pluginExplorer');
const { addCommand, addListener, addConfig } = require('./commands/fileCommands');
const { addFabricItem, addFabricBlock, addFabricRecipe, addFabricEntity } = require('./commands/fabricCommands');
const { addForgeItem, addForgeBlock, addForgeRecipe, addForgeEntity } = require('./commands/forgeCommands');
const { generateGettersSetters } = require('./commands/getterSetterCommands');
const { fetchMinecraftVersions } = require('./utils/minecraftUtils');

function activate(context) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;

    // Register Project Structure View
    const projectStructureProvider = new ProjectStructureProvider(workspaceRoot);
    
    // Create status bar item
    const mcContextStatusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    updateStatusBarContext(mcContextStatusBar, workspaceRoot);
    mcContextStatusBar.show();

    const projectToolsProvider = new ProjectToolsProvider(workspaceRoot);

    // Update status bar and tools when folders change
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
        const newRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        updateStatusBarContext(mcContextStatusBar, newRoot);
        projectStructureProvider.workspaceRoot = newRoot;
        projectToolsProvider.workspaceRoot = newRoot;
        projectStructureProvider.refresh();
        projectToolsProvider.refresh();
    });
    
    // Register views
    const treeView = vscode.window.createTreeView('minecraftPluginStructure', {
        treeDataProvider: projectStructureProvider,
        showCollapseAll: true
    });

    vscode.window.registerTreeDataProvider(
        'minecraftPluginTools',
        projectToolsProvider
    );

    // Register Commands
    let disposables = [
        vscode.commands.registerCommand('minecraft-plugin-development.createNewPlugin', () => {
            CreatePluginPanel.createOrShow(context);
        }),

        vscode.commands.registerCommand('minecraft-plugin-development.refreshPluginStructure', () => {
            projectStructureProvider.refresh();
        }),

        vscode.commands.registerCommand('minecraft-plugin-development.selectMinecraftVersion', async () => {
            const versions = await fetchMinecraftVersions();
            const version = await vscode.window.showQuickPick(versions, {
                placeHolder: 'Select Global Minecraft Version'
            });

            if (version) {
                await context.globalState.update('minecraftVersion', version);
                updateStatusBarContext(mcContextStatusBar, workspaceRoot);
            }
        }),

        vscode.commands.registerCommand('minecraft-plugin-development.searchJavaFiles', () => {
            projectStructureProvider.showSearch();
        }),

        vscode.commands.registerCommand('minecraft-plugin-development.addCommand', () => addCommand(context)),
        vscode.commands.registerCommand('minecraft-plugin-development.addListener', () => addListener(context)),
        vscode.commands.registerCommand('minecraft-plugin-development.addConfig', () => addConfig(context)),
        vscode.commands.registerCommand('minecraft-plugin-development.addFabricItem', () => addFabricItem(context)),
        vscode.commands.registerCommand('minecraft-plugin-development.addFabricBlock', () => addFabricBlock(context)),
        vscode.commands.registerCommand('minecraft-plugin-development.addFabricRecipe', () => addFabricRecipe(context)),
        vscode.commands.registerCommand('minecraft-plugin-development.addFabricEntity', () => addFabricEntity(context)),
        vscode.commands.registerCommand('minecraft-plugin-development.addForgeItem', () => addForgeItem(context)),
        vscode.commands.registerCommand('minecraft-plugin-development.addForgeBlock', () => addForgeBlock(context)),
        vscode.commands.registerCommand('minecraft-plugin-development.addForgeRecipe', () => addForgeRecipe(context)),
        vscode.commands.registerCommand('minecraft-plugin-development.addForgeEntity', () => addForgeEntity(context)),
        vscode.commands.registerCommand('minecraft-plugin-development.generateGettersSetters', generateGettersSetters)
    ];

    context.subscriptions.push(...disposables, mcContextStatusBar, treeView);
}

function updateStatusBarContext(statusBar, workspaceRoot) {
    if (!workspaceRoot) {
        statusBar.text = `$(gear) MC: No Project`;
        statusBar.tooltip = 'Open a Minecraft project to see details';
        return;
    }

    let type = 'Unknown';
    let icon = '$(package)';

    if (fs.existsSync(path.join(workspaceRoot, 'src', 'main', 'resources', 'fabric.mod.json'))) {
        type = 'Fabric Mod';
        icon = '$(beaker)';
    } else if (fs.existsSync(path.join(workspaceRoot, 'src', 'main', 'resources', 'META-INF', 'mods.toml')) ||
               fs.existsSync(path.join(workspaceRoot, 'src', 'main', 'resources', 'mcmod.info'))) {
        type = 'Forge Mod';
        icon = '$(tools)';
    } else if (fs.existsSync(path.join(workspaceRoot, 'src', 'main', 'resources', 'plugin.yml')) || 
               fs.existsSync(path.join(workspaceRoot, 'pom.xml'))) {
        type = 'Plugin (Spigot/Paper)';
        icon = '$(plug)';
    }

    statusBar.text = `${icon} MC: ${type}`;
    statusBar.tooltip = `Current Environment: ${type}\nLocation: ${workspaceRoot}`;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
