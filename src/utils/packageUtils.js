const fs = require('fs');
const path = require('path');

/**
 * Finds the base package and source path for a Minecraft plugin project.
 * Supports both Maven and Gradle, and Java and Kotlin.
 */
async function findBasePackage(workspacePath) {
    // 1. Determine build system and get groupId/packageName
    let packageName = null;
    
    // Check Maven
    const pomPath = path.join(workspacePath, 'pom.xml');
    if (fs.existsSync(pomPath)) {
        const pomContent = fs.readFileSync(pomPath, 'utf8');
        const groupIdMatch = /<groupId>(.*?)<\/groupId>/.exec(pomContent);
        if (groupIdMatch) packageName = groupIdMatch[1];
    } 
    
    // Check Gradle (if Maven failed or for Gradle projects)
    if (!packageName) {
        const buildGradlePath = path.join(workspacePath, 'build.gradle');
        const buildGradleKtsPath = path.join(workspacePath, 'build.gradle.kts');
        let gradleContent = '';
        
        if (fs.existsSync(buildGradlePath)) {
            gradleContent = fs.readFileSync(buildGradlePath, 'utf8');
        } else if (fs.existsSync(buildGradleKtsPath)) {
            gradleContent = fs.readFileSync(buildGradleKtsPath, 'utf8');
        }

        if (gradleContent) {
            const groupMatch = /group\s*=\s*['"](.*?)['"]/.exec(gradleContent);
            if (groupMatch) packageName = groupMatch[1];
        }
    }

    if (!packageName) return null;

    // 2. Determine source directory (Kotlin takes precedence if both exist)
    const kotlinPath = path.join(workspacePath, 'src', 'main', 'kotlin');
    const javaPath = path.join(workspacePath, 'src', 'main', 'java');
    
    let srcPath = null;
    if (fs.existsSync(kotlinPath)) {
        srcPath = kotlinPath;
    } else if (fs.existsSync(javaPath)) {
        srcPath = javaPath;
    }

    if (!srcPath) return null;

    // 3. Resolve the full package path
    const packagePath = path.join(srcPath, ...packageName.split('.'));

    return {
        name: packageName,
        path: packagePath,
        srcRoot: srcPath,
        isKotlin: srcPath.endsWith('kotlin')
    };
}

module.exports = {
    findBasePackage
};
