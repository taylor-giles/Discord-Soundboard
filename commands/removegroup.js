const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { validateGroupPath } = require('../utils/validatePath');
require('dotenv').config();

const mp3Dir = process.env.MP3_DIRECTORY;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removegroup')
        .setDescription('Delete a group')
        .addStringOption(option => 
            option.setName("name")
                .setDescription("The name of the group to delete")
                .setRequired(true)
                .setAutocomplete(true)
        ),
    async autocomplete(interaction) {
        try {
            const soundsDirectory = path.join(mp3Dir, interaction.guild.id);
            
            if (!fs.existsSync(soundsDirectory)) {
                await interaction.respond([]);
                return;
            }

            // Get all groups (subdirectories)
            const groups = fs.readdirSync(soundsDirectory, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            const focusedValue = interaction.options.getFocused(true).value.toLowerCase();
            const filtered = groups
                .filter(group => group.toLowerCase().includes(focusedValue))
                .slice(0, 25);

            await interaction.respond(
                filtered.map(group => ({ name: group, value: group }))
            );
        } catch (error) {
            console.error("Autocomplete error:", error);
            await interaction.respond([]);
        }
    },
    async execute(interaction) {
        const groupName = interaction.options.getString("name");
        await interaction.deferReply({ephemeral: true});

        let soundsDirectory = path.join(mp3Dir, interaction.guild.id);

        // Validate the group path
        const validation = validateGroupPath(groupName, soundsDirectory);
        if (!validation.valid) {
            await interaction.editReply({content: validation.error, ephemeral: true});
            return;
        }

        let groupPath = validation.path;

        // Check if group exists
        if (!fs.existsSync(groupPath)) {
            await interaction.editReply({content: `Group \`${groupName}\` does not exist.`, ephemeral: true});
            return;
        }

        // Delete the group directory and all its contents (symlinks)
        try {
            fs.rmSync(groupPath, { recursive: true, force: true });
        } catch(err) {
            console.error("Error deleting group directory:", err);
            await interaction.editReply({content: "Failed to delete the group.", ephemeral: true});
            return;
        }

        console.log("Removed group: ", groupPath);
        await interaction.editReply({content: `Group \`${groupName}\` successfully deleted!`});
        
        //Send a message (not ephemeral) to notify the server that a group has been deleted
        await interaction.followUp(`📁 A group has been deleted: \`${groupName}\``);
    }
}
