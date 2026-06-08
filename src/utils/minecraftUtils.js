const vscode = require('vscode');

const FALLBACK_VERSIONS = [
    '26.2.1', '26.2', '26.1.1', '26.1',
    '1.21.1', '1.21',
    '1.20.6', '1.20.5', '1.20.4', '1.20.3', '1.20.2', '1.20.1', '1.20',
    '1.19.4', '1.19.3', '1.19.2', '1.19.1', '1.19',
    '1.18.2', '1.18.1', '1.18',
    '1.17.1', '1.17',
    '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1',
    '1.15.2', '1.15.1', '1.15',
    '1.14.4', '1.14.3', '1.14.2', '1.14.1', '1.14',
    '1.13.2', '1.13.1', '1.13',
    '1.12.2', '1.12.1', '1.12',
    '1.11.2', '1.11.1', '1.11',
    '1.10.2', '1.10.1', '1.10',
    '1.9.4', '1.9.3', '1.9.2', '1.9.1', '1.9',
    '1.8.9', '1.8.8',
];

/**
 * Fetches Minecraft versions from Spigot Nexus repository.
 */
async function fetchMinecraftVersions() {
    try {
        const url = 'https://hub.spigotmc.org/nexus/repository/public/org/spigotmc/spigot-api/maven-metadata.xml';
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.text();
        
        const versionRegex = /<version>([\d.]+-R0\.\d+-SNAPSHOT)<\/version>/g;
        const versionsList = [];
        let match;
        
        while ((match = versionRegex.exec(data)) !== null) {
            versionsList.push(match[1]);
        }
        
        if (versionsList.length > 0) {
            const mcVersions = [...new Set(versionsList.map(v => v.replace(/-R\d+\.\d+-SNAPSHOT/, '')))];
            return _sortVersions(mcVersions);
        }
        
        return FALLBACK_VERSIONS;
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to fetch Spigot versions: ${error.message}. Using fallback list.`);
        return FALLBACK_VERSIONS;
    }
}

/**
 * Fetches stable game versions from Fabric Meta API
 */
async function fetchFabricGameVersions() {
    try {
        const response = await fetch('https://meta.fabricmc.net/v2/versions/game');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data
            .filter(v => v.stable)
            .map(v => v.version);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to fetch Fabric versions: ${error.message}`);
        return FALLBACK_VERSIONS.filter(v => parseInt(v.split('.')[1]) >= 14);
    }
}
/**
 * Fetches versions from Forge Maven metadata
 */
async function fetchForgeVersions() {
    try {
        const url = 'https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml';
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.text();

        // Forge versions are like 1.20.1-47.2.0 or 1.8.9-11.15.1.2318
        const versionRegex = /<version>([\d.]+)-[\d.]+.*?<\/version>/g;
        const mcVersions = new Set();
        let match;

        while ((match = versionRegex.exec(data)) !== null) {
            mcVersions.add(match[1]);
        }

        if (mcVersions.size > 0) {
            return _sortVersions(Array.from(mcVersions));
        }
        return FALLBACK_VERSIONS;
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to fetch Forge versions: ${error.message}`);
        return FALLBACK_VERSIONS;
    }
}

function _sortVersions(versions) {
    return versions.sort((a, b) => {
        const partsA = a.split('.').map(Number);
        const partsB = b.split('.').map(Number);
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const numA = partsA[i] || 0;
            const numB = partsB[i] || 0;
            if (numA !== numB) return numB - numA;
        }
        return 0;
    });
}

async function getLatestSpigotVersion(minecraftVersion) {
    try {
        const url = 'https://hub.spigotmc.org/nexus/repository/public/org/spigotmc/spigot-api/maven-metadata.xml';
        const response = await fetch(url);
        const data = await response.text();
        
        const versionRegex = new RegExp(`<version>(${minecraftVersion.replace(/\./g, '\\.')}-R(\\d+\\.\\d+)-SNAPSHOT)<\\/version>`, 'g');
        const matchingVersions = [];
        let match;
        
        while ((match = versionRegex.exec(data)) !== null) {
            matchingVersions.push({
                full: match[1],
                rVersion: match[2]
            });
        }
        
        if (matchingVersions.length > 0) {
            matchingVersions.sort((a, b) => {
                const [aMajor, aMinor] = a.rVersion.split('.').map(Number);
                const [bMajor, bMinor] = b.rVersion.split('.').map(Number);
                if (aMajor !== bMajor) return aMajor - bMajor;
                return aMinor - bMinor;
            });
            return matchingVersions[matchingVersions.length - 1].full;
        }
        
        return `${minecraftVersion}-R0.1-SNAPSHOT`;
    } catch (error) {
        return `${minecraftVersion}-R0.1-SNAPSHOT`;
    }
}

module.exports = {
    fetchMinecraftVersions,
    fetchFabricGameVersions,
    fetchForgeVersions,
    getLatestSpigotVersion,
    FALLBACK_VERSIONS
};
