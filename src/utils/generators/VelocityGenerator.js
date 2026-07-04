const vscode = require('vscode');
const BaseGenerator = require('./BaseGenerator');
const { getLatestVelocityVersion, getRecommendedGradleVersion } = require('../minecraftUtils');

class VelocityGenerator extends BaseGenerator {
    constructor(data, context) {
        super(data, context);
        this.isKotlin = data.language === 'kotlin';
    }

    async _getDependencyInfo() {
        return {
            repoId: 'papermc',
            repoUrl: 'https://repo.papermc.io/repository/maven-public/',
            depGroupId: 'com.velocitypowered',
            depArtifactId: 'velocity-api',
            depVersion: await getLatestVelocityVersion(this.data.minecraftVersion)
        };
    }

    _parseDependencies() {
        const dependencies = this.data.dependencies || '';
        const softDependencies = this.data.softDependencies || '';

        const requiredDeps = dependencies ? dependencies.split(',').map(d => d.trim()).filter(d => d) : [];
        const optionalDeps = softDependencies ? softDependencies.split(',').map(d => d.trim()).filter(d => d) : [];

        return { requiredDeps, optionalDeps };
    }

    _getDependencyAnnotations() {
        const { requiredDeps, optionalDeps } = this._parseDependencies();
        if (requiredDeps.length === 0 && optionalDeps.length === 0) return { imports: '', annotations: '' };

        const annotations = [];
        const prefix = this.isKotlin ? '' : '@';

        for (const dep of requiredDeps) {
            annotations.push(`${prefix}Dependency(id = "${dep.toLowerCase()}")`);
        }

        for (const dep of optionalDeps) {
            annotations.push(`${prefix}Dependency(id = "${dep.toLowerCase()}", optional = true)`);
        }

        return {
            imports: 'import com.velocitypowered.api.plugin.Dependency;',
            annotations: annotations.join(', ')
        };
    }

    async generate(projectDirUri, basePackagePathUri) {
        if (this.data.buildSystem === 'maven') {
            await this._createPomXml(projectDirUri);
        } else {
            const gradleVersion = getRecommendedGradleVersion('velocity', this.data.minecraftVersion);
            await this._createGradleFiles(projectDirUri);
            await this._createGradleProperties(projectDirUri);
            await this.copyGradleWrapper(projectDirUri, { gradle_version: gradleVersion });
        }

        await this._createMainClass(basePackagePathUri);
        await this._createManagerClass(basePackagePathUri);
        await this._createListenerClass(basePackagePathUri);
    }

    async _createMainClass(basePathUri) {
        const ext = this.isKotlin ? 'kt' : 'java';
        const template = await this.readTemplate(`velocity/MainClass.${ext}.template`);
        const depVars = this._getDependencyAnnotations();

        const content = this.processTemplate(template, {
            packageName: this.data.packageName,
            projectName: this.data.projectName,
            pluginId: this.data.projectName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            pluginVersion: this.data.pluginVersion,
            authorName: this.data.authorName,
            description: this.data.description || '',
            website: this.data.website || '',
            dependencyImports: depVars.imports,
            dependencyAnnotations: depVars.annotations
        });

        await this.writeFile(vscode.Uri.joinPath(basePathUri, `${this.data.projectName}.${ext}`), content);
    }

    async _createPomXml(projectDirUri) {
        const template = await this.readTemplate('velocity/pom.xml.template');
        const depInfo = await this._getDependencyInfo();

        let lombokDependency = '';
        let lombokAnnotationProcessor = '';

        if (this.data.useLombok && !this.isKotlin) {
            lombokDependency = (await this.readTemplate('spigot/fragments/maven-lombok-dep.xml.template')).trim();
            lombokAnnotationProcessor = await this.readTemplate('velocity/fragments/maven-lombok-processor.xml.template');
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
            lombokAnnotationProcessor: lombokAnnotationProcessor ? `${lombokAnnotationProcessor}` : ''
        });

        await this.writeFile(vscode.Uri.joinPath(projectDirUri, 'pom.xml'), content);
    }

    async _createGradleFiles(projectDirUri) {
        const isKotlinDSL = this.data.buildSystem === 'gradle-kotlin';
        const ext = isKotlinDSL ? 'kts' : 'groovy';
        const templateSuffix = isKotlinDSL ? '.kts' : '';

        const template = await this.readTemplate(`velocity/build.gradle${templateSuffix}.template`);
        const settingsTemplate = await this.readTemplate(`velocity/settings.gradle${templateSuffix}.template`);
        const depInfo = await this._getDependencyInfo();

        let lombokDependency = '';
        if (this.data.useLombok && !this.isKotlin) {
            lombokDependency = (await this.readTemplate(`spigot/fragments/gradle-lombok.${ext}.template`)).trim();
        }

        const kotlinPlugin = this.isKotlin ? (await this.readTemplate(`spigot/fragments/gradle-kotlin-plugin.${ext}.template`)).trim() : '';
        const kotlinStdlib = this.isKotlin ? (await this.readTemplate(`spigot/fragments/gradle-kotlin-stdlib.${ext}.template`)).trim() : '';

        const content = this.processTemplate(template, {
            packageName: this.data.packageName,
            projectName: this.data.projectName,
            pluginVersion: this.data.pluginVersion,
            repoUrl: depInfo.repoUrl,
            depGroupId: depInfo.depGroupId,
            depArtifactId: depInfo.depArtifactId,
            depVersion: depInfo.depVersion,
            lombokDependency: lombokDependency || '',
            kotlinPlugin,
            kotlinStdlib: kotlinStdlib || '',
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

    async _createGradleProperties(projectDirUri) {
        const template = await this.readTemplate('velocity/gradle.properties.template');
        const content = this.processTemplate(template, {
            packageName: this.data.packageName,
            projectName: this.data.projectName,
            pluginVersion: this.data.pluginVersion,
            description: this.data.description
        });
        await this.writeFile(vscode.Uri.joinPath(projectDirUri, 'gradle.properties'), content);
    }

    async _createManagerClass(basePathUri) {
        const ext = this.isKotlin ? 'kt' : 'java';
        const template = await this.readTemplate(`velocity/PluginManager.${ext}.template`);

        const variables = { packageName: this.data.packageName };

        if (!this.isKotlin) {
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
        const template = await this.readTemplate(`velocity/PlayerListener.${ext}.template`);
        const content = this.processTemplate(template, { packageName: this.data.packageName });
        await this.writeFile(vscode.Uri.joinPath(basePathUri, 'listeners', `PlayerListener.${ext}`), content);
    }
}

module.exports = VelocityGenerator;
