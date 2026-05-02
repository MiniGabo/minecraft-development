const FALLBACK_VERSIONS = [
    '1.21.11','1.21.10', '1.21.9', '1.21.8', '1.21.7', '1.21.6', '1.21.5', '1.21.4', '1.21.3', '1.21.2', '1.21.1', '1.21',
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
 * @returns {Promise<string[]>} List of versions in descending order.
 */
async function fetchMinecraftVersions() {
    try {
        const url = 'https://hub.spigotmc.org/nexus/repository/public/org/spigotmc/spigot-api/maven-metadata.xml';
        const response = await fetch(url);
        const data = await response.text();
        
        // Extract all version tags using regex
        const versionRegex = /<version>([\d.]+-R0\.\d+-SNAPSHOT)<\/version>/g;
        const versionsList = [];
        let match;
        
        while ((match = versionRegex.exec(data)) !== null) {
            versionsList.push(match[1]);
        }
        
        if (versionsList.length > 0) {
            return versionsList
                .filter(v => v.endsWith('-R0.1-SNAPSHOT'))
                .map(v => v.replace('-R0.1-SNAPSHOT', ''))
                .reverse();
        }
        
        return FALLBACK_VERSIONS;
    } catch (error) {
        console.error('Failed to fetch Minecraft versions:', error.message);
        return FALLBACK_VERSIONS;
    }
}

async function getLatestSpigotVersion(minecraftVersion) {
    try {
        const url = 'https://hub.spigotmc.org/nexus/repository/public/org/spigotmc/spigot-api/maven-metadata.xml';
        const response = await fetch(url);
        const data = await response.text();
        
        // Find all versions matching this Minecraft version with any R version
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
            // Sort by R version and get the latest
            matchingVersions.sort((a, b) => {
                const [aMajor, aMinor] = a.rVersion.split('.').map(Number);
                const [bMajor, bMinor] = b.rVersion.split('.').map(Number);
                if (aMajor !== bMajor) return aMajor - bMajor;
                return aMinor - bMinor;
            });
            return matchingVersions[matchingVersions.length - 1].full;
        }
        
        // Fallback to R0.1
        return `${minecraftVersion}-R0.1-SNAPSHOT`;
    } catch (error) {
        console.error(`Failed to fetch latest R version for ${minecraftVersion}:`, error.message);
        return `${minecraftVersion}-R0.1-SNAPSHOT`;
    }
}

module.exports = {
    fetchMinecraftVersions,
    getLatestSpigotVersion,
    FALLBACK_VERSIONS
};