const {app, BrowserWindow, dialog} = require('electron')
const path = require('path')
const url = require('url')
const fs = require('fs');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win
global.electron = {"inEngine" : true};

function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({width: 1250, height: 650, resizable: false, show: false})

  let key = "";
  try {
    key = fs.readFileSync("./key.txt");
  } catch (e) {}

  if (key == "") {
    dialog.showMessageBoxSync(null, {type: "warning", title: "API key warning", message: "No API key found in ./key.txt...", buttons: ["OK"]});
  }


  // and load the index.html of the app.

  win.loadURL("file://"+path.join(__dirname, 'map.html')+"?key="+key);
  
  win.setMenu(null);

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })
  
  // win.webContents.openDevTools({mode: "undocked"});
  
  win.on('ready-to-show', () => {
  	win.show();
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
