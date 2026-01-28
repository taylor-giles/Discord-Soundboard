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
                .setMaxLength(20)
        ),
    async execute(interaction) {
        const name = interaction.options.getString("name");
        await interaction.deferReply({ephemeral: true});

        //Make sure the file exists
        let filepath = path.join(mp3Dir, interaction.guild.id, name + ".mp3");
        if(!fs.existsSync(filepath)){
            await interaction.editReply({content: `This sound (\`${name}\`) does not exist, and therefore cannot be removed.`, ephemeral: true});
            return;
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
        await interaction.editReply({content: `${name} successfully removed. Call /sounds again to see the updated soundboard!`, ephemeral: true});

        //Send a message (not ephemeral) to notify the server that a sound has been removed
        await interaction.followUp(`🔇 A sound has been removed from the soundboard: ${name}`);
    }
}

