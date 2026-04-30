const vscode = require('vscode');

async function generateGettersSetters() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    const document = editor.document;
    if (document.languageId !== 'java') {
        vscode.window.showErrorMessage('This command only works with Java files');
        return;
    }

    const text = document.getText();
    const fields = parseFields(text);
    
    if (fields.length === 0) {
        vscode.window.showInformationMessage('No fields found in this class');
        return;
    }

    const selectedFields = await vscode.window.showQuickPick(
        fields.map(f => ({
            label: f.name,
            description: f.type,
            picked: true,
            field: f
        })),
        {
            canPickMany: true,
            placeHolder: 'Select fields to generate getters/setters'
        }
    );

    if (!selectedFields || selectedFields.length === 0) return;

    const options = await vscode.window.showQuickPick(
        [
            { label: 'Generate Getters and Setters', id: 'both' },
            { label: 'Generate Getters Only', id: 'getters' },
            { label: 'Generate Setters Only', id: 'setters' }
        ],
        { placeHolder: 'What would you like to generate?' }
    );

    if (!options) return;

    const code = generateCode(selectedFields.map(f => f.field), options.id);
    const lastBracePosition = findLastBracePosition(document);
    
    await editor.edit(editBuilder => {
        editBuilder.insert(lastBracePosition, code);
    });
}

function parseFields(text) {
    const fields = [];
    const fieldRegex = /private\s+((?:static\s+)?)([\w<>[\],\s]+)\s+(\w+)\s*;/g;
    let match;

    while ((match = fieldRegex.exec(text)) !== null) {
        const isStatic = match[1].includes('static');
        const type = match[2].trim();
        const name = match[3];
        const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
        
        // Verificar si ya existen getters/setters
        const hasGetter = text.includes(`get${capitalizedName}()`) || text.includes(`get_${capitalizedName}()`);
        const hasSetter = text.includes(`set${capitalizedName}(`) || text.includes(`set_${capitalizedName}(`);
        
        // Solo añadir si falta al menos uno
        if (!hasGetter || !hasSetter) {
            fields.push({
                type: type,
                name: name,
                isStatic: isStatic,
                hasGetter: hasGetter,
                hasSetter: hasSetter
            });
        }
    }

    return fields;
}

function generateCode(fields, type) {
    let code = '\n\n';
    
    for (const field of fields) {
        const capitalizedName = field.name.charAt(0).toUpperCase() + field.name.slice(1);
        const staticModifier = field.isStatic ? 'static ' : '';
        
        if ((type === 'both' || type === 'getters') && !field.hasGetter) {
            code += `    public ${staticModifier}${field.type} get${capitalizedName}() {\n`;
            code += `        return ${field.name};\n`;
            code += '    }\n\n';
        }
        
        if ((type === 'both' || type === 'setters') && !field.hasSetter) {
            code += `    public ${staticModifier}void set${capitalizedName}(${field.type} ${field.name}) {\n`;
            code += `        ${field.isStatic ? field.name : 'this.' + field.name} = ${field.name};\n`;
            code += '    }\n\n';
        }
    }

    return code;
}

function findLastBracePosition(document) {
    const text = document.getText();
    const lastBrace = text.lastIndexOf('}');
    return document.positionAt(lastBrace);
}

module.exports = {
    generateGettersSetters
};
