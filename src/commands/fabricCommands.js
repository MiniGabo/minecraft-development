const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { 
    getFabricModInfo, 
    getFabricResourcePath, 
    getMinecraftVersion, 
    isModern 
} = require('../utils/fabricUtils');
const { findBasePackage } = require('../utils/packageUtils');
const { readTemplate, processTemplate } = require('../utils/templateUtils');

async function addFabricItem(context) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const modInfo = getFabricModInfo(workspacePath);
    if (!modInfo) {
        vscode.window.showErrorMessage('Not a Fabric project');
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
    
    const mcVersion = getMinecraftVersion(workspacePath);
    const modern = isModern(mcVersion);

    const template = await readTemplate(context, `fabric/Item.${ext}.template`);
    const content = processTemplate(template, {
        packageName: basePackage.name,
        className: className,
        actionResultClass: modern ? 'ActionResult' : 'TypedActionResult',
        genericType: modern ? '' : '<ItemStack>'
    });

    fs.writeFileSync(classPath, content);

    // Get correct resources path (Assets)
    const resPath = getFabricResourcePath(workspacePath, 'assets');

    // Create JSON model
    const modelDir = path.join(resPath, 'assets', modInfo.id, 'models', 'item');
    fs.mkdirSync(modelDir, { recursive: true });
    const modelPath = path.join(modelDir, `${itemId}.json`);
    const modelContent = {
        "parent": "minecraft:item/generated",
        "textures": {
            "layer0": `${modInfo.id}:item/${itemId}`
        }
    };
    fs.writeFileSync(modelPath, JSON.stringify(modelContent, null, 4));

    // Update Lang file (en_us)
    const langDir = path.join(resPath, 'assets', modInfo.id, 'lang');
    fs.mkdirSync(langDir, { recursive: true });
    const langPath = path.join(langDir, 'en_us.json');
    let langContent = {};
    if (fs.existsSync(langPath)) {
        try { langContent = JSON.parse(fs.readFileSync(langPath, 'utf8')); } catch (e) {}
    }
    langContent[`item.${modInfo.id}.${itemId}`] = itemName;
    fs.writeFileSync(langPath, JSON.stringify(langContent, null, 4));
    
    vscode.window.showInformationMessage(`Item ${itemName} created!`);
    
    const doc = await vscode.workspace.openTextDocument(classPath);
    await vscode.window.showTextDocument(doc);
}

async function addFabricBlock(context) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const modInfo = getFabricModInfo(workspacePath);
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
    
    const template = await readTemplate(context, `fabric/Block.${ext}.template`);
    const content = processTemplate(template, {
        packageName: basePackage.name,
        className: className
    });

    fs.writeFileSync(classPath, content);

    // Get correct resources path (Assets)
    const resPath = getFabricResourcePath(workspacePath, 'assets');

    // Block States
    const stateDir = path.join(resPath, 'assets', modInfo.id, 'blockstates');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, `${blockId}.json`), JSON.stringify({
        "variants": {
            "": { "model": `${modInfo.id}:block/${blockId}` }
        }
    }, null, 4));

    // Block Model
    const blockModelDir = path.join(resPath, 'assets', modInfo.id, 'models', 'block');
    fs.mkdirSync(blockModelDir, { recursive: true });
    fs.writeFileSync(path.join(blockModelDir, `${blockId}.json`), JSON.stringify({
        "parent": "minecraft:block/cube_all",
        "textures": {
            "all": `${modInfo.id}:block/${blockId}`
        }
    }, null, 4));

    // Item Model for Block
    const itemModelDir = path.join(resPath, 'assets', modInfo.id, 'models', 'item');
    fs.mkdirSync(itemModelDir, { recursive: true });
    fs.writeFileSync(path.join(itemModelDir, `${blockId}.json`), JSON.stringify({
        "parent": `${modInfo.id}:block/${blockId}`
    }, null, 4));

    // Lang
    const langPath = path.join(resPath, 'assets', modInfo.id, 'lang', 'en_us.json');
    let langContent = {};
    if (fs.existsSync(langPath)) {
        try { langContent = JSON.parse(fs.readFileSync(langPath, 'utf8')); } catch (e) {}
    }
    langContent[`block.${modInfo.id}.${blockId}`] = blockName;
    fs.writeFileSync(langPath, JSON.stringify(langContent, null, 4));

    // AUTOMATIC REGISTRATION REMOVED (Manual registration required)

    vscode.window.showInformationMessage(`Block ${blockName} created!`);
    
    const doc = await vscode.workspace.openTextDocument(classPath);
    await vscode.window.showTextDocument(doc);
}

async function addFabricRecipe(context) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const modInfo = getFabricModInfo(workspacePath);
    if (!modInfo) return;

    const recipeName = await vscode.window.showInputBox({
        prompt: 'Enter recipe name (e.g. ruby_block_recipe)',
        placeHolder: 'ruby_block'
    });

    if (!recipeName) return;

    const recipeId = recipeName.toLowerCase().replace(/ /g, '_');
    
    // Get correct resources path (Data)
    const resPath = getFabricResourcePath(workspacePath, 'data');

    // Create JSON recipe
    const recipeDir = path.join(resPath, 'data', modInfo.id, 'recipe');
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
            "id": `${modInfo.id}:${recipeId}`,
            "count": 1
        }
    };

    const recipePath = path.join(recipeDir, `${recipeId}.json`);
    fs.writeFileSync(recipePath, JSON.stringify(recipeContent, null, 4));

    vscode.window.showInformationMessage(`Recipe ${recipeId} created! Open the JSON to edit the pattern and keys.`);
    const doc = await vscode.workspace.openTextDocument(recipePath);
    await vscode.window.showTextDocument(doc);
}

async function addFabricEntity(context) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const modInfo = getFabricModInfo(workspacePath);
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
    
    const template = await readTemplate(context, `fabric/Entity.${ext}.template`);
    const content = processTemplate(template, {
        packageName: basePackage.name,
        className: className
    });

    fs.writeFileSync(classPath, content);

    // AUTOMATIC REGISTRATION REMOVED (Manual registration required)

    vscode.window.showInformationMessage(`Entity ${entityName} created!`);
    const doc = await vscode.workspace.openTextDocument(classPath);
    await vscode.window.showTextDocument(doc);
}

module.exports = {
    addFabricItem,
    addFabricBlock,
    addFabricRecipe,
    addFabricEntity
};
