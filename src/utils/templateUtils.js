const vscode = require('vscode');
const path = require('path');

/**
 * Reads a template file from extension resources
 */
async function readTemplate(context, templatePath) {
    const uri = vscode.Uri.file(path.join(context.extensionPath, 'src', 'resources', 'templates', templatePath));
    const buffer = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(buffer).toString('utf8');
}

/**
 * Processes a template string by replacing {{VAR}} placeholders
 */
function processTemplate(content, variables) {
    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables.hasOwnProperty(key) ? variables[key] : match;
    });
}

module.exports = {
    readTemplate,
    processTemplate
};
