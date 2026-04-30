const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

class CreatePluginPanel {
    static currentPanel = undefined;

    static createOrShow(context) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (CreatePluginPanel.currentPanel) {
            CreatePluginPanel.currentPanel.panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'createMinecraftPlugin',
            'Create Minecraft Plugin',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath, 'resources')),
                    vscode.Uri.file(path.join(context.extensionPath, 'images'))
                ],
                retainContextWhenHidden: true
            }
        );

        // Establecer el icono de la pestaña del WebView
        panel.iconPath = {
            light: vscode.Uri.file(path.join(context.extensionPath, 'images', 'icon.png')),
            dark: vscode.Uri.file(path.join(context.extensionPath, 'images', 'icon.png'))
        };

        CreatePluginPanel.currentPanel = new CreatePluginPanel(panel, context);
    }

    constructor(panel, context) {
        this.panel = panel;
        this.context = context;
        this._disposables = [];

        this._update();

        this.panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this.panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'createPlugin':
                        await this._createPlugin(message.data);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    dispose() {
        CreatePluginPanel.currentPanel = undefined;
        this.panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    async _createPlugin(data) {
        try {
            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                title: 'Select Location for Minecraft Plugin Project'
            });

            if (!uri || uri.length === 0) return;

            const projectDir = uri[0].fsPath;
            const pluginDir = path.join(projectDir, data.projectName);
            const basePackagePath = path.join(pluginDir, 'src', 'main', 'java', ...data.packageName.split('.'));

            // Crear estructura de directorios principal
            fs.mkdirSync(pluginDir, { recursive: true });
            fs.mkdirSync(basePackagePath, { recursive: true });
            fs.mkdirSync(path.join(pluginDir, 'src', 'main', 'resources'), { recursive: true });

            // Crear sub-packages
            const packages = ['managers', 'listeners', 'utils'];
            packages.forEach(pkg => {
                fs.mkdirSync(path.join(basePackagePath, pkg), { recursive: true });
            });

            // Crear archivos del proyecto
            this._createPluginYml(pluginDir, data);
            this._createMainClass(basePackagePath, data);
            this._createPomXml(pluginDir, data);

            // Crear clases base
            this._createManagerClass(basePackagePath, data);
            this._createListenerClass(basePackagePath, data);
            this._createUtilsClass(basePackagePath, data);

            vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(pluginDir));
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create plugin: ${error.message}`);
        }
    }

    _update() {
        this.panel.webview.html = this._getHtmlContent();
    }

    _getHtmlContent() {
        const htmlPath = path.join(this.context.extensionPath, 'src', 'resources', 'createPlugin.html');
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');
        return htmlContent;
    }

    _createPluginYml(pluginDir, data) {
        const content = `main: ${data.packageName}.${data.projectName}
version: ${data.pluginVersion}
name: ${data.projectName}
author: ${data.authorName}
api-version: ${data.apiVersion}${data.dependencies ? `\ndepend: [${data.dependencies}]` : ''}${data.softDependencies ? `\nsoft-depend: [${data.softDependencies}]` : ''}`;

        fs.writeFileSync(
            path.join(pluginDir, 'src', 'main', 'resources', 'plugin.yml'),
            content
        );
    }

    _createMainClass(basePath, data) {
        const content = `package ${data.packageName};

import org.bukkit.plugin.java.JavaPlugin;
import ${data.packageName}.managers.PluginManager;
import ${data.packageName}.listeners.PlayerListener;

public class ${data.projectName} extends JavaPlugin {
    
    @Override
    public void onEnable() {
        
        // Initialize managers
        PluginManager.getInstance().initialize();
        
        // Register listeners
        getServer().getPluginManager().registerEvents(new PlayerListener(), this);
        
        getLogger().info("${data.projectName} has been enabled!");
    }

    @Override
    public void onDisable() {
        getLogger().info("${data.projectName} has been disabled!");
    }
    
}`;

        fs.writeFileSync(
            path.join(basePath, `${data.projectName}.java`),
            content
        );
    }

    _createPomXml(pluginDir, data) {
        const isPaper = data.apiType === 'paper';
        const repoId = isPaper ? 'papermc' : 'spigot-repo';
        const repoUrl = isPaper ? 'https://repo.papermc.io/repository/maven-public/' : 'https://hub.spigotmc.org/nexus/content/repositories/snapshots/';
        
        const depGroupId = isPaper ? 'io.papermc.paper' : 'org.spigotmc';
        const depArtifactId = isPaper ? 'paper-api' : 'spigot-api';
        const depVersion = `${data.minecraftVersion}-R0.1-SNAPSHOT`;

        let lombokDependency = '';
        let lombokPlugin = '';

        if (data.useLombok) {
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

        const content = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://www.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>${data.packageName}</groupId>
    <artifactId>${data.projectName}</artifactId>
    <version>${data.pluginVersion}</version>
    
    <name>${data.projectName}</name>
    <url>${data.website}</url>

    <properties>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <maven.compiler.source>${data.javaVersion}</maven.compiler.source>
        <maven.compiler.target>${data.javaVersion}</maven.compiler.target>
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
        </dependency>${lombokDependency}
    </dependencies>

    <build>
        <sourceDirectory>\${project.basedir}/src/main/java</sourceDirectory>
        <resources>
            <resource>
                <directory>\${project.basedir}/src/main/resources</directory>
                <includes>
                    <include>plugin.yml</include>
                </includes>
            </resource>
        </resources>
        <plugins>${lombokPlugin}
        </plugins>
    </build>
</project>`;

        fs.writeFileSync(path.join(pluginDir, 'pom.xml'), content);
    }

    _createManagerClass(basePath, data) {
        let content;
        if (data.useLombok) {
            content = `package ${data.packageName}.managers;

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
            content = `package ${data.packageName}.managers;

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

        fs.writeFileSync(
            path.join(basePath, 'managers', 'PluginManager.java'),
            content
        );
    }

    _createListenerClass(basePath, data) {
        const content = `package ${data.packageName}.listeners;

import org.bukkit.event.Listener;
import org.bukkit.event.EventHandler;
import org.bukkit.event.player.PlayerJoinEvent;

public class PlayerListener implements Listener {
    
    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        // Handle player join event
    }
}`;

        fs.writeFileSync(
            path.join(basePath, 'listeners', 'PlayerListener.java'),
            content
        );
    }

    _createUtilsClass(basePath, data) {
        let content;
        const version = data.minecraftVersion;
        const isPaper = data.apiType === 'paper';
        
        // Convertir versión a números para comparación correcta
        const [majorVer, minorVer] = version.split('.').map(Number);
        const isModern = (majorVer > 1 || (majorVer === 1 && minorVer >= 16));

        if (isPaper && isModern) {
            content = `package ${data.packageName}.utils;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;

public class Utils {
    
    public static Component colorize(String msg) {
        // Paper recommends using MiniMessage or Adventure Components
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
        } else if (isModern) {
            content = `package ${data.packageName}.utils;

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
            content = `package ${data.packageName}.utils;

import org.bukkit.ChatColor;

public class Utils {
    
    public static String colorize(String msg) {
        return ChatColor.translateAlternateColorCodes('&', msg);
    }
}`;
        }

        fs.writeFileSync(
            path.join(basePath, 'utils', 'Utils.java'),
            content
        );
    }
}

module.exports = CreatePluginPanel;
