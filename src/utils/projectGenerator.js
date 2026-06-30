const SpigotGenerator = require('./generators/SpigotGenerator');
const FabricGenerator = require('./generators/FabricGenerator');
const ForgeGenerator = require('./generators/ForgeGenerator');

class ProjectGeneratorFactory {
    /**
     * Creates the appropriate generator based on project data
     * @param {Object} data 
     * @param {vscode.ExtensionContext} context
     * @returns {BaseGenerator}
     */
    static createGenerator(data, context) {
        switch (data.projectType) {
            case 'fabric':
                return new FabricGenerator(data, context);
            case 'forge':
                return new ForgeGenerator(data, context);
            default:
                return new SpigotGenerator(data, context);
        }
    }
}

module.exports = ProjectGeneratorFactory;
