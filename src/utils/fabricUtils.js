const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * Gets Fabric mod info from fabric.mod.json
 */
function getFabricModInfo(workspacePath) {
    const modJsonPath = path.join(workspacePath, 'src', 'main', 'resources', 'fabric.mod.json');
    if (!fs.existsSync(modJsonPath)) return null;

    try {
        const content = JSON.parse(fs.readFileSync(modJsonPath, 'utf8'));
        return {
            id: content.id,
            name: content.name,
            version: content.version,
            entrypoints: content.entrypoints
        };
    } catch (e) {
        return null;
    }
}

/**
 * Checks if the current project is a Fabric project
 */
function isFabricProject(workspacePath) {
    return fs.existsSync(path.join(workspacePath, 'src', 'main', 'resources', 'fabric.mod.json'));
}

/**
 * Returns default versions for Fabric components based on Minecraft version
 */
function getFabricVersionData(minecraftVersion) {
    const version = minecraftVersion || '1.21';
    const parts = version.split('.').map(Number);
    const major = parts[0];
    const minor = parts[1] || 0;

    let loom = '1.16-SNAPSHOT'; 
    let fabric = `0.151.0+${version}`; // Default for 26.x

    if (major === 1) {
        if (minor <= 14) {
            fabric = `0.4.1+${version}`;
        } else if (minor <= 16) {
            fabric = `0.42.0+1.16.5`;
        } else if (minor <= 18) {
            fabric = `0.76.0+1.18.2`;
        } else if (minor <= 19) {
            fabric = `0.87.0+1.19.4`;
        } else if (minor === 20) {
            fabric = `0.92.0+1.20.4`;
        } else if (minor === 21) {
            fabric = `0.114.0+1.21.4`;
        }
    } else if (major >= 26) {
        fabric = `0.151.0+${version}`;
    }

    return {
        loom_version: loom,
        loader_version: '0.19.3',
        yarn_mappings: `${version}+build.1`,
        fabric_version: fabric
    };
}

/**
 * Fetches Fabric API versions for a specific Minecraft version
 */
async function fetchFabricApiVersions(minecraftVersion) {
    try {
        // This is a bit more complex as it's often on Maven, 
        // but we can try to guess or use a common API version if meta doesn't provide it easily.
        // For now return a few common ones or 'latest'
        return ['latest', '0.100.3+1.21', '0.92.0+1.20.1', '0.87.0+1.19.2'];
    } catch (e) {
        return ['latest'];
    }
}

/**
 * Checks if the project uses a split environment structure
 */
function isSplitProject(workspacePath) {
    return fs.existsSync(path.join(workspacePath, 'src', 'client'));
}

/**
 * Gets the base path for assets or data based on project structure
 * @param {string} workspacePath 
 * @param {string} type 'assets' or 'data'
 */
function getFabricResourcePath(workspacePath, type) {
    if (type === 'assets' && isSplitProject(workspacePath)) {
        return path.join(workspacePath, 'src', 'client', 'resources');
    }
    return path.join(workspacePath, 'src', 'main', 'resources');
}

/**
 * Gets the Minecraft version from gradle.properties
 */
function getMinecraftVersion(workspacePath) {
    const propsPath = path.join(workspacePath, 'gradle.properties');
    if (!fs.existsSync(propsPath)) return null;

    const content = fs.readFileSync(propsPath, 'utf8');
    const match = content.match(/minecraft_version\s*=\s*([^\s\n]+)/);
    return match ? match[1] : null;
}

/**
 * Checks if the version is 1.21.2 or newer (including 2026 year-based versions)
 */
function isModern(version) {
    if (!version) return true; // Assume modern if unknown
    
    // Year-based versions (e.g. 26.1.1)
    const yearMatch = version.match(/^(\d{2})\./);
    if (yearMatch && parseInt(yearMatch[1]) >= 26) return true;

    const parts = version.split('.').map(Number);
    const major = parts[0];
    const minor = parts[1] || 0;
    const patch = parts[2] || 0;

    if (major > 1) return true;
    if (major === 1) {
        if (minor > 21) return true;
        if (minor === 21 && patch >= 2) return true;
    }
    
    return false;
}

module.exports = {
    getFabricModInfo,
    isFabricProject,
    getFabricVersionData,
    fetchFabricApiVersions,
    isSplitProject,
    getFabricResourcePath,
    getMinecraftVersion,
    isModern
};
