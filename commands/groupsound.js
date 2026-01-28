const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const mp3Dir = process.env.MP3_DIRECTORY;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('groupsound')
        .setDescription('Add a sound to a group')
        .addStringOption(option => 
            option.setName("sound")
                .setDescription("The sound to add to a group")
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option => 
            option.setName("group")
                .setDescription("The group to add the sound to")
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
                // Get all sounds (mp3 files in root directory)
                const sounds = fs.readdirSync(soundsDirectory)
                    .filter(file => {
                        const fullPath = path.join(soundsDirectory, file);
                        return fs.statSync(fullPath).isFile() && file.endsWith('.mp3');
                    })
                    .map(file => path.parse(file).name);
                
                choices = sounds
                    .filter(sound => sound.toLowerCase().includes(focusedOption.value.toLowerCase()))
                    .slice(0, 25);
            } else if (focusedOption.name === "group") {
                // Get the sound name to find which groups it's not in
                const soundName = interaction.options.getString("sound");
                
                // Get all groups
                const groups = fs.readdirSync(soundsDirectory, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);
                
                // Filter to only groups that don't already contain this sound
                const availableGroups = groups.filter(group => {
                    const groupPath = path.join(soundsDirectory, group);
                    const soundPath = path.join(groupPath, soundName + '.mp3');
                    return !fs.existsSync(soundPath);
                });

                choices = availableGroups
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
        let soundPath = path.join(soundsDirectory, soundName + ".mp3");
        let groupPath = path.join(soundsDirectory, groupName);
        let symlinkPath = path.join(groupPath, soundName + ".mp3");

        // Verify the sound exists
        if (!fs.existsSync(soundPath)) {
            await interaction.editReply({content: `Sound \`${soundName}\` does not exist.`, ephemeral: true});
            return;
        }

        // Verify the group exists
        if (!fs.existsSync(groupPath)) {
            await interaction.editReply({content: `Group \`${groupName}\` does not exist.`, ephemeral: true});
            return;
        }

        // Check if symlink already exists
        if (fs.existsSync(symlinkPath)) {
            await interaction.editReply({content: `Sound \`${soundName}\` is already in group \`${groupName}\`.`, ephemeral: true});
            return;
        }

        // Create symlink
        try {
            const relativePath = path.relative(groupPath, soundPath);
            fs.symlinkSync(relativePath, symlinkPath);
        } catch (error) {
            console.error("Error creating symlink:", error);
            await interaction.editReply({content: "Failed to add sound to group.", ephemeral: true});
            return;
        }

        console.log("Added sound to group: ", symlinkPath);
        await interaction.editReply({content: `\`${soundName}\` successfully added to group \`${groupName}\`!`});
        
        // Send a message (not ephemeral) to notify the server
        await interaction.channel?.send(`🔗 Sound \`${soundName}\` has been added to group \`${groupName}\``);
    }
};
