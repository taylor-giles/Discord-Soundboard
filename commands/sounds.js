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
                await interaction.reply({ content: "Folder name must contain only letters and numbers.", ephemeral: true });
                return;
            }
            if (!fs.existsSync(path.join(soundsDirectory, folder))) {
                await interaction.reply({ content: `Folder \`${folder}\` does not exist.`, ephemeral: true });
                return;
            }
        }

        // Get all MP3 files (including those in subfolders if no specific folder is selected)
        let filesByFolder = new Map(); // Map<string, string[]> where key is folder path (or '' for root) and value is array of filenames
        
        if (!folder) {
            // First get files in root
            try {
                const rootFiles = fs.readdirSync(soundsDirectory)
                    .filter(file => file.endsWith('.mp3'));
                if (rootFiles.length > 0) {
                    filesByFolder.set('', rootFiles);
                }

                // Then get files in each subfolder
                fs.readdirSync(soundsDirectory, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .forEach(dir => {
                        const folderPath = dir.name;
                        const folderFiles = fs.readdirSync(path.join(soundsDirectory, folderPath))
                            .filter(file => file.endsWith('.mp3'));
                        if (folderFiles.length > 0) {
                            filesByFolder.set(folderPath, folderFiles);
                        }
                    });
            } catch (error) {
                console.error("Error reading files:", error);
                await interaction.reply({ content: "Unable to read sound files", ephemeral: true });
                return;
            }
        } else {
            // Read files only from the specified folder
            try {
                const files = fs.readdirSync(path.join(soundsDirectory, folder)).filter(file => file.endsWith(".mp3"));
                if (files.length > 0) {
                    filesByFolder.set(folder, files);
                }
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
            if (filesByFolder.size === 0) {
                await interaction.reply({ content: "Your soundboard is empty! Get it started with /addsound.", ephemeral: true });
                return;
            }

            let listOfSounds = "";
            let index = 1;

            // Then add files from each folder
            for (let [folderName, files] of filesByFolder) {
                if(folderName) listOfSounds += `\n\n${folderName}:`;
                for (let file of files) {
                    listOfSounds += `\n${index++}) ${path.parse(file).name}`;
                }
            }

            //Create embed
            let embed = new EmbedBuilder()
                .setTitle("Soundboard")
                .setDescription("Here is a list of available sounds for this server. To use them, join a voice channel and use /sounds again.")
                .addFields({ name: "Sounds", value: listOfSounds });
            await interaction.reply({ content: "", embeds: [embed], ephemeral: true });
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
                await interaction?.editReply({ content: "This request has expired.", components: [], ephemeral: true });
            } catch (err) {
                console.error(err);
            }
        });

        //Determine bounds
        const buttonsPerRow = 5;
        const rowsPerGrid = 5;
        const maxButtonsPerGrid = buttonsPerRow * rowsPerGrid;

        if (filesByFolder.size === 0) {
            await interaction.reply({ content: "Your soundboard is empty! Get it started with /addsound.", ephemeral: true });
            return;
        }

        // Function to create grids of buttons for a set of files
        const createGrids = (files, folderPath) => {
            let buttons = files.map(file => {
                return new ButtonBuilder()
                    .setCustomId(`sounds-${path.join(soundsDirectory, folderPath, file)}`)
                    .setLabel(path.parse(file).name)
                    .setStyle(1);
            });

            let grids = [];
            for (let i = 0; i < buttons.length; i += maxButtonsPerGrid) {
                let gridButtons = buttons.slice(i, i + maxButtonsPerGrid);
                let rows = [];
                
                for (let j = 0; j < gridButtons.length; j += buttonsPerRow) {
                    rows.push(
                        new ActionRowBuilder()
                            .addComponents(gridButtons.slice(j, j + buttonsPerRow))
                    );
                }
                
                grids.push(rows);
            }
            
            return grids;
        };

        // Send all grids as separate messages
        let messageCount = 0;
        let totalMessages = Array.from(filesByFolder.entries())
            .reduce((acc, [_, files]) => acc + Math.ceil(files.length / maxButtonsPerGrid), 0);

        // Produce messages
        for (let [folderName, files] of filesByFolder) {  
            const folderGrids = createGrids(files, folderName);
            for (let i = 0; i < folderGrids.length; i++) {
                messageCount++;
                const content = `[${messageCount}/${totalMessages}] ${folderName}`;
                if (messageCount === 1) {
                    await interaction.reply({ content, components: folderGrids[i], ephemeral: true });
                } else {
                    await interaction.followUp({ content, components: folderGrids[i], ephemeral: true });
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
            await interaction.reply({ content: "Sorry, I am unable to play that sound.", ephemeral: true });
            console.error("Attempted to play nonexistent file:", filepath);
            return;
        }
    }
};
