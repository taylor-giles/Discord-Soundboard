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
        .setDescription('Shows the soundboard'),
    async execute(interaction) {
        let soundsDirectory = path.join(rootDirectory, interaction.guild.id);

        //Read files from directory
        let files = fs.readdirSync(soundsDirectory);
        console.log("Reading MP3 files at " + soundsDirectory);
        if (!files) {
            console.error("Error reading files");
            await interaction.reply({ content: "Unable to find sound files", ephemeral: true });
            return;
        }
        files = files.filter(file => file.endsWith(".mp3")); //Read only mp3s

        //Join voice channel
        let userVoiceChannel = interaction.member.voice.channel;
        if (!userVoiceChannel) {
            //If not in voice channel, send back list of sounds
            //TODO: Make this work for more than 1024 characters
            let listOfSounds = (files.length <= 0) ? "Your soundboard is empty! Get it started with /addsound." : "";
            for(let file of files){
                listOfSounds += `\n${files.indexOf(file)+1}) ${path.parse(file).name}`
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
            buttons.push(new ButtonBuilder()
                .setCustomId(`sounds-${filepath}`)
                .setLabel(file.replace(".mp3", ""))
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
