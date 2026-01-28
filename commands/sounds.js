const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require('discord.js');
const { createAudioPlayer, createAudioResource, joinVoiceChannel, getVoiceConnection, AudioPlayerStatus } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const { VoiceConnectionStatus } = require('@discordjs/voice');
const { displaySounds } = require('../utils/displaySounds');
require('dotenv').config();

const rootDirectory = process.env.MP3_DIRECTORY;
module.exports = {
    data: new SlashCommandBuilder()
        .setName('sounds')
        .setDescription('Shows the soundboard')
        .addStringOption(option => 
            option.setName("group")
                .setDescription("Optional group to filter sounds from (shows all sounds if not specified)")
                .setRequired(false)
                .setAutocomplete(true)
        ),
    async autocomplete(interaction) {
        try {
            const soundsDirectory = path.join(rootDirectory, interaction.guild.id);
            
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
        const group = interaction.options.getString("group");
        let soundsDirectory = path.join(rootDirectory, interaction.guild.id);
        let files = [];

        // Create directory if it doesn't exist
        if (!fs.existsSync(soundsDirectory)) {
            try {
                fs.mkdirSync(soundsDirectory, { recursive: true });
            } catch (error) {
                console.error("Error creating directory:", error);
                await interaction.reply({ content: "Failed to create soundboard directory for your server.", ephemeral: true });
                return;
            }
        }

        // If a group is specified, read sounds from that group
        if (group) {
            const groupPath = path.join(soundsDirectory, group);
            if (!fs.existsSync(groupPath)) {
                await interaction.reply({ content: `Group \`${group}\` does not exist.`, ephemeral: true });
                return;
            }

            try {
                files = fs.readdirSync(groupPath)
                    .filter(file => {
                        const fullPath = path.join(groupPath, file);
                        return fs.statSync(fullPath).isFile() && file.endsWith('.mp3');
                    });
            } catch (error) {
                console.error("Error reading group sounds:", error);
                await interaction.reply({ content: "Unable to find sound files in this group", ephemeral: true });
                return;
            }
        } else {
            // Read files only from the root level (not subdirectories)
            try {
                files = fs.readdirSync(soundsDirectory)
                    .filter(file => {
                        const fullPath = path.join(soundsDirectory, file);
                        return fs.statSync(fullPath).isFile() && file.endsWith('.mp3');
                    });
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
            if (files.length === 0) {
                await interaction.reply({ content: "Your soundboard is empty! Get it started with /addsound.", ephemeral: true });
                return;
            }

            let listOfSounds = "";
            for (let i = 0; i < files.length; i++) {
                listOfSounds += `\n${i + 1}) ${path.parse(files[i]).name}`;
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

        if (files.length === 0) {
            await interaction.reply({ content: "Your soundboard is empty! Get it started with /addsound.", ephemeral: true });
            return;
        }

        await displaySounds(interaction, files, group);
    },

    async handleButtonClick(interaction) {
        // Extract relative path from custom ID (format: "sounds-filename.mp3" or "sounds-group/filename.mp3")
        let relativePath = interaction.customId.split("-")?.slice(1)?.join("-");
        
        // Reconstruct the full filepath
        const rootDirectory = process.env.MP3_DIRECTORY;
        let filepath = path.join(rootDirectory, interaction.guild.id, relativePath);
        
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
