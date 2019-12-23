'use babel';

import { CompositeDisposable } from 'event-kit';
import { app, remote } from 'electron';
import querystring from 'querystring';

module.exports = {
  activate() {
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(inkdrop.commands.add(document.body, {
      'drawio:open-with-editor': (e) => this.openWithEditor(e)
    }));
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  openWithEditor(e) {
    const qs = querystring.stringify({
            offline: 1,
            lang: 'de',
            splash: 0
    });
    const win = new remote.BrowserWindow({
      webPreferences: {
            nodeIntegration: true
        }
      }
    );
    win.setMenuBarVisibility(false);
    win.loadURL(`file://${__dirname}/../drawio/src/main/webapp/index.html?${qs}`);
    win.openDevTools();

    const fileName = e.srcElement.src.replace('inkdrop-file://','');
    win.webContents.once('dom-ready', () => {
      inkdrop.main.dataStore.getLocalDB().files.get(fileName, { attachments: true }).then(function (file) {
        win.webContents.send('load-svg', file._attachments.index.data);
      }).catch(function (err) {
        console.log(err);
      });
    });

    // listen for save
    remote.ipcMain.on('save-svg', (event, data) => {
      console.log(data)
    });
  }

};
