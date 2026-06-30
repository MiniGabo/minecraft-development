const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { isFabricProject } = require('../utils/fabricUtils');
const { isForgeProject, getForgeModInfo } = require('../utils/forgeUtils');

async function setupDebugger(context) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const vscodeDir = path.join(workspacePath, '.vscode');
    
    if (!fs.existsSync(vscodeDir)) {
        fs.mkdirSync(vscodeDir);
    }

    const launchJsonPath = path.join(vscodeDir, 'launch.json');
    const tasksJsonPath = path.join(vscodeDir, 'tasks.json');

    let launchConfig = { version: "0.2.0", configurations: [] };
    let tasksConfig = { version: "2.0.0", tasks: [] };

    const isFabric = isFabricProject(workspacePath);
    const isForge = isForgeProject(workspacePath);

    if (isFabric) {
        launchConfig.configurations.push({
            type: "java",
            name: "Minecraft Client (Fabric)",
            request: "launch",
            mainClass: "net.fabricmc.devlaunchinjector.Main",
            vmArgs: "-Dfabric.dli.config=.gradle/loom-cache/launch.cfg -Dfabric.dli.env=client -Dfabric.dli.main=net.fabricmc.loader.impl.launch.knot.KnotClient",
            projectName: path.basename(workspacePath),
            cwd: "${workspaceFolder}/run"
        });
    } else if (isForge) {
        const modInfo = getForgeModInfo(workspacePath);
        const isLegacy = modInfo.type === 'legacy';
        
        if (isLegacy) {
            launchConfig.configurations.push({
                type: "java",
                name: "Minecraft Client (Legacy Forge)",
                request: "launch",
                mainClass: "net.minecraft.launchwrapper.Launch",
                args: `--version 1.8 --tweakClass net.minecraftforge.fml.common.launcher.FMLTweaker --accessToken 0 --assetsDir \${userHome}/.gradle/caches/minecraft/assets --assetIndex 1.8`,
                projectName: path.basename(workspacePath),
                cwd: "${workspaceFolder}/run"
            });
        } else {
            launchConfig.configurations.push({
                type: "java",
                name: "Minecraft Client (Forge)",
                request: "launch",
                mainClass: "net.minecraftforge.bootstrap.ForgeBootstrap",
                projectName: path.basename(workspacePath),
                cwd: "${workspaceFolder}/run",
                vmArgs: "-Dforge.logging.markers=registries -Dforge.logging.console.level=debug"
            });
        }
    } else {
        // Spigot
        launchConfig.configurations.push({
            type: "java",
            name: "Run Plugin Build",
            request: "launch",
            mainClass: "",
            preLaunchTask: "Build Plugin"
        });

        const isMaven = fs.existsSync(path.join(workspacePath, 'pom.xml'));
        tasksConfig.tasks.push({
            label: "Build Plugin",
            type: "shell",
            command: isMaven ? "mvn clean package" : "./gradlew build",
            group: {
                kind: "build",
                isDefault: true
            }
        });
    }

    // Common tasks
    if (isFabric || isForge) {
        tasksConfig.tasks.push({
            label: "Gradle Build",
            type: "shell",
            command: "./gradlew build",
            group: "build"
        });
    }

    fs.writeFileSync(launchJsonPath, JSON.stringify(launchConfig, null, 4));
    fs.writeFileSync(tasksJsonPath, JSON.stringify(tasksConfig, null, 4));

    vscode.window.showInformationMessage('Debugger configurations generated! Check .vscode/launch.json');
}

module.exports = {
    setupDebugger
};
