const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const mp3Dir = process.env.MP3_DIRECTORY;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removesound')
        .setDescription('Remove a sound from the soundboard')
        .addStringOption(option => 
            option.setName("name")
                .setDescription("The name of the sound to remove")
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

            // Get all sounds (mp3 files in root directory)
            const sounds = fs.readdirSync(soundsDirectory)
                .filter(file => {
                    const fullPath = path.join(soundsDirectory, file);
                    return fs.statSync(fullPath).isFile() && file.endsWith('.mp3');
                })
                .map(file => path.parse(file).name);
            
            const focusedValue = interaction.options.getFocused(true).value.toLowerCase();
            const filtered = sounds
                .filter(sound => sound.toLowerCase().includes(focusedValue))
                .slice(0, 25);

            await interaction.respond(
                filtered.map(sound => ({ name: sound, value: sound }))
            );
        } catch (error) {
            console.error("Autocomplete error:", error);
            await interaction.respond([]);
        }
    },
    async execute(interaction) {
        const name = interaction.options.getString("name");
        await interaction.deferReply({ephemeral: true});

        //Make sure the file exists
        let filepath = path.join(mp3Dir, interaction.guild.id, name + ".mp3");
        if(!fs.existsSync(filepath)){
            await interaction.editReply({content: `This sound (\`${name}\`) does not exist, and therefore cannot be removed.`, ephemeral: true});
            return;
        }

        // Before deleting the sound, remove all symlinks to it from groups
        try {
            const soundsDirectory = path.join(mp3Dir, interaction.guild.id);
            const groups = fs.readdirSync(soundsDirectory, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            // Remove symlinks from all groups
            for (const group of groups) {
                const symlinkPath = path.join(soundsDirectory, group, name + ".mp3");
                if (fs.existsSync(symlinkPath)) {
                    try {
                        fs.unlinkSync(symlinkPath);
                        console.log("Removed symlink from group:", symlinkPath);
                    } catch (error) {
                        console.error("Error removing symlink from group:", error);
                    }
                }
            }
        } catch (error) {
            console.error("Error processing groups for symlink removal:", error);
            // Continue with sound deletion even if symlink removal fails
        }

        //Delete the file
        try {
            fs.unlinkSync(filepath);
        } catch(error) {
            console.error("Error deleting file: ", error);
            await interaction.editReply({content: "File deletion failed.", ephemeral: true});
            return;
        }

        console.log("Removed sound: ", filepath);
        await interaction.editReply({content: `\`${name}\` successfully removed. Call /sounds again to see the updated soundboard!`, ephemeral: true});

        //Send a message (not ephemeral) to notify the server that a sound has been removed
        await interaction.followUp(`🔇 A sound has been removed from the soundboard: \`${name}\``);
    }
}

