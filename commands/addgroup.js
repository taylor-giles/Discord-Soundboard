const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { validateGroupPath } = require('../utils/validatePath');
require('dotenv').config();

const mp3Dir = process.env.MP3_DIRECTORY;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addgroup')
        .setDescription('Create a new group for organizing sounds')
        .addStringOption(option => 
            option.setName("name")
                .setDescription("The name of the group")
                .setRequired(true)
                .setMaxLength(50)
        ),
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

        // Check if group already exists
        if (fs.existsSync(groupPath)) {
            await interaction.editReply({content: `This group (\`${groupName}\`) already exists.`, ephemeral: true});
            return;
        }

        // Create the group directory
        try {
            fs.mkdirSync(groupPath, {recursive: true});
        } catch(err) {
            console.error("Error creating group directory:", err);
            await interaction.editReply({content: "Failed to create the group.", ephemeral: true});
            return;
        }

        console.log("Added new group: ", groupPath);
        await interaction.editReply({content: `Group \`${groupName}\` successfully created!`});
        
        //Send a message (not ephemeral) to notify the server that a group has been added
        await interaction.followUp(`📁 A new group has been created: \`${groupName}\``);
    }
}
