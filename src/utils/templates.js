function getBasicConfigTemplate() {
    return `# Basic Configuration
settings:
    debug: false
    auto-update: true

# Plugin features
features:
    feature1: true
    feature2: false

# Custom settings
custom:
    message: 'Hello, World!'
    cooldown: 60
    worlds:
        - world
        - world_nether
        - world_the_end`;
}

function getMessagesConfigTemplate() {
    return `# Messages Configuration
prefix: '&8[&bPlugin&8] &7'

messages:
    welcome: '&aWelcome to the server!'
    goodbye: '&cGoodbye!'
    error: '&cAn error has occurred!'

commands:
    no-permission: '&cYou don''t have permission to use this command!'
    player-only: '&cThis command can only be used by players!'
    invalid-args: '&cInvalid arguments! Usage: %usage%'
    cooldown: '&cPlease wait %time% seconds before using this command again!'`;
}

function getCustomConfigTemplate() {
    return `# Custom Configuration
# Add your custom configuration here

# Example:
example:
    enabled: true
    value: 42
    list:
        - item1
        - item2
        - item3

# Add more sections as needed
section:
    subsection:
        key: value`;
}

module.exports = {
    getBasicConfigTemplate,
    getMessagesConfigTemplate,
    getCustomConfigTemplate
};