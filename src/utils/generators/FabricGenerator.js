const vscode = require('vscode');
const BaseGenerator = require('./BaseGenerator');
const { getFabricVersionData } = require('../fabricUtils');
const { getRecommendedGradleVersion } = require('../minecraftUtils');

class FabricGenerator extends BaseGenerator {
    constructor(data, context) {
        super(data, context);
        this.isKotlin = data.language === 'kotlin';
        this.useMixins = data.useMixins !== false; // Default to true if not specified
    }

    async generate(projectDirUri, basePackagePathUri) {
        const modId = this.data.projectName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const isKotlinDSL = this.data.buildSystem === 'gradle-kotlin';
        const buildExt = isKotlinDSL ? 'kts' : 'groovy';
        
        const versionData = getFabricVersionData(this.data.minecraftVersion);
        const gradleVersion = getRecommendedGradleVersion('fabric', this.data.minecraftVersion);
        const isModern = require('../fabricUtils').isModern(this.data.minecraftVersion);

        const kotlinVersion = isModern ? '2.0.21' : '1.9.22';
        const fklVersion = isModern ? '1.12.3+kotlin.2.0.21' : '1.10.18+kotlin.1.9.22';

        const variables = {
            projectName: this.data.projectName,
            projectNameLower: this.data.projectName.toLowerCase(),
            packageName: this.data.packageName,
            pluginVersion: this.data.pluginVersion,
            authorName: this.data.authorName,
            description: this.data.description,
            website: this.data.website,
            minecraftVersion: this.data.minecraftVersion,
            javaVersion: this.data.javaVersion,
            modId: modId,
            gradle_version: gradleVersion,
            kotlin_version: kotlinVersion,
            fkl_version: fklVersion,
            
            // Version data for properties
            minecraft_version: this.data.minecraftVersion,
            yarn_mappings: this.data.yarnMappings || versionData.yarn_mappings,
            loader_version: this.data.loaderVersion || versionData.loader_version,
            fabric_version: (this.data.fabricApiVersion && this.data.fabricApiVersion !== 'latest') ? this.data.fabricApiVersion : versionData.fabric_version,
            loom_version: this.data.loomVersion || versionData.loom_version,
            mod_version: this.data.pluginVersion,
            maven_group: this.data.packageName,
            mod_id: modId
        };

        // Pre-process fragments that might contain their own placeholders
        variables.kotlinPlugin = this.isKotlin ? this.processTemplate(await this.readTemplate(`fabric/fragments/gradle-kotlin-plugin.${buildExt}.template`), variables) : "";
        variables.kotlinDependency = this.isKotlin ? this.processTemplate(await this.readTemplate(`fabric/fragments/gradle-kotlin-dependency.${buildExt}.template`), variables) : '';
        variables.lombokDependency = (this.data.useLombok && !this.isKotlin) ? this.processTemplate(await this.readTemplate(`fabric/fragments/gradle-lombok.${buildExt}.template`), variables) : '';
        variables.kotlinProperties = this.isKotlin ? `kotlin_version=${kotlinVersion}` : "";
        
        variables.splitEnvironment = this.data.splitEnvironment ? this.processTemplate(await this.readTemplate(`fabric/fragments/gradle-split-env.${buildExt}.template`), variables) : "";
        
        const mixinExample = await this.readTemplate('fabric/fragments/mixin-example.json.template');
        variables.clientEntrypoint = this.data.splitEnvironment ? this.processTemplate(await this.readTemplate('fabric/fragments/client-entrypoint.json.template'), variables) : "";
        variables.clientMixinsConfig = (this.data.splitEnvironment && this.useMixins) ? this.processTemplate(await this.readTemplate('fabric/fragments/client-mixins-config.json.template'), variables) : "";
        variables.commonMixins = this.data.splitEnvironment ? "" : mixinExample;
        variables.clientMixins = this.data.splitEnvironment ? mixinExample : "";

        // Handle Split Environment directories and files
        if (this.data.splitEnvironment) {
            const sourcePath = this.isKotlin ? 'kotlin' : 'java';
            const clientSourceDirUri = vscode.Uri.joinPath(projectDirUri, 'src', 'client', sourcePath, ...this.data.packageName.split('.'), 'client');
            await vscode.workspace.fs.createDirectory(clientSourceDirUri);
            
            const clientResDirUri = vscode.Uri.joinPath(projectDirUri, 'src', 'client', 'resources');
            await vscode.workspace.fs.createDirectory(clientResDirUri);

            // Create Client Main Class
            const ext = this.isKotlin ? 'kt' : 'java';
            const clientMainTemplate = await this.readTemplate(`fabric/ClientMainClass.${ext}.template`);
            await this.writeFile(
                vscode.Uri.joinPath(clientSourceDirUri, `${this.data.projectName}Client.${ext}`),
                this.processTemplate(clientMainTemplate, variables)
            );

            // Create Client Mixins (if enabled)
            if (this.useMixins) {
                const clientMixinsTemplate = await this.readTemplate('fabric/client.mixins.json.template');
                await this.writeFile(
                    vscode.Uri.joinPath(clientResDirUri, `${modId}.client.mixins.json`),
                    this.processTemplate(clientMixinsTemplate, variables)
                );
                
                // Create client mixin package and ExampleMixin
                const clientMixinDirUri = vscode.Uri.joinPath(projectDirUri, 'src', 'client', sourcePath, ...this.data.packageName.split('.'), 'client', 'mixin');
                await vscode.workspace.fs.createDirectory(clientMixinDirUri);
                
                const mixinTemplate = await this.readTemplate(`fabric/ExampleMixin.${ext}.template`);
                // Adjust package name for client mixin
                const clientMixinVariables = { ...variables, packageName: `${this.data.packageName}.client` };
                await this.writeFile(
                    vscode.Uri.joinPath(clientMixinDirUri, `ExampleMixin.${ext}`),
                    this.processTemplate(mixinTemplate, clientMixinVariables)
                );
            }
        }

        // Create fabric.mod.json
        const fabricModJson = await this.readTemplate('fabric/fabric.mod.json.template');
        await this.writeFile(
            vscode.Uri.joinPath(projectDirUri, 'src', 'main', 'resources', 'fabric.mod.json'),
            this.processTemplate(fabricModJson, variables)
        );

        // Create mixins.json (Optional)
        if (this.useMixins) {
            const mixinsJson = await this.readTemplate('fabric/mixins.json.template');
            await this.writeFile(
                vscode.Uri.joinPath(projectDirUri, 'src', 'main', 'resources', modId + '.mixins.json'),
                this.processTemplate(mixinsJson, variables)
            );
            
            // Only create ExampleMixin in main if not split environment
            if (!this.data.splitEnvironment) {
                const ext = this.isKotlin ? 'kt' : 'java';
                const mixinTemplate = await this.readTemplate(`fabric/ExampleMixin.${ext}.template`);
                await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(basePackagePathUri, 'mixin'));
                await this.writeFile(
                    vscode.Uri.joinPath(basePackagePathUri, 'mixin', `ExampleMixin.${ext}`),
                    this.processTemplate(mixinTemplate, variables)
                );
            }
        }
        
        // Create build files
        const buildTemplateName = isKotlinDSL ? 'build.gradle.kts.template' : 'build.gradle.template';
        const buildGradle = await this.readTemplate('fabric/' + buildTemplateName);
        const buildFileName = isKotlinDSL ? 'build.gradle.kts' : 'build.gradle';
        await this.writeFile(vscode.Uri.joinPath(projectDirUri, buildFileName), this.processTemplate(buildGradle, variables));
        
        await this._createGradleProperties(projectDirUri, variables);
        await this._createSettingsGradle(projectDirUri, variables);
        await this.copyGradleWrapper(projectDirUri, variables);

        // Create main class
        const ext = this.isKotlin ? 'kt' : 'java';
        const mainClassTemplate = await this.readTemplate(`fabric/MainClass.${ext}.template`);
        await this.writeFile(
            vscode.Uri.joinPath(basePackagePathUri, `${this.data.projectName}.${ext}`),
            this.processTemplate(mainClassTemplate, variables)
        );
    }

    async _createGradleProperties(projectDirUri, variables) {
        const template = await this.readTemplate('fabric/gradle.properties.template');
        await this.writeFile(vscode.Uri.joinPath(projectDirUri, 'gradle.properties'), this.processTemplate(template, variables));
    }

    async _createSettingsGradle(projectDirUri, variables) {
        const isKotlinDSL = this.data.buildSystem === 'gradle-kotlin';
        const templateName = isKotlinDSL ? 'settings.gradle.kts.template' : 'settings.gradle.template';
        const template = await this.readTemplate('fabric/' + templateName);
        const settingsFileName = isKotlinDSL ? 'settings.gradle.kts' : 'settings.gradle';
        await this.writeFile(vscode.Uri.joinPath(projectDirUri, settingsFileName), this.processTemplate(template, variables));
    }
}

module.exports = FabricGenerator;
