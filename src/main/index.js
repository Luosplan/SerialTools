import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import EventRouter from './router/EventRouter'
import routers from './router/router.template'
import fs from 'fs'

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // 配置渲染进程中的安全选项
      sandbox: false, // 禁用沙盒模式以允许更多功能
      nodeIntegration: true, // 允许在渲染进程中使用 导入 Node.js API
      contextIsolation: false, // 禁用上下文隔离以简化开发
      //禁止使用 remote 模块 来与主进程交互 例如：渲染进程使用这种语法
      // const { remote } = require('electron') const { dialog } = remote
      enableRemoteModule: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.setTitle('SerialTools-串口通信')
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  const eventRouter = new EventRouter()
  eventRouter.addApi('api', app)
  eventRouter.addApi('BrowserWindow', BrowserWindow)
  eventRouter.addApi('dialog', dialog)
  eventRouter.addApi('mainWindow', mainWindow)
  eventRouter.addApi('fs', fs)
  eventRouter.addRoutes(routers)
  ipcMain.on('renderer-to-main', (event, arg) => {
    eventRouter.router(arg)
  })
  ipcMain.handle('renderer-to-main-invoke', (event, arg) => {
    return eventRouter.router(arg)
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
