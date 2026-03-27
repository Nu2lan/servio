import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert import.meta.url to a directory path since this uses ESM via vite
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        icon: path.join(process.env.VITE_PUBLIC || '', 'servio.png'), // Placeholder icon
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'), // Vite builds it with .mjs in esm
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Test active dev environment
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        // Production environment: Always point to the cloud web version (Thin Client)
        mainWindow.loadURL('https://servio.up.railway.app');
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Process should terminate in windows and linux
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
