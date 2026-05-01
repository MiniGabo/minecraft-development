const vscode = require('vscode');

async function generateGettersSetters() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    const document = editor.document;
    const isKotlin = document.languageId === 'kotlin';
    
    if (document.languageId !== 'java' && document.languageId !== 'kotlin') {
        vscode.window.showErrorMessage('This command only works with Java or Kotlin files');
        return;
    }

    const text = document.getText();
    const fields = isKotlin ? parseKotlinFields(text) : parseJavaFields(text);
    
    if (fields.length === 0) {
        vscode.window.showInformationMessage('No fields found in this class');
        return;
    }

    const selectedFields = await vscode.window.showQuickPick(
        fields.map(f => ({
            label: f.name,
            description: `${f.isStatic ? 'static ' : ''}${f.type}`,
            picked: true,
            field: f
        })),
        {
            canPickMany: true,
            placeHolder: `Select fields to generate ${isKotlin ? 'Getters/Setters' : 'Getters/Setters'}`
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

    const code = isKotlin 
        ? generateKotlinCode(selectedFields.map(f => f.field), options.id)
        : generateJavaCode(selectedFields.map(f => f.field), options.id);
        
    const lastBracePosition = findLastBracePosition(document);
    
    await editor.edit(editBuilder => {
        editBuilder.insert(lastBracePosition, code);
    });
}

function parseJavaFields(text) {
    const fields = [];
    // Enhanced regex: handles modifiers, static/final, types with generics, and initializers
    const fieldRegex = /(?:private|protected|public|)\s+((?:static\s+)?(?:final\s+)?)([\w<>[\],\s]+)\s+(\w+)(?:\s*=[^;]+)?\s*;/g;
    let match;

    while ((match = fieldRegex.exec(text)) !== null) {
        const modifiers = match[1];
        const isStatic = modifiers.includes('static');
        const isFinal = modifiers.includes('final');
        const type = match[2].trim();
        const name = match[3];

        const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
        
        // Check if getter/setter already exists using more robust search
        const hasGetter = new RegExp(`public\\s+.*get${capitalizedName}\\s*\\(`).test(text) || 
                          new RegExp(`public\\s+.*is${capitalizedName}\\s*\\(`).test(text);
        const hasSetter = new RegExp(`public\\s+void\\s+set${capitalizedName}\\s*\\(`).test(text);
        
        // Only show if missing at least one requested access method
        if (!hasGetter || (!hasSetter && !isFinal)) {
            fields.push({ type, name, isStatic, isFinal, hasGetter, hasSetter });
        }
    }
    return fields;
}

function parseKotlinFields(text) {
    const fields = [];
    // Regex for Kotlin: handles var/val, name, optional type, and initializers
    const fieldRegex = /(?:private|protected|public|)\s*(var|val)\s+(\w+)(?:\s*:\s*([\w<>[\],\s]+))?(?:\s*=[^ \n\r]+)?/g;
    let match;

    while ((match = fieldRegex.exec(text)) !== null) {
        const isVal = match[1] === 'val';
        const name = match[2];
        let type = match[3] ? match[3].trim() : 'Any';

        const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
        const hasGetter = text.includes(`fun get${capitalizedName}()`);
        const hasSetter = text.includes(`fun set${capitalizedName}(`);
        
        if (!hasGetter || (!hasSetter && !isVal)) {
            fields.push({ type, name, isStatic: false, isFinal: isVal, hasGetter, hasSetter });
        }
    }
    return fields;
}

function generateJavaCode(fields, type) {
    let code = '\n';
    for (const field of fields) {
        const capitalizedName = field.name.charAt(0).toUpperCase() + field.name.slice(1);
        const staticMod = field.isStatic ? 'static ' : '';
        
        if ((type === 'both' || type === 'getters') && !field.hasGetter) {
            code += `    public ${staticMod}${field.type} get${capitalizedName}() {\n        return ${field.name};\n    }\n\n`;
        }
        if ((type === 'both' || type === 'setters') && !field.hasSetter && !field.isFinal) {
            code += `    public ${staticMod}void set${capitalizedName}(${field.type} ${field.name}) {\n        ${field.isStatic ? (field.name.startsWith('this.') ? '' : field.name) : 'this.' + field.name} = ${field.name};\n    }\n\n`;
        }
    }
    return code;
}

function generateKotlinCode(fields, type) {
    let code = '\n';
    for (const field of fields) {
        const capitalizedName = field.name.charAt(0).toUpperCase() + field.name.slice(1);
        
        if ((type === 'both' || type === 'getters') && !field.hasGetter) {
            code += `    fun get${capitalizedName}(): ${field.type} = ${field.name}\n\n`;
        }
        if ((type === 'both' || type === 'setters') && !field.hasSetter && !field.isFinal) {
            code += `    fun set${capitalizedName}(${field.name}: ${field.type}) {\n        this.${field.name} = ${field.name}\n    }\n\n`;
        }
    }
    return code;
}

function findLastBracePosition(document) {
    const text = document.getText();
    const lastBrace = text.lastIndexOf('}');
    return document.positionAt(lastBrace > -1 ? lastBrace : text.length);
}

module.exports = {
    generateGettersSetters
};
