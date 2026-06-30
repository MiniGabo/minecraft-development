const vscode = require('vscode');
const BaseGenerator = require('./BaseGenerator');
const { getLatestSpigotVersion, getLatestPaperVersion } = require('../minecraftUtils');
const { getRecommendedGradleVersion } = require('../minecraftUtils');

class SpigotGenerator extends BaseGenerator {
    constructor(data, context) {
        super(data, context);
        this.isKotlin = data.language === 'kotlin';
        this.isPaper = data.apiType === 'paper';
        this.isModern = this._checkIsModern(data.minecraftVersion);
    }

    _checkIsModern(version) {
        if (!version) return true;
        const parts = version.split('.').map(Number);
        const major = parts[0];
        const minor = parts[1] || 0;
        return major > 1 || (major === 1 && minor >= 16);
    }

    async _getDependencyInfo() {
        const isPaper = this.isPaper;
        const mcVersion = this.data.minecraftVersion;
        const isModern = this.isModern;

        let repoId, repoUrl, depGroupId, depArtifactId, depVersion;

        if (isPaper) {
            repoId = 'papermc';
            repoUrl = 'https://repo.papermc.io/repository/maven-public/';
            // For Paper 1.17+, the groupId changed
            const parts = mcVersion.split('.').map(Number);
            const isPaperModern = parts[0] > 1 || (parts[0] === 1 && parts[1] >= 17);
            
            depGroupId = isPaperModern ? 'io.papermc.paper' : 'com.destroystokyo.paper';
            depArtifactId = 'paper-api';
            depVersion = await getLatestPaperVersion(mcVersion);
        } else {
            repoId = 'spigot-repo';
            repoUrl = 'https://hub.spigotmc.org/nexus/content/repositories/snapshots/';
            depGroupId = 'org.spigotmc';
            depArtifactId = 'spigot-api';
            depVersion = await getLatestSpigotVersion(mcVersion);
        }

        return { repoId, repoUrl, depGroupId, depArtifactId, depVersion };
    }

    async generate(projectDirUri, basePackagePathUri) {
        // Create project files
        await this._createPluginYml(projectDirUri);
        
        if (this.data.buildSystem === 'maven') {
            await this._createPomXml(projectDirUri);
        } else {
            const gradleVersion = getRecommendedGradleVersion(this.data.apiType || 'spigot', this.data.minecraftVersion);
            const variables = { gradle_version: gradleVersion };

            await this._createGradleFiles(projectDirUri);
            await this._createGradleProperties(projectDirUri);
            await this.copyGradleWrapper(projectDirUri, variables);
        }

        // Create main class
        await this._createMainClass(basePackagePathUri);

        // Create base classes
        await this._createManagerClass(basePackagePathUri);
        await this._createListenerClass(basePackagePathUri);
        await this._createUtilsClass(basePackagePathUri);
    }

    async _createGradleProperties(projectDirUri) {
        const template = await this.readTemplate('spigot/gradle.properties.template');
        const content = this.processTemplate(template, {
            packageName: this.data.packageName,
            projectName: this.data.projectName,
            pluginVersion: this.data.pluginVersion,
            description: this.data.description
        });
        await this.writeFile(vscode.Uri.joinPath(projectDirUri, 'gradle.properties'), content);
    }

    async _createPluginYml(projectDirUri) {
        const template = await this.readTemplate('spigot/plugin.yml.template');
        
        const content = this.processTemplate(template, {
            packageName: this.data.packageName,
            projectName: this.data.projectName,
            pluginVersion: this.data.pluginVersion,
            authorName: this.data.authorName,
            description: this.data.description,
            apiVersion: this.data.apiVersion,
            dependencies: this.data.dependencies ? `\ndepend: [${this.data.dependencies}]` : '',
            softDependencies: this.data.softDependencies ? `\nsoft-depend: [${this.data.softDependencies}]` : ''
        });

        await this.writeFile(vscode.Uri.joinPath(projectDirUri, 'src', 'main', 'resources', 'plugin.yml'), content);
    }

    async _createMainClass(basePathUri) {
        const ext = this.isKotlin ? 'kt' : 'java';
        const templateName = `MainClass.${ext}.template`;
        const template = await this.readTemplate(`spigot/${templateName}`);
        
        const content = this.processTemplate(template, {
            packageName: this.data.packageName,
            projectName: this.data.projectName
        });

        await this.writeFile(vscode.Uri.joinPath(basePathUri, `${this.data.projectName}.${ext}`), content);
    }

    async _createPomXml(projectDirUri) {
        const template = await this.readTemplate('spigot/pom.xml.template');
        const depInfo = await this._getDependencyInfo();

        let lombokDependency = '';
        let lombokPlugin = '';

        if (this.data.useLombok && !this.isKotlin) {
            lombokDependency = (await this.readTemplate('spigot/fragments/maven-lombok-dep.xml.template')).trim();
            lombokPlugin = (await this.readTemplate('spigot/fragments/maven-lombok-plugin.xml.template')).trim();
        }

        let kotlinDeps = '';
        let kotlinPlugins = '';
        if (this.isKotlin) {
            kotlinDeps = (await this.readTemplate('spigot/fragments/maven-kotlin-dep.xml.template')).trim();
            kotlinPlugins = (await this.readTemplate('spigot/fragments/maven-kotlin-plugin.xml.template')).trim();
        }

        const content = this.processTemplate(template, {
            packageName: this.data.packageName,
            projectName: this.data.projectName,
            pluginVersion: this.data.pluginVersion,
            website: this.data.website,
            javaVersion: this.data.javaVersion,
            repoId: depInfo.repoId,
            repoUrl: depInfo.repoUrl,
            depGroupId: depInfo.depGroupId,
            depArtifactId: depInfo.depArtifactId,
            depVersion: depInfo.depVersion,
            kotlinDeps: kotlinDeps ? `        ${kotlinDeps}` : '',
            lombokDependency: lombokDependency ? `        ${lombokDependency}` : '',
            sourceDir: this.isKotlin ? 'kotlin' : 'java',
            kotlinPlugins: kotlinPlugins ? `            ${kotlinPlugins}` : '',
            lombokPlugin: lombokPlugin ? `            ${lombokPlugin}` : ''
        });

        await this.writeFile(vscode.Uri.joinPath(projectDirUri, 'pom.xml'), content);
    }

    async _createGradleFiles(projectDirUri) {
        const isKotlinDSL = this.data.buildSystem === 'gradle-kotlin';
        const ext = isKotlinDSL ? 'kts' : 'groovy';
        const templateName = isKotlinDSL ? 'build.gradle.kts.template' : 'build.gradle.template';
        const settingsTemplateName = isKotlinDSL ? 'settings.gradle.kts.template' : 'settings.gradle.template';
        
        const template = await this.readTemplate('spigot/' + templateName);
        const settingsTemplate = await this.readTemplate('spigot/' + settingsTemplateName);
        const depInfo = await this._getDependencyInfo();

        let lombokDependency = '';
        if (this.data.useLombok && !this.isKotlin) {
            lombokDependency = (await this.readTemplate(`spigot/fragments/gradle-lombok.${isKotlinDSL ? 'kts' : 'groovy'}.template`)).trim();
        }

        const kotlinPlugin = this.isKotlin ? (await this.readTemplate(`spigot/fragments/gradle-kotlin-plugin.${isKotlinDSL ? 'kts' : 'groovy'}.template`)).trim() : '';
        const kotlinStdlib = this.isKotlin ? (await this.readTemplate(`spigot/fragments/gradle-kotlin-stdlib.${isKotlinDSL ? 'kts' : 'groovy'}.template`)).trim() : '';

        const content = this.processTemplate(template, {
            packageName: this.data.packageName,
            projectName: this.data.projectName,
            pluginVersion: this.data.pluginVersion,
            repoUrl: depInfo.repoUrl,
            depGroupId: depInfo.depGroupId,
            depArtifactId: depInfo.depArtifactId,
            depVersion: depInfo.depVersion,
            lombokDependency: lombokDependency ? `${lombokDependency}` : '',
            kotlinPlugin,
            kotlinStdlib: kotlinStdlib ? `${kotlinStdlib}` : '',
            javaVersion: this.data.javaVersion
        });

        const settingsContent = this.processTemplate(settingsTemplate, {
            projectName: this.data.projectName
        });

        const buildFileName = isKotlinDSL ? 'build.gradle.kts' : 'build.gradle';
        const settingsFileName = isKotlinDSL ? 'settings.gradle.kts' : 'settings.gradle';

        await this.writeFile(vscode.Uri.joinPath(projectDirUri, buildFileName), content);
        await this.writeFile(vscode.Uri.joinPath(projectDirUri, settingsFileName), settingsContent);
    }

    async _createManagerClass(basePathUri) {
        const ext = this.isKotlin ? 'kt' : 'java';
        const template = await this.readTemplate('spigot/PluginManager.' + ext + '.template');
        
        let variables = {
            packageName: this.data.packageName
        };

        if (this.isKotlin) {
            // Kotlin implementation (already singleton in template likely)
        } else {
            if (this.data.useLombok) {
                variables.lombokImport = 'import lombok.Getter;';
                variables.instanceField = '@Getter private static final PluginManager instance = new PluginManager();';
                variables.instanceMethod = '';
            } else {
                variables.lombokImport = '';
                variables.instanceField = 'private static PluginManager instance;';
                variables.instanceMethod = `public static PluginManager getInstance() {
        if (instance == null) {
            instance = new PluginManager();
        }
        return instance;
    }`;
            }
        }

        const content = this.processTemplate(template, variables);

        await this.writeFile(vscode.Uri.joinPath(basePathUri, 'managers', `PluginManager.${ext}`), content);
    }

    async _createListenerClass(basePathUri) {
        const ext = this.isKotlin ? 'kt' : 'java';
        const template = await this.readTemplate('spigot/PlayerListener.' + ext + '.template');
        
        const content = this.processTemplate(template, {
            packageName: this.data.packageName
        });

        await this.writeFile(vscode.Uri.joinPath(basePathUri, 'listeners', `PlayerListener.${ext}`), content);
    }

    async _createUtilsClass(basePathUri) {
        const ext = this.isKotlin ? 'kt' : 'java';
        const versionDir = this.isModern ? 'modern' : 'legacy';
        
        const template = await this.readTemplate(`spigot/${versionDir}/Utils.${ext}.template`);
        
        const content = this.processTemplate(template, {
            packageName: this.data.packageName
        });

        await this.writeFile(vscode.Uri.joinPath(basePathUri, 'utils', `Utils.${ext}`), content);
    }
}

module.exports = SpigotGenerator;
