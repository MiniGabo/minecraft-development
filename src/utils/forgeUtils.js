const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * Gets Forge mod info from mods.toml (Modern) or mcmod.info (Legacy)
 */
function getForgeModInfo(workspacePath) {
    // Check for Modern Forge (mods.toml)
    const modsTomlPath = path.join(workspacePath, 'src', 'main', 'resources', 'META-INF', 'mods.toml');
    if (fs.existsSync(modsTomlPath)) {
        const content = fs.readFileSync(modsTomlPath, 'utf8');
        const modIdMatch = content.match(/modId\s*=\s*"(.*)"/);
        return {
            id: modIdMatch ? modIdMatch[1] : 'examplemod',
            type: 'modern',
            minecraftVersion: _resolveModernMinecraftVersion(workspacePath, content)
        };
    }

    // Check for Legacy Forge (mcmod.info)
    const mcmodInfoPath = path.join(workspacePath, 'src', 'main', 'resources', 'mcmod.info');
    if (fs.existsSync(mcmodInfoPath)) {
        try {
            const content = JSON.parse(fs.readFileSync(mcmodInfoPath, 'utf8'));
            const mod = Array.isArray(content) ? content[0] : content.modList[0];
            return {
                id: mod.modid,
                type: 'legacy'
            };
        } catch (e) {
            return null;
        }
    }

    return null;
}

function _resolveModernMinecraftVersion(workspacePath, modsTomlContent) {
    try {
        const gradlePropsPath = path.join(workspacePath, 'gradle.properties');
        if (fs.existsSync(gradlePropsPath)) {
            const props = fs.readFileSync(gradlePropsPath, 'utf8');
            const match = props.match(/minecraft_version\s*=\s*([\d.]+)/);
            if (match) return match[1];
        }
    } catch (e) {
        // Ignore
    }

    const rangeMatch = modsTomlContent.match(/modId\s*=\s*"minecraft"[\s\S]*?versionRange\s*=\s*"\[([\d.]+),/);
    return rangeMatch ? rangeMatch[1] : null;
}

/**
 * Checks if the current project is a Forge project
 */
function isForgeProject(workspacePath) {
    return fs.existsSync(path.join(workspacePath, 'src', 'main', 'resources', 'META-INF', 'mods.toml')) ||
           fs.existsSync(path.join(workspacePath, 'src', 'main', 'resources', 'mcmod.info'));
}

/**
 * Returns default versions for Forge components based on Minecraft version
 */
function getForgeVersionData(minecraftVersion) {
    const mc = minecraftVersion;
    
    let data = { 
        forge: '47.2.0', 
        mappingsChannel: 'official', 
        mappingsVersion: minecraftVersion, 
        loader: '47' 
    };

    // Legacy versions
	if (mc === '1.1') {
		data = { forge: '1.3.4.29', mappingsChannel: 'stable', mappingsVersion: '1', loader: '1' };
	} else if (mc === '1.2.3') {
		data = { forge: '1.4.1.64', mappingsChannel: 'stable', mappingsVersion: '1', loader: '1' };
	} else if (mc === '1.2.4') {
		data = { forge: '2.0.0.68', mappingsChannel: 'stable', mappingsVersion: '1', loader: '2' };
	} else if (mc === '1.2.5') {
		data = { forge: '3.4.9.171', mappingsChannel: 'stable', mappingsVersion: '1', loader: '3' };
	} else if (mc === '1.3.2') {
		data = { forge: '4.3.5.318', mappingsChannel: 'stable', mappingsVersion: '1', loader: '4' };
	} else if (mc === '1.4.0') {
		data = { forge: '5.0.0.326', mappingsChannel: 'stable', mappingsVersion: '1', loader: '5' };
	} else if (mc === '1.4.1') {
		data = { forge: '6.0.0.329', mappingsChannel: 'stable', mappingsVersion: '1', loader: '6' };
	} else if (mc === '1.4.2') {
		data = { forge: '6.0.1.355', mappingsChannel: 'stable', mappingsVersion: '1', loader: '6' };
	} else if (mc === '1.4.3') {
		data = { forge: '6.2.1.358', mappingsChannel: 'stable', mappingsVersion: '1', loader: '6' };
	} else if (mc === '1.4.4') {
		data = { forge: '6.3.0.378', mappingsChannel: 'stable', mappingsVersion: '1', loader: '6' };
	} else if (mc === '1.4.5') {
		data = { forge: '6.4.2.448', mappingsChannel: 'stable', mappingsVersion: '1', loader: '6' };
	} else if (mc === '1.4.6') {
		data = { forge: '6.5.0.489', mappingsChannel: 'stable', mappingsVersion: '1', loader: '6' };
	} else if (mc === '1.4.7') {
		data = { forge: '6.6.2.534', mappingsChannel: 'stable', mappingsVersion: '1', loader: '6' };
	} else if (mc === '1.5') {
		data = { forge: '7.7.0.598', mappingsChannel: 'stable', mappingsVersion: '1', loader: '7' };
	} else if (mc === '1.5.1') {
		data = { forge: '7.7.2.682', mappingsChannel: 'stable', mappingsVersion: '1', loader: '7' };
	} else if (mc === '1.5.2') {
		data = { forge: '7.8.1.738', mappingsChannel: 'stable', mappingsVersion: '1', loader: '7' };
	} else if (mc === '1.6.1') {
		data = { forge: '8.9.0.775', mappingsChannel: 'stable', mappingsVersion: '1', loader: '8' };
	} else if (mc === '1.6.2') {
		data = { forge: '9.10.1.871', mappingsChannel: 'stable', mappingsVersion: '1', loader: '9' };
	} else if (mc === '1.6.3') {
		data = { forge: '9.11.0.878', mappingsChannel: 'stable', mappingsVersion: '1', loader: '9' };
	} else if (mc === '1.6.4') {
		data = { forge: '9.11.1.1345', mappingsChannel: 'stable', mappingsVersion: '9', loader: '9' };
	} else if (mc === '1.7.2') {
		data = { forge: '10.12.2.1161', mappingsChannel: 'stable', mappingsVersion: '12', loader: '10' };
	} else if (mc === '1.7.10_pre4') {
		data = { forge: '10.12.2.1149-prerelease', mappingsChannel: 'stable', mappingsVersion: '12', loader: '10' };
	} else if (mc === '1.7.10') {
		data = { forge: '10.13.4.1614', mappingsChannel: 'stable', mappingsVersion: '12', loader: '10' };
	} else if (mc === '1.8') {
		data = { forge: '11.14.4.1563', mappingsChannel: 'stable', mappingsVersion: '22', loader: '11' };
	} else if (mc === '1.8.8') {
		data = { forge: '11.15.0.1655', mappingsChannel: 'stable', mappingsVersion: '22', loader: '11' };
	} else if (mc === '1.8.9') {
		data = { forge: '11.15.1.2318', mappingsChannel: 'stable', mappingsVersion: '22', loader: '11' };
	} else if (mc === '1.9') {
		data = { forge: '12.16.1.1887', mappingsChannel: 'stable', mappingsVersion: '26', loader: '12' };
	} else if (mc === '1.9.4') {
		data = { forge: '12.17.0.2317', mappingsChannel: 'stable', mappingsVersion: '26', loader: '12' };
	} else if (mc === '1.10') {
		data = { forge: '12.18.0.2000', mappingsChannel: 'stable', mappingsVersion: '32', loader: '12' };
	} else if (mc === '1.10.2') {
		data = { forge: '12.18.3.2511', mappingsChannel: 'stable', mappingsVersion: '32', loader: '12' };
	} else if (mc === '1.11') {
		data = { forge: '13.19.1.2189', mappingsChannel: 'stable', mappingsVersion: '32', loader: '13' };
	} else if (mc === '1.11.2') {
		data = { forge: '13.20.1.2588', mappingsChannel: 'stable', mappingsVersion: '32', loader: '13' };
	} else if (mc === '1.12') {
		data = { forge: '14.21.1.2387', mappingsChannel: 'stable', mappingsVersion: '39', loader: '14' };
	} else if (mc === '1.12.1') {
		data = { forge: '14.22.1.2478', mappingsChannel: 'stable', mappingsVersion: '39', loader: '14' };
	} else if (mc === '1.12.2') {
		data = { forge: '14.23.5.2847', mappingsChannel: 'stable', mappingsVersion: '39', loader: '14' };
	} else if (mc === '1.13.2') {
        data = { forge: '25.0.223', mappingsChannel: 'stable', mappingsVersion: '47-1.13.2', loader: '25' };
    } else if (mc === '1.14.2') {
        data = { forge: '26.0.63', mappingsChannel: 'stable', mappingsVersion: '58-1.14.4', loader: '26' };
    } else if (mc === '1.14.3') {
        data = { forge: '27.0.60', mappingsChannel: 'stable', mappingsVersion: '58-1.14.4', loader: '27' };
    } else if (mc === '1.14.4') {
        data = { forge: '28.2.26', mappingsChannel: 'stable', mappingsVersion: '58-1.14.4', loader: '28' };
    } else if (mc === '1.15') {
        data = { forge: '29.0.4', mappingsChannel: 'official', mappingsVersion: '1.15', loader: '29' };
    } else if (mc === '1.15.1') {
        data = { forge: '30.0.51', mappingsChannel: 'official', mappingsVersion: '1.15.1', loader: '30' };
    } else if (mc === '1.15.2') {
        data = { forge: '31.2.57', mappingsChannel: 'official', mappingsVersion: '1.15.2', loader: '31' };
    } else if (mc === '1.16.1') {
        data = { forge: '32.0.108', mappingsChannel: 'snapshot', mappingsVersion: '20200514-1.16', loader: '32' }; // ✅ confirmado
    } else if (mc === '1.16.2') {
        data = { forge: '33.0.61', mappingsChannel: 'snapshot', mappingsVersion: '20200723-1.16.2', loader: '33' }; // ⚠️ interpolado
    } else if (mc === '1.16.3') {
        data = { forge: '34.1.0', mappingsChannel: 'snapshot', mappingsVersion: '20201028-1.16.3', loader: '34' }; // ✅ confirmado
    } else if (mc === '1.16.4') {
        data = { forge: '35.1.4', mappingsChannel: 'snapshot', mappingsVersion: '20201109-1.16.4', loader: '35' }; // ⚠️ interpolado
    } else if (mc === '1.16.5') {
        data = { forge: '36.2.34', mappingsChannel: 'snapshot', mappingsVersion: '20210309-1.16.5', loader: '36' }; // ✅ confirmado de punta a punta
    }
    
    // Modern versions
    else if (mc === '1.17.1') data = { forge: '37.1.1', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '37' };
    else if (mc === '1.18') data = { forge: '38.0.17', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '38' };
    else if (mc === '1.18.1') data = { forge: '39.1.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '39' };
    else if (mc === '1.18.2') data = { forge: '40.3.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '40' };
    else if (mc === '1.19') data = { forge: '41.1.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '41' };
    else if (mc === '1.19.1') data = { forge: '42.0.9', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '42' };
    else if (mc === '1.19.2') data = { forge: '43.3.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '43' };
    else if (mc === '1.19.3') data = { forge: '44.1.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '44' };
    else if (mc === '1.19.4') data = { forge: '45.4.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '45' };
    else if (mc === '1.20') data = { forge: '46.0.14', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '46' };
    else if (mc === '1.20.1') data = { forge: '47.4.10', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '47' };
    else if (mc === '1.20.2') data = { forge: '48.1.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '48' };
    else if (mc === '1.20.3') data = { forge: '49.0.2', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '49' };
    else if (mc === '1.20.4') data = { forge: '49.2.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '49' };
    else if (mc === '1.20.6') data = { forge: '50.2.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '50' };
    else if (mc === '1.21') data = { forge: '51.0.33', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '51' };
    else if (mc === '1.21.1') data = { forge: '52.1.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '52' };
    else if (mc === '1.21.3') data = { forge: '53.1.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '53' };
    else if (mc === '1.21.4') data = { forge: '54.1.14', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '54' };
    else if (mc === '1.21.5') data = { forge: '55.1.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '55' };
    else if (mc === '1.21.6') data = { forge: '56.0.9', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '56' };
    else if (mc === '1.21.7') data = { forge: '57.0.3', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '57' };
    else if (mc === '1.21.8') data = { forge: '58.1.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '58' };
    else if (mc === '1.21.9') data = { forge: '59.0.5', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '59' };
    else if (mc === '1.21.10') data = { forge: '60.1.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '60' };
    else if (mc === '1.21.11') data = { forge: '61.1.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '61' };
    else if (mc === '26.1') data = { forge: '62.0.9', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '62' };
    else if (mc === '26.1.1') data = { forge: '63.0.2', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '63' };
    else if (mc === '26.1.2') data = { forge: '64.0.10', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '64' };
    else if (mc === '26.2') data = { forge: '65.0.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '65' };
    
    // Fallback for modern versions
    else if (mc.startsWith('1.16')) data = { forge: '36.2.34', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '36' };
    else if (mc.startsWith('1.18')) data = { forge: '40.3.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '40' };
    else if (mc.startsWith('1.19')) data = { forge: '45.4.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '45' };
    else if (mc.startsWith('1.20')) data = { forge: '49.2.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '49' };
    else if (mc.startsWith('1.21')) data = { forge: '60.1.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '60' };
    else if (mc.startsWith('26.')) data = { forge: '65.0.0', mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: '65' };
    
    // 2026+ Fallback
    else {
        const yearMatch = mc.match(/^(\d{2})\./);
        if (yearMatch && parseInt(yearMatch[1]) >= 26) {
            const major = yearMatch[1];
            data = { forge: `${parseInt(major) + 39}.0.0`, mappingsChannel: 'official', mappingsVersion: minecraftVersion, loader: `${parseInt(major) + 39}` };
        }
    }

    return data;
}

function getForgeVersionRanges(minecraftVersion, forgeVersion) {
    const mcParts = minecraftVersion.split('.');
    const mcMajor = mcParts[0];
    const mcMinor = parseInt(mcParts[1] || '0');
    
    let nextVersionRange;
    if (mcMajor === '1' && mcMinor === 21) {
        nextVersionRange = '26';
    } else {
        nextVersionRange = `${mcMajor}.${mcMinor + 1}`;
    }
    
    return {
        minecraft_version_range: `[${minecraftVersion},${nextVersionRange})`,
        forge_version_range: `[${forgeVersion.split('.')[0]},)`,
        loader_version_range: `[${forgeVersion.split('.')[0]},)`
    };
}

module.exports = {
    getForgeModInfo,
    isForgeProject,
    getForgeVersionData,
    getForgeVersionRanges
};
