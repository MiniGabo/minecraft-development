const SpigotGenerator = require('./generators/SpigotGenerator');
const FabricGenerator = require('./generators/FabricGenerator');
const ForgeGenerator = require('./generators/ForgeGenerator');

class ProjectGeneratorFactory {
    /**
     * Creates the appropriate generator based on project data
     * @param {Object} data 
     * @returns {BaseGenerator}
     */
    static createGenerator(data) {
        switch (data.projectType) {
            case 'fabric':
                return new FabricGenerator(data);
            case 'forge':
                return new ForgeGenerator(data);
            default:
                return new SpigotGenerator(data);
        }
    }
}

module.exports = ProjectGeneratorFactory;
