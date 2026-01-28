const { ActionRowBuilder, ButtonBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

/**
 * Displays sounds as buttons in a grid format
 * @param {Object} interaction - Discord interaction object
 * @param {Array<string>} soundFiles - Array of sound filenames
 * @param {string|null} group - Optional group name for display
 */
async function displaySounds(interaction, soundFiles, group = null) {
    if (soundFiles.length === 0) {
        await interaction.reply({ content: "No sounds found.", ephemeral: true });
        return;
    }

    const buttonsPerRow = 5;
    const rowsPerGrid = 5;

    // Build buttons for sounds
    let buttons = soundFiles.map(soundFile => {
        let customId;
        
        // Use relative paths: "soundname.mp3" or "group/soundname.mp3"
        if (group) {
            customId = `sounds-${group}/${soundFile}`;
        } else {
            customId = `sounds-${soundFile}`;
        }

        return new ButtonBuilder()
            .setCustomId(customId)
            .setLabel(path.parse(soundFile).name)
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

    // Build content string with pagination and optional group name
    let contentBuilder = [];
    if (grids.length > 1) {
        contentBuilder.push(`1/${grids.length}`);
    }
    if (group) {
        contentBuilder.push(`[${group}]`);
    }
    const content = contentBuilder.join(" ");

    // Send the first message
    await interaction.reply({ content, components: grids[0], ephemeral: true });

    // Send follow-up messages for additional pages
    if (grids.length > 1) {
        for (let i = 1; i < grids.length; i++) {
            let followUpContent = [];
            followUpContent.push(`${i + 1}/${grids.length}`);
            if (group) {
                followUpContent.push(`[${group}]`);
            }
            await interaction.followUp({ content: followUpContent.join(" "), components: grids[i], ephemeral: true });
        }
    }
}

module.exports = { displaySounds };
