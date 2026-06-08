const vscode = require('vscode');
const BaseGenerator = require('./BaseGenerator');

class FabricGenerator extends BaseGenerator {
    constructor(data) {
        super(data);
        this.isKotlin = data.language === 'kotlin';
    }

    async generate(projectDirUri, basePackagePathUri) {
        // Create fabric.mod.json
        await this._createFabricModJson(projectDirUri);
        
        // Create build files
        await this._createBuildGradle(projectDirUri);
        await this._createGradleProperties(projectDirUri);
        await this._createSettingsGradle(projectDirUri);

        // Create main class
        await this._createMainClass(basePackagePathUri);
        
        // Create mixin (optional but common)
        await this._createMixin(basePackagePathUri);
    }

    async _createFabricModJson(projectDirUri) {
        const modId = this.data.projectName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const content = {
            "schemaVersion": 1,
            "id": modId,
            "version": "${version}",
            "name": this.data.projectName,
            "description": this.data.description,
            "authors": [this.data.authorName],
            "contact": {
                "homepage": this.data.website,
                "sources": this.data.website
            },
            "license": "MIT",
            "icon": "assets/" + modId + "/icon.png",
            "environment": "*",
            "entrypoints": {
                "main": [
                    this.data.packageName + "." + this.data.projectName
                ]
            },
            "mixins": [
                modId + ".mixins.json"
            ],
            "depends": {
                "fabricloader": ">=0.15.0",
                "minecraft": "~" + this.data.minecraftVersion,
                "java": ">=" + this.data.javaVersion
            }
        };

        await this.writeFile(
            vscode.Uri.joinPath(projectDirUri, 'src', 'main', 'resources', 'fabric.mod.json'),
            JSON.stringify(content, null, 4)
        );

        // Create mixins.json
        const mixinContent = {
            "required": true,
            "package": this.data.packageName + ".mixin",
            "compatibilityLevel": "JAVA_" + this.data.javaVersion,
            "mixins": [
                "ExampleMixin"
            ],
            "injectors": {
                "defaultRequire": 1
            }
        };

        await this.writeFile(
            vscode.Uri.joinPath(projectDirUri, 'src', 'main', 'resources', modId + '.mixins.json'),
            JSON.stringify(mixinContent, null, 4)
        );
    }

    async _createBuildGradle(projectDirUri) {
        const content = `plugins {
    id 'fabric-loom' version '1.7-SNAPSHOT'
    id 'maven-publish'
    ${this.isKotlin ? "id 'org.jetbrains.kotlin.jvm' version '1.9.22'" : ''}
}

version = project.mod_version
group = project.maven_group

base {
    archivesName = project.archives_base_name
}

repositories {
    // Add repositories here
}

dependencies {
    minecraft "com.mojang:minecraft:\${project.minecraft_version}"
    mappings "net.fabricmc:yarn:\${project.yarn_mappings}:v2"
    modImplementation "net.fabricmc:fabric-loader:\${project.loader_version}"

    // Fabric API
    modImplementation "net.fabricmc.fabric-api:fabric-api:\${project.fabric_version}"
    
    ${this.isKotlin ? 'modImplementation "net.fabricmc:fabric-language-kotlin:1.10.19+kotlin.1.9.22"' : ''}
}

processResources {
    inputs.property "version", project.version
    inputs.property "minecraft_version", project.minecraft_version
    inputs.property "loader_version", project.loader_version

    filesMatching("fabric.mod.json") {
        expand "version": project.version,
                "minecraft_version": project.minecraft_version,
                "loader_version": project.loader_version
    }
}

tasks.withType(JavaCompile).configureEach {
    it.options.release = ${this.data.javaVersion}
}

java {
    withSourcesJar()

    sourceCompatibility = JavaVersion.VERSION_${this.data.javaVersion}
    targetCompatibility = JavaVersion.VERSION_${this.data.javaVersion}
}

jar {
    from("LICENSE") {
        rename { "\${it}_\${project.base.archivesName.get()}"}
    }
}
`;
        await this.writeFile(vscode.Uri.joinPath(projectDirUri, 'build.gradle'), content);
    }

    async _createGradleProperties(projectDirUri) {
        const content = `org.gradle.jvmargs=-Xmx2G
org.gradle.parallel=true

# Mod properties
mod_version = ${this.data.pluginVersion}
maven_group = ${this.data.packageName}
archives_base_name = ${this.data.projectName.toLowerCase()}

# Dependencies
minecraft_version = ${this.data.minecraftVersion}
yarn_mappings = ${this.data.minecraftVersion}+build.1
loader_version = 0.15.11

# Fabric API version
fabric_version = 0.92.0+1.20.1
`;
        await this.writeFile(vscode.Uri.joinPath(projectDirUri, 'gradle.properties'), content);
    }

    async _createSettingsGradle(projectDirUri) {
        const content = `pluginManagement {
    repositories {
        maven { url "https://maven.fabricmc.net/" }
        mavenCentral()
        gradlePluginPortal()
    }
}

rootProject.name = '${this.data.projectName}'
`;
        await this.writeFile(vscode.Uri.joinPath(projectDirUri, 'settings.gradle'), content);
    }

    async _createMainClass(basePathUri) {
        const ext = this.isKotlin ? 'kt' : 'java';
        let content = '';

        if (this.isKotlin) {
            content = `package ${this.data.packageName}

import net.fabricmc.api.ModInitializer
import org.slf4j.LoggerFactory

object ${this.data.projectName} : ModInitializer {
    private val logger = LoggerFactory.getLogger("${this.data.projectName.toLowerCase()}")

	override fun onInitialize() {
		logger.info("Hello Fabric world from ${this.data.projectName}!")
	}
}`;
        } else {
            content = `package ${this.data.packageName};

import net.fabricmc.api.ModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ${this.data.projectName} implements ModInitializer {
	public static final Logger LOGGER = LoggerFactory.getLogger("${this.data.projectName.toLowerCase()}");

	@Override
	public void onInitialize() {
		LOGGER.info("Hello Fabric world from ${this.data.projectName}!");
	}
}`;
        }

        await this.writeFile(vscode.Uri.joinPath(basePathUri, `${this.data.projectName}.${ext}`), content);
    }

    async _createMixin(basePathUri) {
        const ext = this.isKotlin ? 'kt' : 'java';
        const mixinPath = vscode.Uri.joinPath(basePathUri, 'mixin', `ExampleMixin.${ext}`);
        
        let content = '';
        if (this.isKotlin) {
            content = `package ${this.data.packageName}.mixin

import net.minecraft.client.gui.screen.TitleScreen
import org.spongepowered.asm.mixin.Mixin
import org.spongepowered.asm.mixin.injection.At
import org.spongepowered.asm.mixin.injection.Inject
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo

@Mixin(TitleScreen::class)
class ExampleMixin {
	@Inject(at = [At("HEAD")], method = ["init()V"])
	private fun init(info: CallbackInfo) {
		println("This line is printed by an example mod mixin!")
	}
}`;
        } else {
            content = `package ${this.data.packageName}.mixin;

import net.minecraft.client.gui.screen.TitleScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(TitleScreen.class)
public class ExampleMixin {
	@Inject(at = @At("HEAD"), method = "init()V")
	private void init(CallbackInfo info) {
		System.out.println("This line is printed by an example mod mixin!");
	}
}`;
        }
        await this.writeFile(mixinPath, content);
    }
}

module.exports = FabricGenerator;
