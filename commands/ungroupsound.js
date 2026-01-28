const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const mp3Dir = process.env.MP3_DIRECTORY;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ungroupsound')
        .setDescription('Remove a sound from a group')
        .addStringOption(option => 
            option.setName("sound")
                .setDescription("The sound to remove from a group")
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option => 
            option.setName("group")
                .setDescription("The group to remove the sound from")
                .setRequired(true)
                .setAutocomplete(true)
        ),
    
    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        let choices = [];

        try {
            const soundsDirectory = path.join(mp3Dir, interaction.guild.id);
            
            if (!fs.existsSync(soundsDirectory)) {
                await interaction.respond([]);
                return;
            }

            if (focusedOption.name === "sound") {
                // Get all sounds that exist in at least one group
                const groups = fs.readdirSync(soundsDirectory, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);
                
                const soundsInGroups = new Set();
                groups.forEach(group => {
                    const groupPath = path.join(soundsDirectory, group);
                    try {
                        fs.readdirSync(groupPath)
                            .filter(file => file.endsWith('.mp3'))
                            .forEach(file => soundsInGroups.add(path.parse(file).name));
                    } catch (error) {
                        // Skip if group can't be read
                    }
                });
                
                choices = Array.from(soundsInGroups)
                    .filter(sound => sound.toLowerCase().includes(focusedOption.value.toLowerCase()))
                    .slice(0, 25);
            } else if (focusedOption.name === "group") {
                // Get groups that contain the selected sound
                const soundName = interaction.options.getString("sound");
                const groups = fs.readdirSync(soundsDirectory, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);
                
                const groupsWithSound = groups.filter(group => {
                    const groupPath = path.join(soundsDirectory, group);
                    const soundPath = path.join(groupPath, soundName + '.mp3');
                    return fs.existsSync(soundPath);
                });

                choices = groupsWithSound
                    .filter(group => group.toLowerCase().includes(focusedOption.value.toLowerCase()))
                    .slice(0, 25);
            }

            await interaction.respond(
                choices.map(choice => ({ name: choice, value: choice }))
            );
        } catch (error) {
            console.error("Autocomplete error:", error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        const soundName = interaction.options.getString("sound");
        const groupName = interaction.options.getString("group");
        await interaction.deferReply({ephemeral: true});

        let soundsDirectory = path.join(mp3Dir, interaction.guild.id);
        let groupPath = path.join(soundsDirectory, groupName);
        let symlinkPath = path.join(groupPath, soundName + ".mp3");

        // Verify the group exists
        if (!fs.existsSync(groupPath)) {
            await interaction.editReply({content: `Group \`${groupName}\` does not exist.`, ephemeral: true});
            return;
        }

        // Check if symlink exists
        if (!fs.existsSync(symlinkPath)) {
            await interaction.editReply({content: `Sound \`${soundName}\` is not in group \`${groupName}\`.`, ephemeral: true});
            return;
        }

        // Remove symlink
        try {
            fs.unlinkSync(symlinkPath);
        } catch (error) {
            console.error("Error removing symlink:", error);
            await interaction.editReply({content: "Failed to remove sound from group.", ephemeral: true});
            return;
        }

        console.log("Removed sound from group: ", symlinkPath);
        await interaction.editReply({content: `\`${soundName}\` successfully removed from group \`${groupName}\`!`});
        
        // Send a message (not ephemeral) to notify the server
        await interaction.followUp(`🔗 Sound \`${soundName}\` has been removed from group \`${groupName}\``);
    }
};
