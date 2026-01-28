const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stopsounds')
        .setDescription('Stop all sounds'),
    async execute(interaction) {
        let connection = getVoiceConnection(interaction.guild.id);
        if(!connection){
            await interaction.reply({content: "The soundboard is not currently active. There is nothing to stop!", ephemeral: true});
        } else {
            connection.disconnect();
            await interaction.reply("🤫 Soundboard session ended.");
        }
    }
}

