const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const { VoiceConnectionStatus } = require('@discordjs/voice');
const { displaySounds } = require('../utils/displaySounds');
require('dotenv').config();

const rootDirectory = process.env.MP3_DIRECTORY;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('groups')
        .setDescription('Select from available groups'),
    async execute(interaction) {
        let soundsDirectory = path.join(rootDirectory, interaction.guild.id);

        // Get all groups (subdirectories)
        let groups = [];
        
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

        // Read directories only (groups)
        try {
            groups = fs.readdirSync(soundsDirectory, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
        } catch (error) {
            console.error("Error reading groups:", error);
            await interaction.reply({ content: "Unable to find groups", ephemeral: true });
            return;
        }

        // If not in voice channel, show list of groups
        let userVoiceChannel = interaction.member.voice.channel;
        if (!userVoiceChannel) {
            if (groups.length === 0) {
                await interaction.reply({ content: "No groups exist yet! Create one with /addgroup.", ephemeral: true });
                return;
            }

            let listOfGroups = "";
            for (let i = 0; i < groups.length; i++) {
                listOfGroups += `\n${i + 1}) ${groups[i]}`;
            }

            let embed = new EmbedBuilder()
                .setTitle("Sound Groups")
                .setDescription("Here are the available groups. To view sounds in a group, join a voice channel and use /groups again.")
                .addFields({ name: "Groups", value: listOfGroups });
            await interaction.reply({ content: "", embeds: [embed], ephemeral: true });
            return;
        }

        // User is in a voice channel, show group selection buttons
        let connection = joinVoiceChannel({
            channelId: userVoiceChannel.id,
            guildId: userVoiceChannel.guild.id,
            adapterCreator: userVoiceChannel.guild.voiceAdapterCreator
        });

        //Set up voice channel disconnect handler
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await interaction?.editReply({content: "This request has expired.", components: [], ephemeral: true});
            } catch(err){
                console.error(err);
            }
        });

        if (groups.length === 0) {
            await interaction.reply({ content: "No groups exist yet! Create one with /addgroup.", ephemeral: true });
            return;
        }

        // Build group selection buttons
        const buttonsPerRow = 5;
        const rowsPerGrid = 5;

        let buttons = groups.map(group => {
            return new ButtonBuilder()
                .setCustomId(`group-${group}`)
                .setLabel(group)
                .setStyle(1);
        });

        // Build rows
        let rows = [];
        let buttonIndex = 0;
        while (buttonIndex < buttons.length) {
            rows.push(new ActionRowBuilder().addComponents(buttons.slice(buttonIndex, buttonIndex + buttonsPerRow)));
            buttonIndex += buttonsPerRow;
        }

        // Build grids
        let grids = [];
        let rowIndex = 0;
        while (rowIndex < rows.length) {
            grids.push(rows.slice(rowIndex, rowIndex + rowsPerGrid));
            rowIndex += rowsPerGrid;
        }

        await interaction.reply({ content: grids.length > 1 ? `1/${grids.length}` : "", components: grids[0], ephemeral: true });
        if (grids.length > 1) {
            for (let grid of grids.slice(1)) {
                await interaction.followUp({ content: `${grids.indexOf(grid) + 1}/${grids.length}`, components: grid, ephemeral: true });
            }
        }
    },

    async handleGroupButtonClick(interaction) {
        const groupName = interaction.customId.split("-").slice(1).join("-");
        let soundsDirectory = path.join(rootDirectory, interaction.guild.id);
        let groupPath = path.join(soundsDirectory, groupName);

        // Get sounds in the group
        let sounds = [];
        try {
            sounds = fs.readdirSync(groupPath)
                .filter(file => {
                    const fullPath = path.join(groupPath, file);
                    return fs.statSync(fullPath).isFile() && file.endsWith('.mp3');
                });
        } catch (error) {
            console.error("Error reading group sounds:", error);
            await interaction.reply({ content: "Unable to find sounds in this group.", ephemeral: true });
            return;
        }

        if (sounds.length === 0) {
            await interaction.reply({ content: `The group \`${groupName}\` has no sounds.`, ephemeral: true });
            return;
        }

        // Use the centralized displaySounds function
        await displaySounds(interaction, sounds, groupName);
    }
};
