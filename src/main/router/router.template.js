import EventRoute from './EventRoute'
import { join } from 'path'
// import EventRouter from './EventRouter'
const routers = []

routers.push(
  new EventRoute('open-bluetooth-window', 'event', (api) => {
    const { BrowserWindow } = api
    let bluetoothWindow = new BrowserWindow({
      width: 900,
      height: 670,
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        nodeIntegration: true, // 启用 Node.js 集成
        contextIsolation: false, // 禁用上下文隔离(渲染进程，主进程同步语法，例如node)
        enableRemoteModule: true // 启用 remote 模块（如果需要）
      }
    })
    bluetoothWindow.on('ready-to-show', () => {
      bluetoothWindow.setTitle('SerialTools-蓝牙通信')
    })
    if (process.env.NODE_ENV === 'development') {
      bluetoothWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/#/bluetooth')
    } else {
      bluetoothWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/bluetooth' })
    }
    // const eventRouter = new EventRouter()
    // eventRouter.addApi('window', bluetoothWindow)
    bluetoothWindow.on('closed', () => {
      bluetoothWindow = null
    })
  })
)

routers.push(
  new EventRoute('open-serialport-window', 'event', (api) => {
    const { BrowserWindow } = api
    let serialWindow = new BrowserWindow({
      width: 900,
      height: 670,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        nodeIntegration: true, // 启用 Node.js 集成
        contextIsolation: false, // 禁用上下文隔离
        enableRemoteModule: true // 启用 remote 模块（如果需要）
      }
    })
    serialWindow.on('ready-to-show', () => {
      serialWindow.show()
    })
    if (process.env.NODE_ENV === 'development') {
      serialWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      serialWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
    serialWindow.on('closed', () => {
      serialWindow = null
    })
  })
)

routers.push(
  new EventRoute('select-file', 'event', async (api) => {
    const { dialog, mainWindow, fs } = api
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      alwaysOnTop: true, // 确保选择对话框始终在上方
      title: '选择文件'
    })
    if (result.canceled) {
      return null
    } else {
      const filePath = result.filePaths[0]
      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8')
        return {
          code: 200,
          filePath,
          fileContent
        }
      } catch (e) {
        return {
          code: 500,
          filePath,
          fileContent: '读取文件时出错'
        }
      }
    }
  })
)

export default routers
