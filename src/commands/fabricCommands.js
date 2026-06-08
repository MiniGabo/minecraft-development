const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { getFabricModInfo } = require('../utils/fabricUtils');
const { findBasePackage } = require('../utils/packageUtils');

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
    let content = '';

    if (basePackage.isKotlin) {
        content = `package ${basePackage.name}.items

import net.minecraft.item.Item
import net.minecraft.item.ItemStack
import net.minecraft.util.TypedActionResult
import net.minecraft.entity.player.PlayerEntity
import net.minecraft.world.World
import net.minecraft.util.Hand

class ${className}(settings: Settings) : Item(settings) {
    override fun use(world: World, user: PlayerEntity, hand: Hand): TypedActionResult<ItemStack> {
        return super.use(world, user, hand)
    }
}`;
    } else {
        content = `package ${basePackage.name}.items;

import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.util.TypedActionResult;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.world.World;
import net.minecraft.util.Hand;

public class ${className} extends Item {
    public ${className}(Settings settings) {
        super(settings);
    }

    @Override
    public TypedActionResult<ItemStack> use(World world, PlayerEntity user, Hand hand) {
        return super.use(world, user, hand);
    }
}`;
    }

    fs.writeFileSync(classPath, content);

    // Create JSON model
    const modelDir = path.join(workspacePath, 'src', 'main', 'resources', 'assets', modInfo.id, 'models', 'item');
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
    const langDir = path.join(workspacePath, 'src', 'main', 'resources', 'assets', modInfo.id, 'lang');
    fs.mkdirSync(langDir, { recursive: true });
    const langPath = path.join(langDir, 'en_us.json');
    let langContent = {};
    if (fs.existsSync(langPath)) {
        try { langContent = JSON.parse(fs.readFileSync(langPath, 'utf8')); } catch (e) {}
    }
    langContent[`item.${modInfo.id}.${itemId}`] = itemName;
    fs.writeFileSync(langPath, JSON.stringify(langContent, null, 4));

    // AUTOMATIC REGISTRATION
    await registerFabricContent(workspacePath, modInfo, basePackage, itemName, itemId, className, 'ITEM');

    vscode.window.showInformationMessage(`Item ${itemName} created and registered!`);
    
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
    let content = '';

    if (basePackage.isKotlin) {
        content = `package ${basePackage.name}.blocks

import net.minecraft.block.Block
import net.minecraft.block.AbstractBlock

class ${className}(settings: Settings) : Block(settings) {
}`;
    } else {
        content = `package ${basePackage.name}.blocks;

import net.minecraft.block.Block;

public class ${className} extends Block {
    public ${className}(Settings settings) {
        super(settings);
    }
}`;
    }

    fs.writeFileSync(classPath, content);

    // Block States
    const stateDir = path.join(workspacePath, 'src', 'main', 'resources', 'assets', modInfo.id, 'blockstates');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, `${blockId}.json`), JSON.stringify({
        "variants": {
            "": { "model": `${modInfo.id}:block/${blockId}` }
        }
    }, null, 4));

    // Block Model
    const blockModelDir = path.join(workspacePath, 'src', 'main', 'resources', 'assets', modInfo.id, 'models', 'block');
    fs.mkdirSync(blockModelDir, { recursive: true });
    fs.writeFileSync(path.join(blockModelDir, `${blockId}.json`), JSON.stringify({
        "parent": "minecraft:block/cube_all",
        "textures": {
            "all": `${modInfo.id}:block/${blockId}`
        }
    }, null, 4));

    // Item Model for Block
    const itemModelDir = path.join(workspacePath, 'src', 'main', 'resources', 'assets', modInfo.id, 'models', 'item');
    fs.mkdirSync(itemModelDir, { recursive: true });
    fs.writeFileSync(path.join(itemModelDir, `${blockId}.json`), JSON.stringify({
        "parent": `${modInfo.id}:block/${blockId}`
    }, null, 4));

    // Lang
    const langPath = path.join(workspacePath, 'src', 'main', 'resources', 'assets', modInfo.id, 'lang', 'en_us.json');
    let langContent = {};
    if (fs.existsSync(langPath)) {
        try { langContent = JSON.parse(fs.readFileSync(langPath, 'utf8')); } catch (e) {}
    }
    langContent[`block.${modInfo.id}.${blockId}`] = blockName;
    fs.writeFileSync(langPath, JSON.stringify(langContent, null, 4));

    // AUTOMATIC REGISTRATION
    await registerFabricContent(workspacePath, modInfo, basePackage, blockName, blockId, className, 'BLOCK');

    vscode.window.showInformationMessage(`Block ${blockName} created and registered!`);
    
    const doc = await vscode.workspace.openTextDocument(classPath);
    await vscode.window.showTextDocument(doc);
}

/**
 * Automatically registers items or blocks in the main class
 */
async function registerFabricContent(workspacePath, modInfo, basePackage, name, id, className, type) {
    const mainClassEntry = modInfo.entrypoints.main[0];
    const mainClassRelativePath = mainClassEntry.replace(/\./g, '/') + (basePackage.isKotlin ? '.kt' : '.java');
    const mainClassPath = path.join(basePackage.srcRoot, mainClassRelativePath);

    if (!fs.existsSync(mainClassPath)) return;

    let content = fs.readFileSync(mainClassPath, 'utf8');
    const upperId = id.toUpperCase();
    const registryClass = type === 'ITEM' ? 'Registry.ITEM' : 'Registry.BLOCK';
    const minecraftClass = type === 'ITEM' ? 'Item' : 'Block';
    const subFolder = type === 'ITEM' ? 'items' : 'blocks';

    // 1. Add Import
    const importStatement = basePackage.isKotlin 
        ? `import ${basePackage.name}.${subFolder}.${className}`
        : `import ${basePackage.name}.${subFolder}.${className};`;
    
    if (!content.includes(importStatement)) {
        content = content.replace(/(package .*\n)/, `$1\n${importStatement}`);
        // Add additional required imports if missing
        const requiredImports = basePackage.isKotlin
            ? ['import net.minecraft.registry.Registry', `import net.minecraft.registry.Registries`, `import net.minecraft.util.Identifier`, `import net.minecraft.item.Item`, `import net.minecraft.block.Block`, `import net.minecraft.item.BlockItem`, `import net.minecraft.item.ItemStack`]
            : ['import net.minecraft.registry.Registry;', 'import net.minecraft.registry.Registries;', 'import net.minecraft.util.Identifier;', 'import net.minecraft.item.Item;', 'import net.minecraft.block.Block;', 'import net.minecraft.item.BlockItem;', 'import net.minecraft.item.ItemStack;'];
        
        for (const req of requiredImports) {
            if (!content.includes(req.split(' ')[1])) { // Check if imported class name exists
                content = content.replace(/(package .*\n)/, `$1\n${req}`);
            }
        }
    }

    // 2. Add Field and Registration
    const modId = modInfo.id;
    if (basePackage.isKotlin) {
        // Kotlin logic (Object or Class)
        const fieldName = id.toUpperCase();
        const fieldCode = type === 'ITEM' 
            ? `\n    val ${fieldName} = Registry.register(Registries.ITEM, Identifier.of("${modId}", "${id}"), ${className}(Item.Settings()))`
            : `\n    val ${fieldName} = Registry.register(Registries.BLOCK, Identifier.of("${modId}", "${id}"), ${className}(Block.Settings.create()))`;
        
        // Also need to register the block as an item
        const blockItemCode = type === 'BLOCK' 
            ? `\n    val ${fieldName}_ITEM = Registry.register(Registries.ITEM, Identifier.of("${modId}", "${id}"), BlockItem(${fieldName}, Item.Settings()))`
            : '';

        if (!content.includes(`${fieldName} =`)) {
            content = content.replace(/(onInitialize\(\) \{)/, `${fieldCode}${blockItemCode}\n$1`);
        }
    } else {
        // Java logic
        const fieldName = id.toUpperCase();
        const fieldCode = type === 'ITEM'
            ? `\n    public static final Item ${fieldName} = Registry.register(Registries.ITEM, Identifier.of("${modId}", "${id}"), new ${className}(new Item.Settings()));`
            : `\n    public static final Block ${fieldName} = Registry.register(Registries.BLOCK, Identifier.of("${modId}", "${id}"), new ${className}(Block.Settings.create()));`;
            
        const blockItemCode = type === 'BLOCK'
            ? `\n    public static final Item ${fieldName}_ITEM = Registry.register(Registries.ITEM, Identifier.of("${modId}", "${id}"), new BlockItem(${fieldName}, new Item.Settings()));`
            : '';

        if (!content.includes(`${fieldName} =`)) {
            // Find a good place to insert (before onInitialize or after the class opening)
            content = content.replace(/(public class .* \{)/, `$1${fieldCode}${blockItemCode}`);
        }
    }

    fs.writeFileSync(mainClassPath, content);
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
    
    // Create JSON recipe
    const recipeDir = path.join(workspacePath, 'src', 'main', 'resources', 'data', modInfo.id, 'recipe');
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
    let content = '';

    if (basePackage.isKotlin) {
        content = `package ${basePackage.name}.entities

import net.minecraft.entity.EntityType
import net.minecraft.entity.mob.PathAwareEntity
import net.minecraft.world.World

class ${className}(type: EntityType<out PathAwareEntity>, world: World) : PathAwareEntity(type, world) {
}`;
    } else {
        content = `package ${basePackage.name}.entities;

import net.minecraft.entity.EntityType;
import net.minecraft.entity.mob.PathAwareEntity;
import net.minecraft.world.World;

public class ${className} extends PathAwareEntity {
    public ${className}(EntityType<? extends PathAwareEntity> type, World world) {
        super(type, world);
    }
}`;
    }

    fs.writeFileSync(classPath, content);

    // Register Entity in Main Class
    const mainClassEntry = modInfo.entrypoints.main[0];
    const mainClassRelativePath = mainClassEntry.replace(/\./g, '/') + (basePackage.isKotlin ? '.kt' : '.java');
    const mainClassPath = path.join(basePackage.srcRoot, mainClassRelativePath);

    if (fs.existsSync(mainClassPath)) {
        let mainContent = fs.readFileSync(mainClassPath, 'utf8');
        const importStmt = basePackage.isKotlin 
            ? `import ${basePackage.name}.entities.${className}`
            : `import ${basePackage.name}.entities.${className};`;
        
        if (!mainContent.includes(importStmt)) {
            mainContent = mainContent.replace(/(package .*\n)/, `$1\n${importStmt}`);
            const extraImports = basePackage.isKotlin
                ? ['import net.minecraft.entity.EntityType', 'import net.minecraft.entity.SpawnGroup']
                : ['import net.minecraft.entity.EntityType;', 'import net.minecraft.entity.SpawnGroup;'];
            
            for (const imp of extraImports) {
                if (!mainContent.includes(imp.split(' ')[1])) {
                    mainContent = mainContent.replace(/(package .*\n)/, `$1\n${imp}`);
                }
            }
        }

        const fieldName = entityId.toUpperCase();
        if (basePackage.isKotlin) {
            const fieldCode = `\n    val ${fieldName}: EntityType<${className}> = Registry.register(Registries.ENTITY_TYPE, Identifier.of("${modInfo.id}", "${entityId}"), EntityType.Builder.create(::${className}, SpawnGroup.CREATURE).dimensions(0.75f, 0.75f).build("${entityId}"))`;
            if (!mainContent.includes(`${fieldName}: EntityType`)) {
                mainContent = mainContent.replace(/(onInitialize\(\) \{)/, `${fieldCode}\n$1`);
            }
        } else {
            const fieldCode = `\n    public static final EntityType<${className}> ${fieldName} = Registry.register(Registries.ENTITY_TYPE, Identifier.of("${modInfo.id}", "${entityId}"), EntityType.Builder.create(${className}::new, SpawnGroup.CREATURE).dimensions(0.75f, 0.75f).build("${entityId}"));`;
            if (!mainContent.includes(`${fieldName} =`)) {
                mainContent = mainContent.replace(/(public class .* \{)/, `$1${fieldCode}`);
            }
        }
        fs.writeFileSync(mainClassPath, mainContent);
    }

    vscode.window.showInformationMessage(`Entity ${entityName} created and registered!`);
    const doc = await vscode.workspace.openTextDocument(classPath);
    await vscode.window.showTextDocument(doc);
}

module.exports = {
    addFabricItem,
    addFabricBlock,
    addFabricRecipe,
    addFabricEntity
};
