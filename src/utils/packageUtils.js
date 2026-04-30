const fs = require('fs');
const path = require('path');

async function findBasePackage(workspacePath) {
    const srcPath = path.join(workspacePath, 'src', 'main', 'java');
    if (!fs.existsSync(srcPath)) return null;

    const pomPath = path.join(workspacePath, 'pom.xml');
    if (!fs.existsSync(pomPath)) return null;

    const pomContent = fs.readFileSync(pomPath, 'utf8');
    const groupIdMatch = /<groupId>(.*?)<\/groupId>/.exec(pomContent);
    const artifactIdMatch = /<artifactId>(.*?)<\/artifactId>/.exec(pomContent);

    if (!groupIdMatch || !artifactIdMatch) return null;

    const basePackageName = groupIdMatch[1];
    const packagePath = path.join(srcPath, ...basePackageName.split('.'));

    return {
        name: basePackageName,
        path: packagePath
    };
}

module.exports = {
    findBasePackage
};