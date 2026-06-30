const vscode = require('vscode');
const BaseGenerator = require('./BaseGenerator');
const { getForgeVersionData, getForgeVersionRanges } = require('../forgeUtils');
const {
    getRecommendedGradleVersion,
    usesEventBus7,
    usesNewItemUseSignature,
    getForgeEra,
    getForgeGradlePluginVersion,
    usesPre17Names,
    getRecommendedJavaVersion,
    getPackFormat
} = require('../minecraftUtils');

const TEMPLATE_DIR_BY_ERA = {
    legacy: 'forge/legacy',
    fg4: 'forge/fg4',
    fg5: 'forge/fg5',
    fg6: 'forge/modern',
    'fg6-eventbus7': 'forge/modern'
};

class ForgeGenerator extends BaseGenerator {
    constructor(data, context) {
        super(data, context);
        this.isKotlin = data.language === 'kotlin';
        this.era = getForgeEra(data.minecraftVersion);
        this.isLegacy = this.era === 'legacy';
        this.useMixins = data.useMixins !== false;
    }

    async generate(projectDirUri, basePackagePathUri) {
        const modId = this.data.projectName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const forgeInfo = getForgeVersionData(this.data.minecraftVersion);
        const useLombok = this.data.useLombok && !this.isKotlin;
        const gradleVersion = getRecommendedGradleVersion('forge', this.data.minecraftVersion);

        const forgeVersion = this.data.forgeVersion || forgeInfo.forge;
        const ranges = getForgeVersionRanges(this.data.minecraftVersion, forgeVersion);
        const isKotlinDSL = this.data.buildSystem === 'gradle-kotlin';
        const ext = this.isKotlin ? 'kt' : 'java';

        let mixinBuildscript = "";
        let mixinPlugin = "";
        let mixinConfig = "";
        let mixinDependency = "";
		let mixinManifestAttributes = "";

		if (this.useMixins && this.isLegacy) {
			const buildExt = isKotlinDSL ? 'kotlin' : 'groovy';
			const tempVars = { modId: modId };
			mixinBuildscript = this.processTemplate(await this.readTemplate(`forge/fragments/mixin-buildscript.${buildExt}.template`), tempVars);
			mixinPlugin = this.processTemplate(await this.readTemplate(`forge/fragments/mixin-plugin.${buildExt}.template`), tempVars);
			mixinConfig = this.processTemplate(await this.readTemplate(`forge/fragments/mixin-config.${buildExt}.template`), tempVars);
			mixinDependency = this.processTemplate(await this.readTemplate(`forge/fragments/mixin-dependency.${buildExt}.template`), tempVars);
			mixinManifestAttributes = this.processTemplate(await this.readTemplate(`forge/fragments/mixin-manifest.${buildExt}.template`), tempVars);
		}

        const mappingsChannel = this.data.mappingsChannel || forgeInfo.mappingsChannel;
        const mappingsVersion = this.data.mappingsVersion || forgeInfo.mappingsVersion;

        const variables = {
            projectName: this.data.projectName,
            projectNameLower: this.data.projectName.toLowerCase(),
            packageName: this.data.packageName,
            pluginVersion: this.data.pluginVersion,
            authorName: this.data.authorName,
            description: this.data.description,
            website: this.data.website,
            minecraftVersion: this.data.minecraftVersion,
            javaVersion: this.data.javaVersion || getRecommendedJavaVersion(this.data.minecraftVersion),
            modId: modId,
            gradle_version: gradleVersion,
            forgeVersion: forgeVersion,
            forgeGradlePluginVersion: getForgeGradlePluginVersion(this.data.minecraftVersion),
            packFormat: getPackFormat(this.data.minecraftVersion),
            mappingsChannel: mappingsChannel,
            mappingsVersion: mappingsVersion,
            forgeLicense: this.data.forgeLicense,
            forgeCredits: this.data.forgeCredits,
            loaderVersionRange: ranges.loader_version_range,
            minecraftVersionRange: ranges.minecraft_version_range,
            forgeVersionRange: ranges.forge_version_range,
            mixinBuildscript: mixinBuildscript,
            mixinPlugin: mixinPlugin,
            mixinConfig: mixinConfig,
            mixinDependency: mixinDependency,
			mixinManifestAttributes: mixinManifestAttributes,
            lombokDependency: useLombok ? await this.readTemplate(isKotlinDSL ? 'forge/fragments/gradle-lombok.kotlin.template' : 'forge/fragments/gradle-lombok.groovy.template') : ""
        };

        const templateDir = TEMPLATE_DIR_BY_ERA[this.era];

        // mods.toml o mcmod.info
        if (this.isLegacy) {
            const mcmodInfo = await this.readTemplate(`${templateDir}/mcmod.info.template`);
            await this.writeFile(
                vscode.Uri.joinPath(projectDirUri, 'src', 'main', 'resources', 'mcmod.info'),
                this.processTemplate(mcmodInfo, variables)
            );
        } else {
            const modsToml = await this.readTemplate(`${templateDir}/mods.toml.template`);
            const metaDir = vscode.Uri.joinPath(projectDirUri, 'src', 'main', 'resources', 'META-INF');
            await vscode.workspace.fs.createDirectory(metaDir);
            await this.writeFile(vscode.Uri.joinPath(metaDir, 'mods.toml'), this.processTemplate(modsToml, variables));

            const packMcmeta = await this.readTemplate(`${templateDir}/pack.mcmeta.template`);
            await this.writeFile(
                vscode.Uri.joinPath(projectDirUri, 'src', 'main', 'resources', 'pack.mcmeta'),
                this.processTemplate(packMcmeta, variables)
            );
        }

        // Mixins (opcional)
        if (this.useMixins) {
            const mixinsJson = await this.readTemplate(`${templateDir}/mixins.json.template`);
            await this.writeFile(
                vscode.Uri.joinPath(projectDirUri, 'src', 'main', 'resources', modId + '.mixins.json'),
                this.processTemplate(mixinsJson, variables)
            );

            let mixinTemplateName = `ExampleMixin.${ext}.template`;
            const mixinTemplate = await this.readTemplate(`${templateDir}/${mixinTemplateName}`);
            await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(basePackagePathUri, 'mixin'));
            await this.writeFile(
                vscode.Uri.joinPath(basePackagePathUri, 'mixin', `ExampleMixin.${ext}`),
                this.processTemplate(mixinTemplate, variables)
            );
        }

        // build.gradle / build.gradle.kts
        const buildTemplateName = isKotlinDSL ? 'build.gradle.kts.template' : 'build.gradle.template';
        const buildFileName = isKotlinDSL ? 'build.gradle.kts' : 'build.gradle';
        const buildGradle = await this.readTemplate(`${templateDir}/${buildTemplateName}`);
        await this.writeFile(vscode.Uri.joinPath(projectDirUri, buildFileName), this.processTemplate(buildGradle, variables));

        await this._createGradleProperties(projectDirUri, variables);
        await this._createSettingsGradle(projectDirUri, variables);
        await this.copyGradleWrapper(projectDirUri, variables);

        // Main class
        let mainClassTemplateName = `MainClass.${ext}.template`;
        if (this.era === 'fg6-eventbus7') {
            mainClassTemplateName = `MainClass.eventbus7.${ext}.template`;
        }
        const mainClassTemplate = await this.readTemplate(`${templateDir}/${mainClassTemplateName}`);
        await this.writeFile(
            vscode.Uri.joinPath(basePackagePathUri, `${this.data.projectName}.${ext}`),
            this.processTemplate(mainClassTemplate, variables)
        );
    }

    async _createSettingsGradle(projectDirUri, variables) {
        const templateDir = TEMPLATE_DIR_BY_ERA[this.era];
        const isKotlinDSL = this.data.buildSystem === 'gradle-kotlin';
        const templateName = isKotlinDSL ? 'settings.gradle.kts.template' : 'settings.gradle.template';
        const template = await this.readTemplate(`${templateDir}/${templateName}`);
        const settingsFileName = isKotlinDSL ? 'settings.gradle.kts' : 'settings.gradle';
        await this.writeFile(vscode.Uri.joinPath(projectDirUri, settingsFileName), this.processTemplate(template, variables));
    }

    async _createGradleProperties(projectDirUri, variables) {
        const templateDir = TEMPLATE_DIR_BY_ERA[this.era];
        const template = await this.readTemplate(`${templateDir}/gradle.properties.template`);
        await this.writeFile(vscode.Uri.joinPath(projectDirUri, 'gradle.properties'), this.processTemplate(template, variables));
    }
}

module.exports = ForgeGenerator;

