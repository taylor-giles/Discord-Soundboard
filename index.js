const { Client, Collection, Events, IntentsBitField, MessageActionRow, MessageButton } = require('discord.js');
const fs = require('fs');
const path = require('path');
const sounds = require('./commands/sounds');
const groups = require('./commands/groups');
require('dotenv').config();

const token = process.env.TOKEN;
const mp3Dir = process.env.MP3_DIRECTORY;

//Create the client object
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildVoiceStates
    ]
});


//Read in the commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (let file of commandFiles) {
    const filepath = path.join(commandsPath, file);
    const command = require(filepath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log("Invalid command detected:", command);
    }
}

//Configure commands handlers
client.on(Events.InteractionCreate, async (interaction) => {
    //Make sure the sub-directory for this guild exists
    let dirPath = path.join(mp3Dir, interaction.guild.id);
    if(!fs.existsSync(dirPath)){
        try {
            fs.mkdirSync(dirPath, {recursive: true});
        } catch(err) {
            console.error("Error creating directory:", err);
            await interaction.editReply({content: "Failed to create new directory for your server's soundboard.", ephemeral: true});
            return;
        }
    }

    if (interaction.isChatInputCommand()) {
        //Determine what command is being requested
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
            console.error("Received invalid command:", interaction.commandName);
            await interaction.reply({ content: "Sorry, I don't understand this command!", ephemeral: true });
            return;
        }
        try {
            //Execute the command
            await command.execute(interaction);
        } catch (err) {
            console.error("Error processing command:", err);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Sorry, there was an error processing this command :(', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Sorry, there was an error processing this command :(', ephemeral: true });
            }
        }
    } else if (interaction.isAutocomplete()) {
        //Handle autocomplete interactions
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
            console.error("Received autocomplete for invalid command:", interaction.commandName);
            return;
        }
        try {
            if (command.autocomplete) {
                await command.autocomplete(interaction);
            }
        } catch (err) {
            console.error("Error processing autocomplete:", err);
        }
    } else if(interaction.isButton()){
        //Allow the appropriate command to handle the button click
        if(interaction.customId.startsWith("sounds")){
            sounds.handleButtonClick(interaction);
        } else if(interaction.customId.startsWith("group-")){
            groups.handleGroupButtonClick(interaction);
        }
    }
})

client.on('ready', (_client) => {
    console.log(`Client ${_client.user.id} (${_client.user.tag}) is ready.`);
});

client.login(token);