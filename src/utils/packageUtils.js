const fs = require('fs');
const path = require('path');

/**
 * Finds the base package and source path for a Minecraft project.
 */
async function findBasePackage(workspacePath) {
    let packageName = null;
    
    // 1. Try to get package from fabric.mod.json if it exists
    const fabricModJsonPath = path.join(workspacePath, 'src', 'main', 'resources', 'fabric.mod.json');
    if (fs.existsSync(fabricModJsonPath)) {
        try {
            const modJson = JSON.parse(fs.readFileSync(fabricModJsonPath, 'utf8'));
            if (modJson.entrypoints && modJson.entrypoints.main && modJson.entrypoints.main.length > 0) {
                const mainClass = modJson.entrypoints.main[0];
                packageName = mainClass.substring(0, mainClass.lastIndexOf('.'));
            }
        } catch (e) {}
    }

    // 2. Check Maven (pom.xml)
    if (!packageName) {
        const pomPath = path.join(workspacePath, 'pom.xml');
        if (fs.existsSync(pomPath)) {
            const pomContent = fs.readFileSync(pomPath, 'utf8');
            const groupIdMatch = /<groupId>(.*?)<\/groupId>/.exec(pomContent);
            if (groupIdMatch) packageName = groupIdMatch[1];
        } 
    }
    
    // 3. Check Gradle (build.gradle)
    if (!packageName) {
        const buildGradlePath = path.join(workspacePath, 'build.gradle');
        const buildGradleKtsPath = path.join(workspacePath, 'build.gradle.kts');
        const gradlePropsPath = path.join(workspacePath, 'gradle.properties');
        
        let gradleContent = '';
        if (fs.existsSync(buildGradlePath)) {
            gradleContent = fs.readFileSync(buildGradlePath, 'utf8');
        } else if (fs.existsSync(buildGradleKtsPath)) {
            gradleContent = fs.readFileSync(buildGradleKtsPath, 'utf8');
        }

        if (gradleContent) {
            const groupMatch = /group\s*=\s*['"](.*?)['"]/.exec(gradleContent);
            if (groupMatch) {
                packageName = groupMatch[1];
            } else if (gradleContent.includes('project.maven_group') && fs.existsSync(gradlePropsPath)) {
                // Handle variable reference to gradle.properties
                const propsContent = fs.readFileSync(gradlePropsPath, 'utf8');
                const mavenGroupMatch = /maven_group\s*=\s*(.*)/.exec(propsContent);
                if (mavenGroupMatch) packageName = mavenGroupMatch[1].trim();
            }
        }
    }

    if (!packageName) {
        // Fallback: try to find by scanning src/main/java
        packageName = await findPackageByScanning(workspacePath);
    }

    if (!packageName) return null;

    // Determine source directory
    const kotlinPath = path.join(workspacePath, 'src', 'main', 'kotlin');
    const javaPath = path.join(workspacePath, 'src', 'main', 'java');
    
    let srcPath = null;
    if (fs.existsSync(kotlinPath)) {
        srcPath = kotlinPath;
    } else if (fs.existsSync(javaPath)) {
        srcPath = javaPath;
    }

    if (!srcPath) return null;

    const packagePath = path.join(srcPath, ...packageName.split('.'));

    return {
        name: packageName,
        path: packagePath,
        srcRoot: srcPath,
        isKotlin: srcPath.endsWith('kotlin')
    };
}

async function findPackageByScanning(workspacePath) {
    const javaPath = path.join(workspacePath, 'src', 'main', 'java');
    if (!fs.existsSync(javaPath)) return null;

    // Simple heuristic: find the first directory that contains a .java file
    return scanForFirstPackage(javaPath, "");
}

function scanForFirstPackage(currentDir, currentPackage) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    // Check if there are java files here
    const hasJava = entries.some(e => e.isFile() && e.name.endsWith('.java'));
    if (hasJava) return currentPackage;

    // Otherwise recurse
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const result = scanForFirstPackage(
                path.join(currentDir, entry.name),
                currentPackage ? `${currentPackage}.${entry.name}` : entry.name
            );
            if (result) return result;
        }
    }
    return null;
}

module.exports = {
    findBasePackage
};
