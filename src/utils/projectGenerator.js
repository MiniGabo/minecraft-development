const vscode = require('vscode');
const { getLatestSpigotVersion } = require('./minecraftUtils');

class ProjectGenerator {
    constructor(data) {
        this.data = data;
        this.isKotlin = data.language === 'kotlin';
        this.isPaper = data.apiType === 'paper';
        this.isModern = this._checkIsModern(data.minecraftVersion);
    }

    _checkIsModern(version) {
        const [major, minor] = version.split('.').map(Number);
        return major > 1 || (major === 1 && minor >= 16);
    }

    async generate(pluginDirUri, basePackagePathUri) {
        // Create project files
        await this._createPluginYml(pluginDirUri);
        
        if (this.data.buildSystem === 'maven') {
            await this._createPomXml(pluginDirUri);
        } else {
            await this._createGradleFiles(pluginDirUri);
        }

        // Create main class
        await this._createMainClass(basePackagePathUri);

        // Create base classes
        await this._createManagerClass(basePackagePathUri);
        await this._createListenerClass(basePackagePathUri);
        await this._createUtilsClass(basePackagePathUri);
    }

    async _writeFile(uri, content) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
    }

    async _createPluginYml(pluginDirUri) {
        const content = `main: ${this.data.packageName}.${this.data.projectName}
version: ${this.data.pluginVersion}
name: ${this.data.projectName}
author: ${this.data.authorName}
api-version: ${this.data.apiVersion}${this.data.dependencies ? `\ndepend: [${this.data.dependencies}]` : ''}${this.data.softDependencies ? `\nsoft-depend: [${this.data.softDependencies}]` : ''}`;

        await this._writeFile(vscode.Uri.joinPath(pluginDirUri, 'src', 'main', 'resources', 'plugin.yml'), content);
    }

    async _createMainClass(basePathUri) {
        const ext = this.isKotlin ? 'kt' : 'java';
        let content = '';

        if (this.isKotlin) {
            content = `package ${this.data.packageName}

import org.bukkit.plugin.java.JavaPlugin
import ${this.data.packageName}.managers.PluginManager
import ${this.data.packageName}.listeners.PlayerListener

class ${this.data.projectName} : JavaPlugin() {
    
    override fun onEnable() {
        // Initialize managers
        PluginManager.initialize()
        
        // Register listeners
        server.pluginManager.registerEvents(PlayerListener(), this)
        
        logger.info("${this.data.projectName} has been enabled!")
    }

    override fun onDisable() {
        logger.info("${this.data.projectName} has been disabled!")
    }
}`;
        } else {
            content = `package ${this.data.packageName};

import org.bukkit.plugin.java.JavaPlugin;
import ${this.data.packageName}.managers.PluginManager;
import ${this.data.packageName}.listeners.PlayerListener;

public class ${this.data.projectName} extends JavaPlugin {
    
    @Override
    public void onEnable() {
        
        // Initialize managers
        PluginManager.getInstance().initialize();
        
        // Register listeners
        getServer().getPluginManager().registerEvents(new PlayerListener(), this);
        
        getLogger().info("${this.data.projectName} has been enabled!");
    }

    @Override
    public void onDisable() {
        getLogger().info("${this.data.projectName} has been disabled!");
    }
    
}`;
        }

        await this._writeFile(vscode.Uri.joinPath(basePathUri, `${this.data.projectName}.${ext}`), content);
    }

    async _createPomXml(pluginDirUri) {
        const repoId = this.isPaper ? 'papermc' : 'spigot-repo';
        const repoUrl = this.isPaper ? 'https://repo.papermc.io/repository/maven-public/' : 'https://hub.spigotmc.org/nexus/content/repositories/snapshots/';
        const depGroupId = this.isPaper ? 'io.papermc.paper' : 'org.spigotmc';
        const depArtifactId = this.isPaper ? 'paper-api' : 'spigot-api';
        const depVersion = this.isPaper ? `${this.data.minecraftVersion}-R0.1-SNAPSHOT` : `${await getLatestSpigotVersion(this.data.minecraftVersion)}`;

        let lombokDependency = '';
        let lombokPlugin = '';

        if (this.data.useLombok && !this.isKotlin) {
            lombokDependency = `
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <version>1.18.34</version>
            <scope>provided</scope>
        </dependency>`;

            lombokPlugin = `
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.13.0</version>
                <configuration>
                    <source>\${maven.compiler.source}</source>
                    <target>\${maven.compiler.target}</target>
                    <annotationProcessorPaths>
                        <path>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                            <version>1.18.34</version>
                        </path>
                    </annotationProcessorPaths>
                </configuration>
            </plugin>`;
        }

        let kotlinDeps = '';
        let kotlinPlugins = '';
        if (this.isKotlin) {
            kotlinDeps = `
        <dependency>
            <groupId>org.jetbrains.kotlin</groupId>
            <artifactId>kotlin-stdlib</artifactId>
            <version>1.9.22</version>
        </dependency>`;
            kotlinPlugins = `
            <plugin>
                <groupId>org.jetbrains.kotlin</groupId>
                <artifactId>kotlin-maven-plugin</artifactId>
                <version>1.9.22</version>
                <executions>
                    <execution>
                        <id>compile</id>
                        <phase>compile</phase>
                        <goals>
                            <goal>compile</goal>
                        </goals>
                    </execution>
                </executions>
            </plugin>`;
        }

        const content = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://www.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>${this.data.packageName}</groupId>
    <artifactId>${this.data.projectName}</artifactId>
    <version>${this.data.pluginVersion}</version>
    
    <name>${this.data.projectName}</name>
    <url>${this.data.website}</url>

    <properties>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <maven.compiler.source>${this.data.javaVersion}</maven.compiler.source>
        <maven.compiler.target>${this.data.javaVersion}</maven.compiler.target>
    </properties>

    <repositories>
        <repository>
            <id>${repoId}</id>
            <url>${repoUrl}</url>
        </repository>
    </repositories>

    <dependencies>
        <dependency>
            <groupId>${depGroupId}</groupId>
            <artifactId>${depArtifactId}</artifactId>
            <version>${depVersion}</version>
            <scope>provided</scope>
        </dependency>${kotlinDeps}${lombokDependency}
    </dependencies>

    <build>
        <sourceDirectory>\${project.basedir}/src/main/${this.isKotlin ? 'kotlin' : 'java'}</sourceDirectory>
        <resources>
            <resource>
                <directory>\${project.basedir}/src/main/resources</directory>
                <includes>
                    <include>plugin.yml</include>
                </includes>
            </resource>
        </resources>
        <plugins>${kotlinPlugins}${lombokPlugin}
        </plugins>
    </build>
</project>`;

        await this._writeFile(vscode.Uri.joinPath(pluginDirUri, 'pom.xml'), content);
    }

    async _createGradleFiles(pluginDirUri) {
        const isKotlinDSL = this.data.buildSystem === 'gradle-kotlin';
        const repoUrl = this.isPaper ? 'https://repo.papermc.io/repository/maven-public/' : 'https://hub.spigotmc.org/nexus/content/repositories/snapshots/';
        const depGroupId = this.isPaper ? 'io.papermc.paper' : 'org.spigotmc';
        const depArtifactId = this.isPaper ? 'paper-api' : 'spigot-api';
        const depVersion = this.isPaper ? `${this.data.minecraftVersion}-R0.1-SNAPSHOT` : `${await getLatestSpigotVersion(this.data.minecraftVersion)}`;


        let buildGradle = '';
        if (isKotlinDSL) {
            buildGradle = `plugins {
    ${this.isKotlin ? 'kotlin("jvm") version "1.9.22"' : 'java'}
    id("com.github.johnrengelman.shadow") version "8.1.1"
}

group = "${this.data.packageName}"
version = "${this.data.pluginVersion}"

repositories {
    mavenCentral()
    maven("${repoUrl}")
}

dependencies {
    compileOnly("${depGroupId}:${depArtifactId}:${depVersion}")${this.data.useLombok && !this.isKotlin ? '\n    compileOnly("org.projectlombok:lombok:1.18.34")\n    annotationProcessor("org.projectlombok:lombok:1.18.34")' : ''}${this.isKotlin ? '\n    implementation(kotlin("stdlib"))' : ''}
}

tasks.withType<JavaCompile> {
    options.encoding = "UTF-8"
    sourceCompatibility = "${this.data.javaVersion}"
    targetCompatibility = "${this.data.javaVersion}"
}

tasks.processResources {
    val props = mapOf("version" to version)
    inputs.properties(props)
    filteringCharset = "UTF-8"
    filesMatching("plugin.yml") {
        expand(props)
    }
}
`;
        } else {
            buildGradle = `plugins {
    id 'java'
    ${this.isKotlin ? "id 'org.jetbrains.kotlin.jvm' version '1.9.22'" : ''}
    id 'com.github.johnrengelman.shadow' version '8.1.1'
}

group = '${this.data.packageName}'
version = '${this.data.pluginVersion}'

repositories {
    mavenCentral()
    maven {
        url = '${repoUrl}'
    }
}

dependencies {
    compileOnly '${depGroupId}:${depArtifactId}:${depVersion}'${this.data.useLombok && !this.isKotlin ? '\n    compileOnly "org.projectlombok:lombok:1.18.34"\n    annotationProcessor "org.projectlombok:lombok:1.18.34"' : ''}${this.isKotlin ? "\n    implementation 'org.jetbrains.kotlin:kotlin-stdlib'" : ''}
}

processResources {
    def props = [version: version]
    inputs.properties props
    filteringCharset 'UTF-8'
    filesMatching('plugin.yml') {
        expand props
    }
}

java {
    toolchain.languageVersion = JavaLanguageVersion.of(${this.data.javaVersion})
}
`;
        }

        const settingsGradle = isKotlinDSL 
            ? `rootProject.name = "${this.data.projectName}"\n`
            : `rootProject.name = '${this.data.projectName}'\n`;

        const buildFileName = isKotlinDSL ? 'build.gradle.kts' : 'build.gradle';
        const settingsFileName = isKotlinDSL ? 'settings.gradle.kts' : 'settings.gradle';

        await this._writeFile(vscode.Uri.joinPath(pluginDirUri, buildFileName), buildGradle);
        await this._writeFile(vscode.Uri.joinPath(pluginDirUri, settingsFileName), settingsGradle);
    }

    async _createManagerClass(basePathUri) {
        const ext = this.isKotlin ? 'kt' : 'java';
        let content = '';

        if (this.isKotlin) {
            content = `package ${this.data.packageName}.managers

object PluginManager {
    fun initialize() {
        // Initialize your managers here
    }
}`;
        } else if (this.data.useLombok) {
            content = `package ${this.data.packageName}.managers;

import lombok.Getter;

public class PluginManager {
    @Getter
    private static final PluginManager instance = new PluginManager();
    
    private PluginManager() {}
    
    public void initialize() {
        // Initialize your managers here
    }
}`;
        } else {
            content = `package ${this.data.packageName}.managers;

public class PluginManager {
    private static PluginManager instance;
    
    public static PluginManager getInstance() {
        if (instance == null) {
            instance = new PluginManager();
        }
        return instance;
    }
    
    public void initialize() {
        // Initialize your managers here
    }
}`;
        }

        await this._writeFile(vscode.Uri.joinPath(basePathUri, 'managers', `PluginManager.${ext}`), content);
    }

    async _createListenerClass(basePathUri) {
        const ext = this.isKotlin ? 'kt' : 'java';
        let content = '';

        if (this.isKotlin) {
            content = `package ${this.data.packageName}.listeners

import org.bukkit.event.Listener
import org.bukkit.event.EventHandler
import org.bukkit.event.player.PlayerJoinEvent

class PlayerListener : Listener {
    
    @EventHandler
    fun onPlayerJoin(event: PlayerJoinEvent) {
        // Handle player join event
    }
}`;
        } else {
            content = `package ${this.data.packageName}.listeners;

import org.bukkit.event.Listener;
import org.bukkit.event.EventHandler;
import org.bukkit.event.player.PlayerJoinEvent;

public class PlayerListener implements Listener {
    
    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        // Handle player join event
    }
}`;
        }

        await this._writeFile(vscode.Uri.joinPath(basePathUri, 'listeners', `PlayerListener.${ext}`), content);
    }

    async _createUtilsClass(basePathUri) {
        const ext = this.isKotlin ? 'kt' : 'java';
        let content = '';

        if (this.isKotlin) {
            if (this.isPaper && this.isModern) {
                content = `package ${this.data.packageName}.utils

import net.kyori.adventure.text.Component
import net.kyori.adventure.text.minimessage.MiniMessage
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer

object Utils {
    
    fun colorize(msg: String): Component {
        if (msg.contains("<") && msg.contains(">")) {
            return MiniMessage.miniMessage().deserialize(msg)
        }
        return LegacyComponentSerializer.legacyAmpersand().deserialize(msg)
    }
    
    fun legacyColorize(msg: String): String {
        return LegacyComponentSerializer.legacyAmpersand().serialize(
            LegacyComponentSerializer.legacyAmpersand().deserialize(msg)
        )
    }
}`;
            } else if (this.isModern) {
                content = `package ${this.data.packageName}.utils

import java.util.regex.Pattern
import net.md_5.bungee.api.ChatColor

object Utils {
    
    fun colorize(msg: String): String {
        var message = msg
        val match = Pattern.compile("#[a-fA-F0-9]{6}").matcher(message)
        while (match.find()) {
            val color = message.substring(match.start(), match.end())
            message = message.replace(color, ChatColor.of(color).toString())
        }
        return ChatColor.translateAlternateColorCodes('&', message)
    }
}`;
            } else {
                content = `package ${this.data.packageName}.utils

import org.bukkit.ChatColor

object Utils {
    
    fun colorize(msg: String): String {
        return ChatColor.translateAlternateColorCodes('&', msg)
    }
}`;
            }
        } else {
            // Java implementation (already defined in createPluginPanel.js)
            if (this.isPaper && this.isModern) {
                content = `package ${this.data.packageName}.utils;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;

public class Utils {
    
    public static Component colorize(String msg) {
        if (msg.contains("<") && msg.contains(">")) {
            return MiniMessage.miniMessage().deserialize(msg);
        }
        return LegacyComponentSerializer.legacyAmpersand().deserialize(msg);
    }
    
    public static String legacyColorize(String msg) {
        return LegacyComponentSerializer.legacyAmpersand().serialize(
            LegacyComponentSerializer.legacyAmpersand().deserialize(msg)
        );
    }
}`;
            } else if (this.isModern) {
                content = `package ${this.data.packageName}.utils;

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import net.md_5.bungee.api.ChatColor;

public class Utils {
    
    public static String colorize(String msg) {
        Matcher match = Pattern.compile("#[a-fA-F0-9]{6}").matcher(msg);
        while (match.find()) {
            String color = msg.substring(match.start(), match.end());
            msg = msg.replace(color, String.valueOf(ChatColor.of(color)));
            match = Pattern.compile("#[a-fA-F0-9]{6}").matcher(msg);
        }
        return ChatColor.translateAlternateColorCodes('&', msg);
    }
}`;
            } else {
                content = `package ${this.data.packageName}.utils;

import org.bukkit.ChatColor;

public class Utils {
    
    public static String colorize(String msg) {
        return ChatColor.translateAlternateColorCodes('&', msg);
    }
}`;
            }
        }

        await this._writeFile(vscode.Uri.joinPath(basePathUri, 'utils', `Utils.${ext}`), content);
    }
}

module.exports = ProjectGenerator;
