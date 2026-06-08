const vscode = require('vscode');
const BaseGenerator = require('./BaseGenerator');

class ForgeGenerator extends BaseGenerator {
    constructor(data) {
        super(data);
        this.isKotlin = data.language === 'kotlin';
        this.isLegacy = this._isLegacyVersion(data.minecraftVersion);
    }

    _isLegacyVersion(version) {
        if (!version) return false;
        const minor = parseInt(version.split('.')[1]);
        return minor <= 12; // 1.12.2 and below is considered "legacy" Forge
    }

    async generate(projectDirUri, basePackagePathUri) {
        // Create mods.toml (Modern) or mcmod.info (Legacy)
        if (this.isLegacy) {
            await this._createMcModInfo(projectDirUri);
        } else {
            await this._createModsToml(projectDirUri);
        }
        
        // Create build files
        await this._createBuildGradle(projectDirUri);
        await this._createGradleProperties(projectDirUri);

        // Create main class
        await this._createMainClass(basePackagePathUri);
    }

    async _createModsToml(projectDirUri) {
        const modId = this.data.projectName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const content = `modLoader="javafml"
loaderVersion="[${this._getLoaderVersion()}]"
license="${this.data.forgeLicense}"

[[mods]]
modId="${modId}"
version="\${file.jarVersion}"
displayName="${this.data.projectName}"
authors="${this.data.authorName}"
description='''
${this.data.description}
'''
`;
        const metaDir = vscode.Uri.joinPath(projectDirUri, 'src', 'main', 'resources', 'META-INF');
        await vscode.workspace.fs.createDirectory(metaDir);
        await this.writeFile(vscode.Uri.joinPath(metaDir, 'mods.toml'), content);
    }

    async _createMcModInfo(projectDirUri) {
        const modId = this.data.projectName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const content = [{
            "modid": modId,
            "name": this.data.projectName,
            "description": this.data.description,
            "version": "${version}",
            "mcversion": "${mcversion}",
            "url": this.data.website,
            "updateUrl": "",
            "authorList": [this.data.authorName],
            "credits": this.data.forgeCredits,
            "logoFile": "",
            "screenshots": [],
            "dependencies": []
        }];

        await this.writeFile(
            vscode.Uri.joinPath(projectDirUri, 'src', 'main', 'resources', 'mcmod.info'),
            JSON.stringify(content, null, 4)
        );
    }

    async _createBuildGradle(projectDirUri) {
        let content = '';
        if (this.isLegacy) {
            // Very simplified 1.8.9 / 1.12.2 build.gradle
            content = `buildscript {
    repositories {
        maven { url = 'https://maven.minecraftforge.net/' }
        mavenCentral()
    }
    dependencies {
        classpath group: 'net.minecraftforge.gradle', name: 'ForgeGradle', version: '2.1-SNAPSHOT'
    }
}
apply plugin: 'net.minecraftforge.gradle.forge'

version = "1.0"
group = "${this.data.packageName}"
archivesBaseName = "${this.data.projectName.toLowerCase()}"

minecraft {
    version = "${this.data.minecraftVersion}-11.15.1.2318"
    runDir = "run"
    mappings = "snapshot_20160518"
}

processResources {
    inputs.property "version", project.version
    inputs.property "mcversion", project.minecraft.version

    from(sourceSets.main.resources.srcDirs) {
        include 'mcmod.info'
        expand 'version':project.version, 'mcversion':project.minecraft.version
    }
}
`;
        } else {
            // Modern Forge (1.20+)
            content = `plugins {
    id 'eclipse'
    id 'idea'
    id 'maven-publish'
    id 'net.minecraftforge.gradle' version '[6.0, 6.2)'
}

version = '1.0'
group = '${this.data.packageName}'
base {
    archivesName = '${this.data.projectName.toLowerCase()}'
}

java.toolchain.languageVersion = JavaLanguageVersion.of(${this.data.javaVersion})

minecraft {
    mappings channel: 'official', version: '${this.data.minecraftVersion}'
    copyIdeResources = true
    runs {
        client {
            workingDirectory project.file('run')
            property 'forge.logging.markers', 'registe_events'
            property 'forge.logging.console.level', 'debug'
            mods {
                \${project.name} {
                    source sourceSets.main
                }
            }
        }
    }
}

dependencies {
    minecraft 'net.minecraftforge:forge:${this.data.minecraftVersion}-47.2.0'
}

tasks.named('processResources', ProcessResources).configure {
    var replaceProperties = [
        minecraft_version: minecraft_version, minecraft_version_range: minecraft_version_range,
        forge_version: forge_version, forge_version_range: forge_version_range,
        loader_version_range: loader_version_range,
        mod_id: mod_id, mod_name: mod_name, mod_license: mod_license, mod_version: mod_version,
        mod_authors: mod_authors, mod_description: mod_description,
    ]
    inputs.properties replaceProperties

    filesMatching(['META-INF/mods.toml', 'pack.mcmeta']) {
        expand replaceProperties
    }
}
`;
        }
        await this.writeFile(vscode.Uri.joinPath(projectDirUri, 'build.gradle'), content);
    }

    async _createGradleProperties(projectDirUri) {
        const content = `org.gradle.jvmargs=-Xmx2G
mod_id=${this.data.projectName.toLowerCase().replace(/[^a-z0-9]/g, '_')}
mod_name=${this.data.projectName}
mod_license=${this.data.forgeLicense}
mod_version=${this.data.pluginVersion}
mod_authors=${this.data.authorName}
mod_description=${this.data.description}
mod_credits=${this.data.forgeCredits}

minecraft_version=${this.data.minecraftVersion}
minecraft_version_range=[1.20,1.21)
forge_version=47.2.0
forge_version_range=[47,)
loader_version_range=[47,)
`;
        await this.writeFile(vscode.Uri.joinPath(projectDirUri, 'gradle.properties'), content);
    }

    async _createMainClass(basePathUri) {
        const modId = this.data.projectName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const ext = this.isKotlin ? 'kt' : 'java';
        let content = '';

        if (this.isLegacy) {
            content = `package ${this.data.packageName};

import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.common.event.FMLInitializationEvent;

@Mod(modid = "${modId}", name = "${this.data.projectName}", version = "1.0")
public class ${this.data.projectName} {
    @Mod.EventHandler
    public void init(FMLInitializationEvent event) {
        System.out.println("Hello from Legacy Forge!");
    }
}`;
        } else {
            content = `package ${this.data.packageName};

import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.event.lifecycle.FMLCommonSetupEvent;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

@Mod("${modId}")
public class ${this.data.projectName} {
    private static final Logger LOGGER = LogManager.getLogger();

    public ${this.data.projectName}() {
        FMLJavaModLoadingContext.get().getModEventBus().addListener(this::setup);
        MinecraftForge.EVENT_BUS.register(this);
    }

    private void setup(final FMLCommonSetupEvent event) {
        LOGGER.info("Hello from Modern Forge!");
    }
}`;
        }

        await this.writeFile(vscode.Uri.joinPath(basePathUri, `${this.data.projectName}.${ext}`), content);
    }

    _getLoaderVersion() {
        return "47"; // Default for 1.20.1
    }
}

module.exports = ForgeGenerator;
