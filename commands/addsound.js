const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const maxFileSize = process.env.MAX_FILE_SIZE ?? 30;
const mp3Dir = process.env.MP3_DIRECTORY;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addsound')
        .setDescription('Add a new sound to the soundboard')
        .addAttachmentOption(option => 
            option.setName("mp3_file")
                .setDescription(`The MP3 file for the sound`)
                .setRequired(true)
        )
        .addStringOption(option => 
            option.setName("name")
                .setDescription("The name of the sound")
                .setRequired(true)
                .setMaxLength(50)
        )
        .addStringOption(option => 
            option.setName("folder")
                .setDescription("Optional folder to store the sound in (alphanumeric only)")
                .setRequired(false)
                .setMaxLength(20)
        ),
    async execute(interaction) {
        const file = interaction.options.getAttachment("mp3_file");
        const name = interaction.options.getString("name");
        const folder = interaction.options.getString("folder");
        await interaction.deferReply({ephemeral: true});

        // Validate folder name if provided
        if (folder) {
            if (!/^[a-zA-Z0-9]+$/.test(folder)) {
                await interaction.editReply({content: "Folder name must contain only letters and numbers.", ephemeral: true});
                return;
            }
        }

        //Make sure the file is not too large
        if(file.size > maxFileSize){
            console.log(file)
            await interaction.editReply({content: `File is too large (${(file.size/1000).toFixed(1)}KB). Please limit file to ${(maxFileSize/1000).toFixed(0)}KB.`, ephemeral: true});
            return;
        }

        //Make sure the file is an MP3
        if(file.contentType !== "audio/mpeg"){
            await interaction.editReply({content: "Unable to add this file - Only MP3 files are supported.", ephemeral: true});
            return;
        }

        // Set up the directory path
        let dirPath = path.join(mp3Dir, interaction.guild.id);
        if (folder) {
            dirPath = path.join(dirPath, folder);
        }

        //Make sure the name is not taken
        let filepath = path.join(dirPath, name + ".mp3");
        if(fs.existsSync(filepath)){
            await interaction.editReply({content: `This name (\`${name}\`) is already taken in ${folder ? `folder \`${folder}\`` : 'the root folder'}. Please choose another name.`, ephemeral: true});
            return;
        }

        //Make sure the directory exists
        if(!fs.existsSync(dirPath)){
            try {
                fs.mkdirSync(dirPath, {recursive: true});
            } catch(err) {
                console.error("Error creating directory:", err);
                await interaction.editReply({content: "Failed to create new directory for your server's soundboard.", ephemeral: true});
                return;
            }
        }

        //Download the file and save it locally
        try {
            const { default: fetch } = await import('node-fetch');
            let res = await fetch(file.url);
            if(res.ok){
                fs.writeFileSync(filepath, Buffer.from(await res.arrayBuffer()));
            } else {
                await interaction.editReply({content: "File upload failed.", ephemeral: true});
                return;
            }
        } catch(error) {
            console.error("Error downloading file: ", error);
            await interaction.editReply({content: "File upload failed.", ephemeral: true});
            return;
        }

        console.log("Added new sound: ", filepath);
        await interaction.editReply({content: `\`${name}\` successfully added. Call /sounds again to see the updated soundboard!`});
        
        //Send a message (not ephemeral) to notify the server that a sound has been added
        await interaction.channel?.send(`🔊 A new sound has been added to the soundboard: \`${name}\``);
    }
}

