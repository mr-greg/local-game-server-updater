import { exec } from 'child_process';
import * as fs from 'fs';
import axios from 'axios';
import archiver from 'archiver';

// App ID
const appId = 1623730;
// Path to the server folder to be backed up
const serverFolderPath = 'server';

// Path to the backup folder
const backupFolderPath = 'backup';

// Path to the monServeur.bat file
const monServeurPath = 'server';

// Set state for the process
let isRestarting = false;

function startOrRestartServer() {
  // Check if the server is already in the process of restarting
  if (!isRestarting) {
    isRestarting = true;

    // Kill the server process if it's running
    exec(
      'taskkill /f /fi "WINDOWTITLE eq server.bat',
      (killError, killStdout, killStderr) => {
        if (killError) {
          console.error(`Error stopping the server: ${killError}`);
          isRestarting = false; // Reset the flag in case of an error
        }

        // Start the server after closing it
        exec(
          `start ${monServeurPath}`,
          (startError, startStdout, startStderr) => {
            if (startError) {
              console.error(`Error starting the server: ${startError}`);
            }

            isRestarting = false; // Reset the flag after restarting
          }
        );
      }
    );
  }
}

// Function to restart the server with backup
function restartServerWithBackup() {
  // Create a unique file name based on the current date
  const backupFileName = `backup_${Date.now()}.zip`;

  // Full path of the backup file
  const backupFilePath = `${backupFolderPath}/${backupFileName}`;

  // Create an Archiver instance to compress the server folder
  const archive = archiver('zip', { zlib: { level: 9 } });

  // Create an output stream for the ZIP file
  const output = fs.createWriteStream(backupFilePath);

  // Error event during compression
  archive.on('error', (err) => {
    console.error(`Error creating the backup: ${err}`);
  });

  // Event when the archive is finished
  archive.on('end', () => {
    console.log(`Backup created successfully: ${backupFileName}`);
    // Now, restart the server
    startOrRestartServer();
  });

  // Add the server folder to the archive
  archive.directory(serverFolderPath, false);

  // Finalize the archive
  archive.finalize();

  // Redirect the archive output to the file
  archive.pipe(output);
}

// Function to read the date of the last update from a file
function readLastUpdateDate() {
  try {
    const data = fs.readFileSync('lastUpdate.txt', 'utf8');
    return parseInt(data);
  } catch (err) {
    return 0; // Return 0 if the file does not exist or there is a read error
  }
}

// Function to write the current date to the file
function writeLastUpdateDate(date) {
  fs.writeFileSync('lastUpdate.txt', date.toString(), 'utf8');
}

// Function to get the date of the last update from the Steam API
async function getLatestUpdateDate() {
  try {
    const response = await axios.get(
      `http://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=${appId}&count=1&format=json`
    );
    const latestUpdate = response.data.appnews.newsitems[0].date;
    return latestUpdate;
  } catch (error) {
    console.error(
      `Error retrieving the date of the last update: ${error.message}`
    );
    return 0; // Return 0 in case of an error
  }
}

// Function to check if an update has occurred and restart the server if necessary
async function checkForUpdateAndRestart() {
  const currentUpdateDate = readLastUpdateDate();

  // Get the date of the last update from the Steam API
  const latestUpdateDate = await getLatestUpdateDate();

  if (latestUpdateDate > currentUpdateDate) {
    console.log(
      'Update detected. Creating a backup and restarting the server.'
    );
    restartServerWithBackup();
    writeLastUpdateDate(latestUpdateDate);
  } else {
    console.log('No update detected.');
  }
}

// Execute the function to check and restart every hour (3600000 ms)
setInterval(checkForUpdateAndRestart, 3600000);

// Launch the server at the script startup
startOrRestartServer();
checkForUpdateAndRestart();
