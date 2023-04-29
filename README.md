# Welcome to the Soundboard
This Discord bot allows you to upload custom sounds on a per-server basis and play them in voice channels on command, controlled through a button-based soundboard triggered by slash-command in text channels.

# Setup
1) Create an application using the [Discord Developer Portal](https://discord.com/developers/applications)
1) Create a bot from the "Bot" tab (in the left toolbar) and activate all the switches under the "Privileged Gateway Intents" heading
1) Clone this repository
1) Create a file called `.env` with the following content:
```
TOKEN="<YOUR BOT'S TOKEN>"
MP3_DIRECTORY="<YOUR SOUNDS DIRECTORY>"
CLIENT_ID="<YOUR APPLICATION ID>"
MAX_FILE_SIZE = 300000
```
* Your bot's `token` can be found on the "Bot" tab in the Discord Developer Portal page for your application. You may need to press the "Reset Token" button to obtain a new token if you do not know it.
* Your `client id` (aka Application ID) can be found in the General Information tab of the Discord Developer Portal page for your application.
* The `MP3 Directory` is where the bot will store all uploaded MP3s. The bot will create a sub-folder (in the configured directory) for each server that the bot is added to. Each server's MP3s will go in its respective subfolder. 
* Sounds are uploaded as MP3s. MP3 file uploads are limited to a size defined by `MAX_FILE_SIZE`. 300000 bytes = 300KB, or roughly 10 seconds of audio at a standard bit rate, so it is a good default option, but this value can be changed according to your needs.

IMPORTANT NOTE: The first time the bot is set up, **and any time the definition/configuration of commands is changed** (this means anything in the `data` field of the exported command object), the `deploy-commands.js` script needs to be run. This can be done using `node deploy-commands.js`. Note that this command re-defines the commands supported by this bot for **all servers** that the bot is in, and that Discord enforces a limit on the number of commands that can be updated in a server per day (200/server/day).

# Usage
## Adding the bot to a server
To add the bot to a server, first generate an invite link via the "OAuth2 > URL Generator" tab in the [Discord Developer Portal](https://discord.com/developers/applications) for your application. Ensure that the "bot" scope is checked, as well as the following Bot Permissions:
* Read Messages/View Channels
* Send Messages
* Send TTS Messages
* Manage Messages
* Attach Files
* Read Message History
* Mention Everyone
* Use Slash Commands
* Connect
* Speak
* Use Voice Activity
* Use Soundboard
* Use External Sounds

Then copy the link at the bottom, paste it into the browser, select your server from the dropdown, and click "Continue" > "Authorize". This link can be re-used for as many servers as desired, and distributed to others for them to add the bot to their servers.

## Running the bot
To bring the soundboard bot online, simply run the index.js file with Node. This can be achieved by running `node index.js` (in the project directory), with nodemon (run `nodemon` in the project directory), or any other desired method or running Node applications.

## Using the bot
The soundboard bot recognizes several main commands:
* `/sounds` - If the user is in a voice channel, this command causes the bot to join the server and creates a button-based interface in the text channel that the command was used in. The interface is visible only to the command caller, and can be dismissed. There is a button in the interface for each sound that is configured in that server. When a button is pressed, the bot plays that sound in the voice channel.
If the user is not in a voice channel, this command displays a list of available sounds, visible only to the command caller.

* `/stopsounds` - Causes the bot to leave any voice channel that it is in, consequently stopping any currently running sounds.

* `/addsound` - Allows the user to add a new sound to the server's (bot-handled) soundboard by uploading an MP3 file and associating it with a custom name. The command will fail if the file is too large (defined by `MAX_FILE_SIZE` in `.env`) or if a sound with the given name already exists.

* `/removesound` - Allows the user to remove a sound from the server's (bot-handled) soundboard. The command takes in a name, and if a sound with that name exists, it will be removed.


