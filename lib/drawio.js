'use babel';

import { CompositeDisposable } from 'event-kit';
import { remote } from 'electron';
import querystring from 'querystring';
import { actions } from 'inkdrop';

module.exports = {
  activate() {
    this.initialize();

    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(inkdrop.commands.add(document.body, {
      'drawio:open-with-editor': (e) => this.openWithEditor(e)
    }));
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  openWithEditor(e) {
    const fileId = e.srcElement.src.replace('inkdrop-file://','');

    if(window.drawIOWindows[fileId] && !window.drawIOWindows[fileId].isDestroyed()) {
      window.drawIOWindows[fileId].show();
      return
    }

    const win = new remote.BrowserWindow({
      webPreferences: {
            nodeIntegration: true
        }
      }
    );
    win.setMenuBarVisibility(false);
    const qs = querystring.stringify({
            offline: 1,
            lang: 'de',
            splash: 0
    });
    win.loadURL(`file://${__dirname}/../drawio/src/main/webapp/index.html?${qs}`);
    win.openDevTools();

    win.webContents.once('dom-ready', () => {
      const { editingNote } = inkdrop.store.getState();
      inkdrop.main.dataStore.getLocalDB().files.get(fileId, { attachments: true }).then((file) => {
        const data = [ editingNote._id, file._id, file.name, file._attachments.index.data ].join(',');
        win.webContents.send('load-svg', data);
      }).catch(function (err) {
        console.log(err);
      });
    });

    // store reference to window
    window.drawIOWindows[fileId] = win;
  },

  initialize() {
    window.drawIOWindows = {};

    // listen for save
    remote.ipcMain.on('save-svg', (event, data) => {
      const db = inkdrop.main.dataStore.getLocalDB()
      const [ noteId, fileId, fileName, fileData ] = data.split(',');
      const newFileId = db.files.createId();

      // create new file
      const newFile = {
        _id: newFileId,
        name: fileName,
        createdAt: +new Date(),
        contentType: 'image/svg+xml',
        contentLength: atob(fileData).length,
        publicIn: [],
        _attachments: {
          index: {
            content_type: 'image/svg+xml',
            data: fileData
          }
        }
      }
      db.files.put(newFile).then((result) => {
        // get note for update
        return db.notes.get(noteId)
      }).then((note) => {
        // update note
        note.body = note.body.replace(fileId, newFileId);
        return db.notes.put(note);
      }).then((result) => {
        window.drawIOWindows[newFileId] = window.drawIOWindows[fileId];
        delete window.drawIOWindows[fileId];
        // send saved event
        event.reply('saved', newFileId);
      }).catch(function (err) {
        console.log(err);
      });
    });
  }

};
