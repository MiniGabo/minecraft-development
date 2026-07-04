const vscode = require('vscode');

const FALLBACK_VERSIONS = [
    '26.2', '26.2.1', '26.2', '26.1.1', '26.1',
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
    '1.7.10'
];

let spigotMetadataCache = null;

/**
 * Fetches and caches Spigot Maven metadata.
 */
async function _fetchSpigotMetadata() {
    if (spigotMetadataCache) return spigotMetadataCache;
    try {
        const url = 'https://hub.spigotmc.org/nexus/repository/public/org/spigotmc/spigot-api/maven-metadata.xml';
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        spigotMetadataCache = await response.text();
        return spigotMetadataCache;
    } catch (error) {
        throw error;
    }
}

/**
 * Fetches Minecraft versions from Spigot Nexus repository.
 */
async function fetchMinecraftVersions() {
    try {
        const data = await _fetchSpigotMetadata();
        // More permissive regex to catch pre-releases and different R-versions
        const versionRegex = /<version>([^<]+-R\d+\.\d+-SNAPSHOT)<\/version>/g;
        const versionsList = [];
        let match;
        
        while ((match = versionRegex.exec(data)) !== null) {
            versionsList.push(match[1]);
        }
        
        if (versionsList.length > 0) {
            // Robustly extract the Minecraft version part
            const mcVersions = [...new Set(versionsList.map(v => v.replace(/-R\d+\.\d+-SNAPSHOT$/, '')))];
            return _sortVersions(mcVersions);
        }
        
        return FALLBACK_VERSIONS;
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to fetch Spigot versions: ${error.message}. Using fallback list.`);
        return FALLBACK_VERSIONS;
    }
}

/**
 * Fetches Paper versions from PaperMC API (v3 - fill.papermc.io)
 */
async function fetchPaperVersions() {
    try {
        const response = await fetch('https://fill.papermc.io/v3/projects/paper', {
            headers: { 'User-Agent': 'minecraft-dev-extension/1.3.1 (https://github.com/MiniGabo/minecraft-development)' }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        // v3 returns versions as an object with groups as keys
        if (data.versions) {
            const versions = [];
            for (const group of Object.values(data.versions)) {
                versions.push(...group);
            }
            if (versions.length > 0) {
                return _sortVersions(versions);
            }
        }
        return FALLBACK_VERSIONS;
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to fetch Paper versions: ${error.message}`);
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

function compareMinecraftVersions(a, b) {
    const pa = a.split('.').map(n => parseInt(n, 10) || 0);
    const pb = b.split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

function usesNewItemUseSignature(minecraftVersion) {
    if (!minecraftVersion) return false;
    return compareMinecraftVersions(minecraftVersion, '1.21.2') >= 0;
}

function usesEventBus7(minecraftVersion) {
    if (!minecraftVersion) return false;
    return compareMinecraftVersions(minecraftVersion, '1.21.9') >= 0;
}

function getForgeEra(minecraftVersion) {
    if (!minecraftVersion) return 'fg6';
    const parts = minecraftVersion.split('.').map(Number);
    const major = parts[0], minor = parts[1] || 0;

    if (major === 1 && minor <= 12) return 'legacy';
    if (major === 1 && minor <= 16) return 'fg4';  // FG3 (1.13-1.14.4) and FG4 (1.15-1.16.5)
    if (major === 1 && minor <= 18) return 'fg5';  // FG5 (1.17-1.18.2)
    if (compareMinecraftVersions(minecraftVersion, '1.21.9') >= 0) return 'fg6-eventbus7';
    return 'fg6'; // 1.19-1.21.8
}

function getForgeGradlePluginVersion(minecraftVersion) {
    const parts = minecraftVersion.split('.').map(Number);
    const major = parts[0], minor = parts[1] || 0;
    if (major === 1 && minor <= 14) return '3.0.+';
    if (major === 1 && minor <= 16) return '4.0.1';
    if (major === 1 && minor <= 18) return '5.1.+';
    return null;
}

function usesPre17Names(minecraftVersion) {
    if (!minecraftVersion) return false;
    return compareMinecraftVersions(minecraftVersion, '1.17') < 0;
}

function getRecommendedJavaVersion(minecraftVersion) {
    const yearMatch = minecraftVersion.match(/^(\d{2})\./);
    if (yearMatch && parseInt(yearMatch[1]) >= 26) return '25';
    if (compareMinecraftVersions(minecraftVersion, '1.20.5') >= 0) return '21';
    if (compareMinecraftVersions(minecraftVersion, '1.18') >= 0) return '17';
    if (compareMinecraftVersions(minecraftVersion, '1.17') >= 0) return '16';
    return '8';
}

function getPackFormat(minecraftVersion) {
    const table = [
        ['1.13', '1.14.4', 4], ['1.15', '1.16.1', 5], ['1.16.2', '1.16.5', 6],
        ['1.17', '1.17.1', 7], ['1.18', '1.18.2', 8],
        ['1.19', '1.19.1', 9], ['1.19.2', '1.19.3', 12], ['1.19.4', '1.19.4', 13],
        ['1.20', '1.20.1', 15], ['1.20.2', '1.20.3', 18], ['1.20.4', '1.20.4', 22],
        ['1.20.5', '1.20.6', 32], ['1.21', '1.21.1', 34]
    ];
    for (const [from, to, format] of table) {
        if (compareMinecraftVersions(minecraftVersion, from) >= 0 && compareMinecraftVersions(minecraftVersion, to) <= 0) {
            return format;
        }
    }
    return 34; // fallback
}

function usesGradlePropertiesPattern(minecraftVersion) {
    const era = getForgeEra(minecraftVersion);
    return era === 'fg6' || era === 'fg6-eventbus7';
}

function _sortVersions(versions) {
    return versions.sort((a, b) => {
        const partsA = a.split(/[.-]/);
        const partsB = b.split(/[.-]/);
        
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const vA = partsA[i];
            const vB = partsB[i];
            
            if (vA === vB) continue;
            
            const nA = parseInt(vA);
            const nB = parseInt(vB);
            const isNumA = vA !== undefined && !isNaN(nA) && /^\d+$/.test(vA);
            const isNumB = vB !== undefined && !isNaN(nB) && /^\d+$/.test(vB);

            if (vA === undefined) return isNumB ? 1 : -1;
            if (vB === undefined) return isNumA ? -1 : 1;

            if (isNumA && isNumB) {
                if (nA !== nB) return nB - nA;
                continue;
            }
            
            if (isNumA) return -1;
            if (isNumB) return 1;
            
            return vB.localeCompare(vA);
        }
        return 0;
    });
}

async function getLatestSpigotVersion(minecraftVersion) {
    try {
        const data = await _fetchSpigotMetadata();
        
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

/**
 * Fetches the latest Paper version for a specific Minecraft version.
 */
async function getLatestPaperVersion(minecraftVersion) {
    try {
        const response = await fetch(`https://fill.papermc.io/v3/projects/paper/versions/${minecraftVersion}/builds`, {
            headers: { 'User-Agent': 'minecraft-dev-extension/1.3.1 (https://github.com/MiniGabo/minecraft-development)' }
        });
        if (!response.ok) return `${minecraftVersion}-R0.1-SNAPSHOT`;
        
        const data = await response.json();
        if (data.builds && data.builds.length > 0) {
            return `${minecraftVersion}-R0.1-SNAPSHOT`;
        }
        return `${minecraftVersion}-R0.1-SNAPSHOT`;
    } catch (error) {
        return `${minecraftVersion}-R0.1-SNAPSHOT`;
    }
}

let velocityMetadataCache = null;

/**
 * Fetches and caches Velocity Maven metadata.
 */
async function _fetchVelocityMetadata() {
    if (velocityMetadataCache) return velocityMetadataCache;
    try {
        const url = 'https://repo.papermc.io/repository/maven-public/com/velocitypowered/velocity-api/maven-metadata.xml';
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        velocityMetadataCache = await response.text();
        return velocityMetadataCache;
    } catch (error) {
        throw error;
    }
}

/**
 * Fetches Minecraft versions supported by Velocity.
 */
async function fetchVelocityVersions() {
    try {
        const data = await _fetchVelocityMetadata();
        // Velocity versions are like 3.3.0-SNAPSHOT, we need MC versions
        // Velocity supports the same MC versions as Paper, so we use Paper's list
        return await fetchPaperVersions();
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to fetch Velocity versions: ${error.message}`);
        return FALLBACK_VERSIONS;
    }
}

/**
 * Returns the Velocity API version to use.
 * Using 3.4.0-SNAPSHOT as it has complete API support (3.5.0 does not yet).
 */
async function getLatestVelocityVersion(minecraftVersion) {
    return '3.4.0-SNAPSHOT';
}

/**
 * Returns the recommended Gradle version for a given platform and Minecraft version.
 */
function getRecommendedGradleVersion(platform, minecraftVersion) {
    const mc = minecraftVersion || '1.21';
    
    if (platform === 'forge') {
        if (mc === '1.7.10' || mc === '1.8.9' || mc.startsWith('1.12')) return '4.10.3';
        if (mc.startsWith('1.13')) return '5.6.4'; // ⚠️ sin confirmar, FG3
        if (mc.startsWith('1.14') || mc.startsWith('1.15') || mc.startsWith('1.16')) return '6.9.4';
        if (mc.startsWith('1.17')) return '7.6';
        if (mc.startsWith('1.18') || mc.startsWith('1.19')) return '7.6';
        if (mc.startsWith('1.20') || mc.startsWith('1.21')) return '8.10';
        return '8.10'; // Default for modern Forge
    }

    if (platform === 'fabric') {
        if (mc.startsWith('1.14') || mc.startsWith('1.15') || mc.startsWith('1.16') || 
            mc.startsWith('1.17') || mc.startsWith('1.18') || mc.startsWith('1.19') || 
            mc.startsWith('1.20')) return '8.10';
        if (mc.startsWith('1.21')) return '9.5.1';
        
        // Handle year-based versions (2026+)
        const yearMatch = mc.match(/^(\d{2})\./);
        if (yearMatch && parseInt(yearMatch[1]) >= 26) {
            return '9.5.1';
        }
        return '9.5.1'; // Default for newest Fabric
    }

    // Spigot / Paper / Others
    if (mc.startsWith('1.8') || mc.startsWith('1.12') || mc.startsWith('1.16')) return '6.9.4';
    if (mc.startsWith('1.17')) return '7.6';
    if (mc.startsWith('1.18') || mc.startsWith('1.19') || mc === '1.20.1' || mc === '1.20.2' || mc === '1.20.3' || mc === '1.20.4') return '7.6';
    if (mc === '1.20.5' || mc === '1.20.6') return '8.10';
    if (mc.startsWith('1.21')) return '9.5.1';

    // Handle year-based versions (2026+)
    const yearMatch = mc.match(/^(\d{2})\./);
    if (yearMatch && parseInt(yearMatch[1]) >= 26) {
        return '9.5.1';
    }

    return '9.5.1'; // Modern default
}

module.exports = {
    fetchMinecraftVersions,
    fetchPaperVersions,
    fetchFabricGameVersions,
    fetchForgeVersions,
    fetchVelocityVersions,
    getLatestSpigotVersion,
    getLatestPaperVersion,
    getLatestVelocityVersion,
    getRecommendedGradleVersion,
	compareMinecraftVersions,
    usesNewItemUseSignature,
	usesEventBus7,
    getForgeEra,
    getForgeGradlePluginVersion,
    usesPre17Names,
    getRecommendedJavaVersion,
    getPackFormat,
    usesGradlePropertiesPattern,
    FALLBACK_VERSIONS
};
