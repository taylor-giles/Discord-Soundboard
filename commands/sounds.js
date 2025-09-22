const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require('discord.js');
const { createAudioPlayer, createAudioResource, joinVoiceChannel, getVoiceConnection, AudioPlayerStatus } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const { VoiceConnectionStatus } = require('@discordjs/voice');
require('dotenv').config();

const rootDirectory = process.env.MP3_DIRECTORY;
module.exports = {
    data: new SlashCommandBuilder()
        .setName('sounds')
        .setDescription('Shows the soundboard')
        .addStringOption(option => 
            option.setName("folder")
                .setDescription("Folder to show sounds from (shows all sounds if not specified)")
                .setRequired(false)
                .setMaxLength(20)
        ),
    async execute(interaction) {
        const folder = interaction.options.getString("folder");
        let soundsDirectory = path.join(rootDirectory, interaction.guild.id);

        // Validate folder if provided
        if (folder) {
            if (!/^[a-zA-Z0-9]+$/.test(folder)) {
                await interaction.reply({content: "Folder name must contain only letters and numbers.", ephemeral: true});
                return;
            }
            soundsDirectory = path.join(soundsDirectory, folder);
            if (!fs.existsSync(soundsDirectory)) {
                await interaction.reply({content: `Folder \`${folder}\` does not exist.`, ephemeral: true});
                return;
            }
        }

        // Get all MP3 files (including those in subfolders if no specific folder is selected)
        let files = [];
        if (!folder) {
            // Read files from root and all subfolders
            const getAllFiles = (dir) => {
                const dirFiles = fs.readdirSync(dir);
                dirFiles.forEach(file => {
                    const fullPath = path.join(dir, file);
                    if (fs.statSync(fullPath).isDirectory()) {
                        getAllFiles(fullPath).forEach(f => files.push(path.join(file, f)));
                    } else if (file.endsWith('.mp3')) {
                        files.push(file);
                    }
                });
            };
            getAllFiles(soundsDirectory);
        } else {
            // Read files only from the specified folder
            try {
                files = fs.readdirSync(soundsDirectory).filter(file => file.endsWith(".mp3"));
            } catch (error) {
                console.error("Error reading files:", error);
                await interaction.reply({ content: "Unable to find sound files", ephemeral: true });
                return;
            }
        }

        //Join voice channel
        let userVoiceChannel = interaction.member.voice.channel;
        if (!userVoiceChannel) {
            //If not in voice channel, send back list of sounds
            //TODO: Make this work for more than 1024 characters
            let listOfSounds = (files.length <= 0) ? "Your soundboard is empty! Get it started with /addsound." : "";
            for(let file of files){
                const soundName = path.parse(file).name;
                const index = files.indexOf(file) + 1;
                if (!folder) {
                    // If no folder specified, include folder path in the display
                    const relativePath = path.relative(soundsDirectory, path.dirname(path.join(soundsDirectory, file)));
                    if (relativePath !== '') {
                        listOfSounds += `\n${index}) ${relativePath}/${soundName}`;
                        continue;
                    }
                }
                listOfSounds += `\n${index}) ${soundName}`;
            }

            //Create embed
            let embed = new EmbedBuilder()
                .setTitle("Soundboard")
                .setDescription("Here is a list of available sounds for this server. To use them, join a voice channel and use /sounds again.")
                .addFields({name: "Sounds", value: listOfSounds});
            interaction.reply({ content: "", embeds: [embed], ephemeral: true });
            return;
        }
        let connection = joinVoiceChannel({
            channelId: userVoiceChannel.id,
            guildId: userVoiceChannel.guild.id,
            adapterCreator: userVoiceChannel.guild.voiceAdapterCreator
        });

        //Set up voice channel disconnect handler (clear the soundboard messages)
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            //TODO: Invalidate ALL replies to this interaction
            try {
                await interaction?.editReply({content: "This request has expired.", components: [], ephemeral: true});
            } catch(err){
                console.error(err);
            }
        });

        //Determine bounds
        let buttonsPerRow = 5;
        let rowsPerGrid = 5;

        //Build buttons
        let buttons = []
        for (let file of files) {
            let filepath = path.join(soundsDirectory, file);
            let label = path.parse(file).name;
            if (!folder) {
                // If no folder specified, show folder name in label for files in folders
                const relativePath = path.relative(soundsDirectory, path.dirname(filepath));
                if (relativePath !== '') {
                    label = `${relativePath}/${label}`;
                }
            }
            buttons.push(new ButtonBuilder()
                .setCustomId(`sounds-${filepath}`)
                .setLabel(label)
                .setStyle(1)
            );
        }

        //Build rows
        let rows = [];
        let buttonIndex = 0;
        while (buttonIndex < buttons.length) {
            rows.push(new ActionRowBuilder().addComponents(buttons.slice(buttonIndex, buttonIndex + buttonsPerRow)));
            buttonIndex += buttonsPerRow;
        }

        //Build grids
        let grids = [];
        let rowIndex = 0;
        while (rowIndex < rows.length) {
            grids.push(rows.slice(rowIndex, rowIndex + rowsPerGrid));
            rowIndex += rowsPerGrid;
        }

        if (rows.length <= 0) {
            await interaction.reply({ content: "Your soundboard is empty! Get it started with /addsound.", ephemeral: true });
        } else {
            await interaction.reply({ content: grids.length > 1 ? `1/${grids.length}` : "", components: grids[0], ephemeral: true });
            if (grids.length > 1) {
                for (let grid of grids.slice(1)) {
                    await interaction.followUp({ content: `${grids.indexOf(grid) + 1}/${grids.length}`, components: grid, ephemeral: true });
                }
            }
        }
    },

    async handleButtonClick(interaction) {
        let filepath = interaction.customId.split("-")?.slice(1)?.join("-");
        if (filepath && fs.existsSync(filepath)) {
            const resource = createAudioResource(filepath);
            const player = createAudioPlayer();
            player.on(AudioPlayerStatus.Playing, () => {
                console.log(`Playing ${filepath}`);
            })
            getVoiceConnection(interaction.guild.id)?.subscribe(player);
            player.play(resource);
            await interaction.reply({ content: "Now playing", ephemeral: true }).then(() => {
                //Delete the reply immediately
                interaction.deleteReply()
            });
        } else {
            await interaction.reply({ content: "Sorry, I am unable to play that sound.", ephemeral: true});
            console.error("Attempted to play nonexistent file:", filepath);
            return;
        }
    }
};
