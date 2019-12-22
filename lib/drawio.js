'use babel';

import DrawioMessageDialog from './drawio-message-dialog';

import { CompositeDisposable } from 'event-kit';
import { app, remote } from 'electron';
import querystring from 'querystring';

module.exports = {

  activate() {
    inkdrop.components.registerClass(DrawioMessageDialog);
    inkdrop.layouts.addComponentToLayout(
      'modal',
      'DrawioMessageDialog'
    )

          this.subscriptions = new CompositeDisposable();
        this.subscriptions.add(inkdrop.commands.add(document.body, {
            'drawio:open-editor': () => this.openEditor()
        }));
  },

  deactivate() {
    inkdrop.layouts.removeComponentFromLayout(
      'modal',
      'DrawioMessageDialog'
    )
    inkdrop.components.deleteClass(DrawioMessageDialog);

          this.subscriptions.dispose();
  },

  openEditor() {
    const electron = require('electron');
    const BrowserWindow = electron.remote.BrowserWindow;
    const qs = querystring.stringify({
            offline: 1,
            lang: 'de',
            splash: 0
    });
    const win = new BrowserWindow();
    win.setMenuBarVisibility(false);
    win.loadURL(`file://${__dirname}/../drawio/src/main/webapp/index.html?${qs}`);
    win.openDevTools();
  }

};
