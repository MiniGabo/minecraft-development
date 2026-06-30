const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { getForgeModInfo } = require('../utils/forgeUtils');
const { findBasePackage } = require('../utils/packageUtils');
const { readTemplate, processTemplate } = require('../utils/templateUtils');
const { usesNewItemUseSignature, getForgeEra } = require('../utils/minecraftUtils');

function _getForgeTemplateDir(modInfo) {
    if (modInfo.type === 'legacy') return 'forge/legacy';
    const era = getForgeEra(modInfo.minecraftVersion);
    if (era === 'fg4') return 'forge/fg4';
    if (era === 'fg5') return 'forge/fg5';
    return 'forge/modern';
}

async function addForgeItem(context) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const modInfo = getForgeModInfo(workspacePath);
    if (!modInfo) {
        vscode.window.showErrorMessage('Not a Forge project');
        return;
    }

    const basePackage = await findBasePackage(workspacePath);
    if (!basePackage) return;

    const itemName = await vscode.window.showInputBox({
        prompt: 'Enter item name (e.g. Ruby)',
        placeHolder: 'Ruby',
        validateInput: text => /^[a-zA-Z0-9_]+$/.test(text) ? null : 'Invalid item name'
    });

    if (!itemName) return;

    const itemId = itemName.toLowerCase().replace(/ /g, '_');
    const className = itemName.replace(/ /g, '') + 'Item';
    
    // Create class
    const ext = basePackage.isKotlin ? 'kt' : 'java';
    const itemsDir = path.join(basePackage.path, 'items');
    fs.mkdirSync(itemsDir, { recursive: true });

    const classPath = path.join(itemsDir, `${className}.${ext}`);
    
	const templateDir = _getForgeTemplateDir(modInfo);

    let itemTemplateName = `Item.${ext}.template`;
    if (modInfo.type === 'modern') {
        if (modInfo.minecraftVersion) {
            if (usesNewItemUseSignature(modInfo.minecraftVersion)) {
                itemTemplateName = `Item.new.${ext}.template`;
            }
        }
    }

    const template = await readTemplate(context, `${templateDir}/${itemTemplateName}`);
    const content = processTemplate(template, {
        packageName: basePackage.name,
        className: className
    });

    fs.writeFileSync(classPath, content);

    // Create JSON model
    const modelDir = path.join(workspacePath, 'src', 'main', 'resources', 'assets', modInfo.id, 'models', 'item');
    fs.mkdirSync(modelDir, { recursive: true });
    const modelPath = path.join(modelDir, `${itemId}.json`);
    const textureSubDir = modInfo.type === 'modern' ? 'item' : 'items';
    const modelContent = {
        "parent": "minecraft:item/generated",
        "textures": {
            "layer0": `${modInfo.id}:${textureSubDir}/${itemId}`
        }
    };
    fs.writeFileSync(modelPath, JSON.stringify(modelContent, null, 4));

    // Update Lang file
    const langDir = path.join(workspacePath, 'src', 'main', 'resources', 'assets', modInfo.id, 'lang');
    fs.mkdirSync(langDir, { recursive: true });
    
    if (modInfo.type === 'modern') {
        const langPath = path.join(langDir, 'en_us.json');
        let langContent = {};
        if (fs.existsSync(langPath)) {
            try { langContent = JSON.parse(fs.readFileSync(langPath, 'utf8')); } catch (e) {}
        }
        langContent[`item.${modInfo.id}.${itemId}`] = itemName;
        fs.writeFileSync(langPath, JSON.stringify(langContent, null, 4));
    } else {
        const langPath = path.join(langDir, 'en_us.lang');
        let langContent = '';
        if (fs.existsSync(langPath)) {
            langContent = fs.readFileSync(langPath, 'utf8');
        }
        const langEntry = `item.${itemId}.name=${itemName}\n`;
        if (!langContent.includes(`item.${itemId}.name=`)) {
            fs.appendFileSync(langPath, langEntry);
        }
    }

    vscode.window.showInformationMessage(`Forge Item ${itemName} created!`);
    
    const doc = await vscode.workspace.openTextDocument(classPath);
    await vscode.window.showTextDocument(doc);
}

async function addForgeBlock(context) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const modInfo = getForgeModInfo(workspacePath);
    if (!modInfo) return;

    const basePackage = await findBasePackage(workspacePath);
    if (!basePackage) return;

    const blockName = await vscode.window.showInputBox({
        prompt: 'Enter block name (e.g. Ruby Block)',
        placeHolder: 'Ruby Block'
    });

    if (!blockName) return;

    const blockId = blockName.toLowerCase().replace(/ /g, '_');
    const className = blockName.replace(/ /g, '') + 'Block';
    const ext = basePackage.isKotlin ? 'kt' : 'java';
    
    const blocksDir = path.join(basePackage.path, 'blocks');
    fs.mkdirSync(blocksDir, { recursive: true });

    const classPath = path.join(blocksDir, `${className}.${ext}`);
    
    const templateDir = _getForgeTemplateDir(modInfo);
    const template = await readTemplate(context, `${templateDir}/Block.${ext}.template`);
    const content = processTemplate(template, {
        packageName: basePackage.name,
        className: className
    });

    fs.writeFileSync(classPath, content);

    // Block States
    const stateDir = path.join(workspacePath, 'src', 'main', 'resources', 'assets', modInfo.id, 'blockstates');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, `${blockId}.json`), JSON.stringify({
        "variants": {
            "": { "model": `${modInfo.id}:block/${blockId}` }
        }
    }, null, 4));

    const textureSubDir = modInfo.type === 'modern' ? 'block' : 'blocks';

    // Block Model
    const blockModelDir = path.join(workspacePath, 'src', 'main', 'resources', 'assets', modInfo.id, 'models', 'block');
    fs.mkdirSync(blockModelDir, { recursive: true });
    fs.writeFileSync(path.join(blockModelDir, `${blockId}.json`), JSON.stringify({
        "parent": "minecraft:block/cube_all",
        "textures": {
            "all": `${modInfo.id}:${textureSubDir}/${blockId}`
        }
    }, null, 4));

    // Item Model for Block
    const itemModelDir = path.join(workspacePath, 'src', 'main', 'resources', 'assets', modInfo.id, 'models', 'item');
    fs.mkdirSync(itemModelDir, { recursive: true });
    fs.writeFileSync(path.join(itemModelDir, `${blockId}.json`), JSON.stringify({
        "parent": `${modInfo.id}:block/${blockId}`
    }, null, 4));

    // Lang
    const langDir = path.join(workspacePath, 'src', 'main', 'resources', 'assets', modInfo.id, 'lang');
    fs.mkdirSync(langDir, { recursive: true });

    if (modInfo.type === 'modern') {
        const langPath = path.join(langDir, 'en_us.json');
        let langContent = {};
        if (fs.existsSync(langPath)) {
            try { langContent = JSON.parse(fs.readFileSync(langPath, 'utf8')); } catch (e) {}
        }
        langContent[`block.${modInfo.id}.${blockId}`] = blockName;
        fs.writeFileSync(langPath, JSON.stringify(langContent, null, 4));
    } else {
        const langPath = path.join(langDir, 'en_us.lang');
        let langContent = '';
        if (fs.existsSync(langPath)) {
            langContent = fs.readFileSync(langPath, 'utf8');
        }
        const langEntry = `tile.${blockId}.name=${blockName}\n`;
        if (!langContent.includes(`tile.${blockId}.name=`)) {
            fs.appendFileSync(langPath, langEntry);
        }
    }

    vscode.window.showInformationMessage(`Forge Block ${blockName} created!`);
    
    const doc = await vscode.workspace.openTextDocument(classPath);
    await vscode.window.showTextDocument(doc);
}

async function addForgeRecipe(context) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const modInfo = getForgeModInfo(workspacePath);
    if (!modInfo) return;

    const recipeName = await vscode.window.showInputBox({
        prompt: 'Enter recipe name (e.g. ruby_block_recipe)',
        placeHolder: 'ruby_block'
    });

    if (!recipeName) return;

    const recipeId = recipeName.toLowerCase().replace(/ /g, '_');
    
    // Create JSON recipe
    const recipeDir = path.join(workspacePath, 'src', 'main', 'resources', 'data', modInfo.id, 'recipes');
    fs.mkdirSync(recipeDir, { recursive: true });
    
    const recipeContent = {
        "type": "minecraft:crafting_shaped",
        "pattern": [
            "###",
            "###",
            "###"
        ],
        "key": {
            "#": { "item": "minecraft:diamond" }
        },
        "result": {
            "item": `${modInfo.id}:${recipeId}`,
            "count": 1
        }
    };

    const recipePath = path.join(recipeDir, `${recipeId}.json`);
    fs.writeFileSync(recipePath, JSON.stringify(recipeContent, null, 4));

    vscode.window.showInformationMessage(`Recipe ${recipeId} created!`);
    const doc = await vscode.workspace.openTextDocument(recipePath);
    await vscode.window.showTextDocument(doc);
}

async function addForgeEntity(context) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const modInfo = getForgeModInfo(workspacePath);
    if (!modInfo) return;

    const basePackage = await findBasePackage(workspacePath);
    if (!basePackage) return;

    const entityName = await vscode.window.showInputBox({
        prompt: 'Enter entity name (e.g. Penguin)',
        placeHolder: 'RubyEntity'
    });

    if (!entityName) return;

    const entityId = entityName.toLowerCase().replace(/ /g, '_');
    const className = entityName.replace(/ /g, '') + 'Entity';
    const ext = basePackage.isKotlin ? 'kt' : 'java';
    
    const entityDir = path.join(basePackage.path, 'entities');
    fs.mkdirSync(entityDir, { recursive: true });

    const classPath = path.join(entityDir, `${className}.${ext}`);
    
    const templateDir = _getForgeTemplateDir(modInfo);
    try {
        const template = await readTemplate(context, `${templateDir}/Entity.${ext}.template`);
        const content = processTemplate(template, {
            packageName: basePackage.name,
            className: className
        });
        fs.writeFileSync(classPath, content);
    } catch (e) {
        vscode.window.showErrorMessage(`Failed to read Entity template: ${e.message}`);
        return;
    }

    vscode.window.showInformationMessage(`Forge Entity ${entityName} created!`);
    
    const doc = await vscode.workspace.openTextDocument(classPath);
    await vscode.window.showTextDocument(doc);
}

module.exports = {
    addForgeItem,
    addForgeBlock,
    addForgeRecipe,
    addForgeEntity
};
