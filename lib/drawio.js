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
    this.subscriptions.add(inkdrop.commands.add(document.body, {
      'drawio:create-new': (e) => this.createNew(e)
    }));
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  createNew(e) {
    const db = inkdrop.main.dataStore.getLocalDB();
    const emptyDiagramData = 'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPCFET0NUWVBFIHN2ZyBQVUJMSUMgIi0vL1czQy8vRFREIFNWRyAxLjEvL0VOIiAiaHR0cDovL3d3dy53My5vcmcvR3JhcGhpY3MvU1ZHLzEuMS9EVEQvc3ZnMTEuZHRkIj4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiIHdpZHRoPSIxcHgiIGhlaWdodD0iMXB4IiB2aWV3Qm94PSItMC41IC0wLjUgMSAxIiBjb250ZW50PSImbHQ7bXhmaWxlIGhvc3Q9JnF1b3Q7RWxlY3Ryb24mcXVvdDsgbW9kaWZpZWQ9JnF1b3Q7MjAxOS0xMi0zMFQwMDoyOTowNi4zMzNaJnF1b3Q7IGFnZW50PSZxdW90O01vemlsbGEvNS4wIChYMTE7IExpbnV4IHg4Nl82NCkgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgaW5rZHJvcC80LjQuMSBDaHJvbWUvNzYuMC4zODA5LjE0NiBFbGVjdHJvbi82LjAuMTEgU2FmYXJpLzUzNy4zNiZxdW90OyBldGFnPSZxdW90O3hFY3Y0R04zeUxLVkRKVGNkZUwzJnF1b3Q7IHZlcnNpb249JnF1b3Q7MTIuNC4zJnF1b3Q7IHR5cGU9JnF1b3Q7ZGV2aWNlJnF1b3Q7IHBhZ2VzPSZxdW90OzEmcXVvdDsmZ3Q7Jmx0O2RpYWdyYW0gaWQ9JnF1b3Q7Y1ZLSndZNGQ1OVFhdzJaQ2lDT0wmcXVvdDsgbmFtZT0mcXVvdDtQYWdlLTEmcXVvdDsmZ3Q7ZFpIQkVvSWdFSWFmaHJ0Q1UzbzJxMHNuRDUwWjJZUVpkQm1rMFhyNmRNQ01zVTRzMy84dnkrNFNWclRqMlhJanJ5aEFFNXFJa2JBam9UVGRwZGwwek9UcENXVzVCNDFWSXBoV1VLa1hCSmdFK2xBQytzam9FTFZUSm9ZMWRoM1VMbUxjV2h4aTJ4MTFYTlh3QmphZ3FybmUwcHNTVGdhYTd2TlZ1SUJxWkNpZDBZTVhXcjZZUXllOTVBS0hMOFJLd2dxTDZIelVqZ1hvZVhqTFhIemU2WS82K1ppRnp2MUltSUwxN2VrU2JZaVZidz09Jmx0Oy9kaWFncmFtJmd0OyZsdDsvbXhmaWxlJmd0OyI+PGRlZnMvPjxnLz48L3N2Zz4=';

    const file = {
      _id: db.files.createId(),
      name: 'diagram.svg',
      createdAt: +new Date(),
      contentType: 'image/svg+xml',
      contentLength: atob(emptyDiagramData).length,
      publicIn: [],
      _attachments: {
        index: {
          content_type: 'image/svg+xml',
          data: emptyDiagramData
        }
      }
    }
    // create empty file, insert to note and open in editor
    db.files.put(file).then((result) => {
      const { cm } = inkdrop.getActiveEditor();
      const cursor = cm.getCursor();
      cm.getDoc().replaceRange(`![${file.name}](inkdrop://${file._id})`, cursor);
      this.openFileInNewWindow(file._id);
    }).catch(function (err) {
      console.log(err);
    });
  },

  openWithEditor(e) {
    const fileId = e.srcElement.src.replace('inkdrop-file://','');

    if(window.drawIOWindows[fileId] && !window.drawIOWindows[fileId].isDestroyed()) {
      window.drawIOWindows[fileId].show();
    } else {
      this.openFileInNewWindow(fileId);
    }
  },

  openFileInNewWindow(fileId) {
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
      const db = inkdrop.main.dataStore.getLocalDB();
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
