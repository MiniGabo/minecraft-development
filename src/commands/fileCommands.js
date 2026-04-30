const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { findBasePackage } = require('../utils/packageUtils');
const { getBasicConfigTemplate, getMessagesConfigTemplate, getCustomConfigTemplate } = require('../utils/templates');

async function addCommand(context) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const basePackage = await findBasePackage(workspaceFolders[0].uri.fsPath);
    if (!basePackage) {
        vscode.window.showErrorMessage('Could not find plugin package');
        return;
    }

    const commandName = await vscode.window.showInputBox({
        prompt: 'Enter command name (without "Command" suffix)',
        placeHolder: 'Example: Teleport',
        validateInput: text => {
            if (!text) return 'Command name is required';
            if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(text)) {
                return 'Command name must be alphanumeric and start with a letter';
            }
            return null;
        }
    });

    if (!commandName) return;

    const packageName = await vscode.window.showInputBox({
        prompt: 'Enter package name (relative to base package)',
        placeHolder: 'commands',
        value: 'commands',
        validateInput: text => {
            if (!text) return 'Package name is required';
            if (!/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$/.test(text)) {
                return 'Invalid package name format';
            }
            return null;
        }
    });

    if (!packageName) return;

    const commandDir = path.join(
        basePackage.path,
        ...packageName.split('.')
    );

    fs.mkdirSync(commandDir, { recursive: true });
    const commandFile = path.join(commandDir, `${commandName}Command.java`);

    const commandContent = `package ${basePackage.name}.${packageName};

import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

public class ${commandName}Command implements CommandExecutor {
    
    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player)) {
            sender.sendMessage("This command can only be used by players");
            return true;
        }

        Player player = (Player) sender;

        // Add your command logic here
        

        return true;
    }
}`;

    fs.writeFileSync(commandFile, commandContent);
    
    const doc = await vscode.workspace.openTextDocument(commandFile);
    const editor = await vscode.window.showTextDocument(doc);
    
    // Posicionar cursor donde va el código
    const position = new vscode.Position(15, 8);
    editor.selection = new vscode.Selection(position, position);
}

async function addListener(context) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const basePackage = await findBasePackage(workspaceFolders[0].uri.fsPath);
    if (!basePackage) {
        vscode.window.showErrorMessage('Could not find plugin package');
        return;
    }

    const events = [
        'PlayerJoin', 'PlayerQuit', 'PlayerMove',
        'BlockBreak', 'BlockPlace',
        'EntityDamage', 'EntityDeath',
        'InventoryClick', 'InventoryOpen',
        'Custom'
    ];

    const selectedEvent = await vscode.window.showQuickPick(events, {
        placeHolder: 'Select event type'
    });

    if (!selectedEvent) return;

    let eventName = selectedEvent;
    if (selectedEvent === 'Custom') {
        eventName = await vscode.window.showInputBox({
            prompt: 'Enter custom event name',
            placeHolder: 'PlayerCustomEvent',
            validateInput: text => {
                if (!text) return 'Event name is required';
                if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(text)) {
                    return 'Event name must be alphanumeric and start with a letter';
                }
                return null;
            }
        });
        if (!eventName) return;
    }

    const listenerName = await vscode.window.showInputBox({
        prompt: 'Enter listener name (without "Listener" suffix)',
        placeHolder: eventName,
        value: eventName,
        validateInput: text => {
            if (!text) return 'Listener name is required';
            if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(text)) {
                return 'Listener name must be alphanumeric and start with a letter';
            }
            return null;
        }
    });

    if (!listenerName) return;

    const packageName = await vscode.window.showInputBox({
        prompt: 'Enter package name (relative to base package)',
        placeHolder: 'listeners',
        value: 'listeners',
        validateInput: text => {
            if (!text) return 'Package name is required';
            if (!/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$/.test(text)) {
                return 'Invalid package name format';
            }
            return null;
        }
    });

    if (!packageName) return;

    const listenerDir = path.join(
        basePackage.path,
        ...packageName.split('.')
    );

    fs.mkdirSync(listenerDir, { recursive: true });
    const listenerFile = path.join(listenerDir, `${listenerName}Listener.java`);

    const listenerContent = `package ${basePackage.name}.${packageName};

import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.${eventName.split(/(?=[A-Z])/)[0].toLowerCase()}.${eventName}Event;

public class ${listenerName}Listener implements Listener {
    
    @EventHandler
    public void on${eventName}(${eventName}Event event) {
        // Add your event handling logic here
        
    }
}`;

    fs.writeFileSync(listenerFile, listenerContent);
    
    const doc = await vscode.workspace.openTextDocument(listenerFile);
    const editor = await vscode.window.showTextDocument(doc);
    
    // Posicionar cursor donde va el código
    const position = new vscode.Position(9, 8);
    editor.selection = new vscode.Selection(position, position);
}

async function addConfig(context) {
    const configType = await vscode.window.showQuickPick([
        'Basic Configuration',
        'Messages Configuration',
        'Custom Configuration'
    ], {
        placeHolder: 'Select configuration type'
    });

    if (!configType) return;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const resourcesPath = path.join(
        workspaceFolders[0].uri.fsPath,
        'src', 'main', 'resources'
    );

    let template = '';
    let fileName = '';

    switch (configType) {
        case 'Basic Configuration':
            fileName = 'config.yml';
            template = getBasicConfigTemplate();
            break;
        case 'Messages Configuration':
            fileName = 'messages.yml';
            template = getMessagesConfigTemplate();
            break;
        case 'Custom Configuration':
            const customFileName = await vscode.window.showInputBox({
                prompt: 'Enter configuration file name',
                placeHolder: 'custom.yml',
                validateInput: text => {
                    if (!text) return 'File name is required';
                    if (!/^[a-zA-Z][a-zA-Z0-9]*\.yml$/.test(text)) {
                        return 'File name must end with .yml and be alphanumeric';
                    }
                    return null;
                }
            });
            if (!customFileName) return;
            fileName = customFileName;
            template = getCustomConfigTemplate();
            break;
    }

    fs.mkdirSync(resourcesPath, { recursive: true });
    const filePath = path.join(resourcesPath, fileName);
    fs.writeFileSync(filePath, template);
    
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);
}

module.exports = {
    addCommand,
    addListener,
    addConfig
};