<script setup>
import { ref, onMounted, watch, reactive } from 'vue'
const { SerialPort } = require('serialport')
const { ReadlineParser } = require('@serialport/parser-readline')
import { stringToHex, formatSizeUnits, hexToString, bufferToString } from '@utils/common'

const sendInput = ref(null)
const portList = ref(['COM3', 'COM4', 'COM5', 'COM6'])
const dataBitsList = [8, 7, 6, 5]
const parityBitsList = ['无', '奇', '偶']
const stopBitsList = [1, 1.5, 2]
const baudRatesList = [
  1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, 76800, 115200, 230400, 256000, 460800, 921600
]
const fileData = ref('')
const options = reactive({
  path: '',
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parityBit: '无'
})
const baudRate = ref(9600)
const bluthName = ref('')
const pairPassword = ref('')
const serialport = reactive({})
const sendContent = ref('')
const receiveContent = ref('')
const redKey = ref(false)
const hexDisplay = ref(false)
const sixteenSend = ref(false)
const sendANewBank = ref(false)
const receive200k = ref(false)

const frequency = ref(500)
const loopSend = ref(false)
const setTime = ref(null)
const writingFormat = ref('utf8')
let isClosedByUser = false // 串口是否由用户手动关闭
const isFileDialogOpen = ref(false) // 文件选择器是否打开
let fileDialogPromise = null // 文件选择器 Promise 对象
const uploadProgress = ref(0) // 用于跟踪上传进度
const isUploading = ref(false) // 用于指示是否正在上传

/**
 * 打开/关闭串口
 */
const openPort = async () => {
  try {
    if (serialport?.isopenport) {
      closePortManually()
    } else {
      if(!options.path) {
        portList.value = (await SerialPort.list()).map((item) => item.path)
        options.path = portList.value[0] || ''
        return alert('请先选择串口')
      }
      serialport.port = new SerialPort(options)
      serialport.parser = serialport.port.pipe(new ReadlineParser({ delimiter: '\n' }))
      serialport.port.on('open', () => {
        serialport.isopenport = true
        console.log('串口已打开', serialport.port)
        notify()
        addCloseEventListener()
      })
      serialport.port.on('error', (err) => {
        serialport.isopenport = false
        removeCloseEventListener()
        sendInput.value.focus()
        console.log('串口错误：', err)
        if (err) return alert('没有找到串口')
        if (serialport.isopenport) {
          alert('串口错误：' + err.message)
          addCloseEventListener()
        }
      })
    }
  } catch (error) {
    console.log(error)
  }
}

/**
 * usb、断电关闭串口
 */
const addCloseEventListener = () => {
  if (serialport.port) {
    serialport.port.on('close', () => {
      clearInterval(setTime.value)
      loopSend.value = false
      serialport.isopenport = false
      if (!isClosedByUser) {
        alert('串口连接已断开')
      }
      // 注意：这里不需要重置isClosedByUser，因为它应该在每次关闭时都根据用户操作来设置
    })
  }
}

/**
 * 手动关闭串口
 */
const closePortManually = () => {
  isClosedByUser = true
  if (serialport.port) {
    serialport.port.close((err) => {
      if (err) {
        console.error('关闭串口时出错', err)
      } else {
        clearInterval(setTime.value)
        loopSend.value = false
        serialport.isopenport = false
        console.log('串口已关闭')
      }
      removeCloseEventListener()
    })
  }
}

/**
 * 移除关闭事件监听的函数
 */
const removeCloseEventListener = () => {
  if (serialport.port) {
    serialport.port.removeAllListeners('close')
  }
}

// 清除接收区域的内容
const clearReceived = () => {
  receiveContent.value = ''
}

// 清除发送区域的内容
const clearSend = () => {
  sendContent.value = ''
  fileData.value = ''
}

/**
 * 给串口发送数据
 */
const sendMessage = () => {
  if (!serialport?.isopenport) {
    alert('串口未打开，请先打开串口。')
    return
  }
  if (!sendContent.value) return
  let contentToSend = sendContent.value
  if (sixteenSend.value) {
    writingFormat.value = 'hex'
    // contentToSend = stringToHex(sendContent.value)
  }
  if (sendANewBank.value) {
    contentToSend += '\r\n'
  }
  try {
    serialport.port.write(contentToSend, writingFormat.value, (err) => {
      if (err) {
        return console.log('写入命令失败:', err.message)
      }
      sendContent.value = sendContent.value.trim()
      console.log('发送信息：', sendContent.value)
    })
  } catch (error) {
    console.log(error)
  }
}

const notify = () => {
  console.log('监听数据...')
  let dataString = ''
  serialport.port.on('data', (data) => {
    // 判断是否是 buffer 类型
    if (data instanceof Buffer) {
      dataString = bufferToString(data)
    } else {
      dataString = data.toString() || ''
    }
    if (dataString === 'null') return
    console.log('收到数据:', dataString)
    if (hexDisplay.value) {
      dataString = stringToHex(dataString)
    }
    receiveContent.value += dataString
  })
}

const openBluetoothWindow = () => {
  try {
    electron.ipcRenderer.send('renderer-to-main', {
      name: 'open-bluetooth-window'
    })
  } catch (e) {
    console.log(e)
  }
}

const openSerialportWindow = () => {
  try {
    electron.ipcRenderer.send('renderer-to-main', {
      name: 'open-serialport-window'
    })
  } catch (e) {
    console.log(e)
  }
}

const selectFile = async () => {
  if (fileDialogPromise) return fileDialogPromise
  fileDialogPromise = new Promise((resolve, reject) =>
    (async () => {
      try {
        if (isFileDialogOpen.value) {
          resolve(null)
        }
        isFileDialogOpen.value = true
        const res = await electron.ipcRenderer.invoke('renderer-to-main-invoke', {
          name: 'select-file'
        })
        if (res?.filePath) {
          fileData.value = res
          resolve(res)
        } else {
          resolve(null)
        }
      } catch (e) {
        console.log(e)
        reject(e)
      } finally {
        isFileDialogOpen.value = false
        fileDialogPromise = null
      }
    })()
  )
  console.log('fileDialogPromise:', fileDialogPromise)
  return fileDialogPromise
}

const sendFile = async () => {
  if (!serialport.isopenport) {
    alert('串口未打开，请先打开串口。')
    return
  }
  const file = fileData.value
  if (!file || !file.fileContent) {
    return alert('请先选择有效文件或文件内容为空')
  }
  isUploading.value = true // 开始上传
  uploadProgress.value = 0 // 重置进度
  try {
    const content = file.fileContent
    const chunkSize = 512
    const totalChunks = Math.ceil(content.length / chunkSize)
    for (let i = 0; i < totalChunks; i++) {
      const chunk = content.substr(i * chunkSize, chunkSize)
      await new Promise((resolve) => {
        serialport.port.write(chunk, writingFormat.value, (err) => {
          if (err) {
            console.log('发送文件失败:', err.message)
            isUploading.value = false
            return alert('发送文件失败')
          }
          uploadProgress.value = Math.round(((i + 1) / totalChunks) * 100) // 更新进度
          resolve()
          console.log('发送成功')
        })
      })
    }
  } catch (error) {
    console.log(error)
  } finally {
    setTimeout(() => {
      isUploading.value = false
      uploadProgress.value = 0
    }, 800)
  }
}

watch(
  () => loopSend.value,
  (newVal) => {
    console.log(newVal)
    if (!newVal) {
      clearInterval(setTime.value)
    } else {
      setTime.value = setInterval(() => {
        sendMessage()
        if (!serialport.isopenport) {
          loopSend.value = false
          return clearInterval(setTime.value)
        }
      }, frequency.value)
    }
  }
)
watch(
  () => receiveContent.value,
  (newVal) => {
    if (newVal) {
      const size = formatSizeUnits(receiveContent.value)
      const sizeInBytes = 200.0 * 1024
      if (size > sizeInBytes) {
        receiveContent.value = ''
      }
    }
  }
)
const listenHexDisplay = (data) => {
  if (data) {
    receiveContent.value = stringToHex(receiveContent.value)
  } else {
    receiveContent.value = hexToString(receiveContent.value)
  }
}

onMounted(async () => {
  portList.value = (await SerialPort.list()).map((item) => item.path)
  console.log(portList.value);
  options.path = portList.value[0] || ''
})

window.addEventListener('beforeunload', () => {
  if (serialport.isopenport) {
    closePortManually()
  }
})
</script>

<template>
  <div class="h-full flex flex-col bg-[#e6e6e6]">
    <div class="flex flex-1">
      <div class="flex flex-col w-200px px-12px">
        <div class="bg='#f5f7fa' w-full">
          <fieldset class="border='[1px_solid_#ccc]' p-10px">
            <legend class="text-14px text-#606266 px-10px">串口设置</legend>
            <el-form class="text-12px w-full port-form" label-position="left" label-width="auto">
              <el-form-item label="串口：" class="mb-10px">
                <el-select v-model="options.path" class="w-100px" size="small">
                  <el-option
                    v-for="path in portList"
                    :key="path"
                    :label="path"
                    :value="path"
                    class="text-12px"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="波特率：" class="mb-10px">
                <el-select v-model="options.baudRate" class="w-100px" size="small">
                  <el-option
                    v-for="rate in baudRatesList"
                    :key="rate"
                    :label="rate"
                    :value="rate"
                    class="text-12px"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="数据位：" class="mb-10px">
                <el-select v-model="options.dataBits" class="w-100px" size="small">
                  <el-option
                    v-for="item in dataBitsList"
                    :key="item"
                    :label="item"
                    :value="item"
                    class="text-12px"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="停止位：" class="mb-10px">
                <el-select v-model="options.stopBits" class="w-100px" size="small">
                  <el-option
                    v-for="item in stopBitsList"
                    :key="item"
                    :label="item"
                    :value="item"
                    class="text-12px"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="校验位：" class="mb-10px">
                <el-select v-model="options.parityBit" class="w-100px" size="small">
                  <el-option
                    v-for="item in parityBitsList"
                    :key="item"
                    :label="item"
                    :value="item"
                    class="text-12px"
                  />
                </el-select>
              </el-form-item>
              <el-form-item class="mb-10px">
                <template #default>
                  <div class="flex items-center mx-auto bg-[#409eff] w-108px rounded-[3px]">
                    <div
                      class="w-14px h-14px rounded-[50%] bg-#e7efea ml-10px"
                      :class="{ 'bg-green-600': serialport?.isopenport }"
                    ></div>
                    <el-button
                      type="primary"
                      class="px-6px hover:bg-transparent border-none"
                      @click="openPort"
                    >
                      {{ serialport?.isopenport ? '关闭串口' : '打开串口' }}
                    </el-button>
                  </div>
                  <div class="flex justify-between w-full mt-12px">
                    <el-button class="text-12px px-12px" @click="clearReceived">清除接收</el-button>
                    <el-button class="text-12px px-12px !m-0" @click="clearSend">
                      清空发送
                    </el-button>
                  </div>
                </template>
              </el-form-item>
            </el-form>
          </fieldset>
        </div>
        <div class="bg='#f5f7fa' w-full text-12px mt-6px">
          <fieldset class="border='[1px_solid_#dcdcdc]' p-10px">
            <legend class="text-14px text-#606266 px-10px">参数设置</legend>
            <el-checkbox v-model="redKey">红键</el-checkbox>
            <el-checkbox v-model="hexDisplay" @change="listenHexDisplay">16进制显示</el-checkbox>
            <el-checkbox v-model="sixteenSend">16进制发送</el-checkbox>
            <el-checkbox v-model="sendANewBank">发送新行</el-checkbox>
            <el-checkbox v-model="receive200k">接收200k清屏</el-checkbox>
          </fieldset>
        </div>
        <el-button
          type="primary"
          :disabled="loopSend"
          class="flex w-108px mx-auto mt-auto mb-2px"
          @click="sendMessage"
        >
          发送信息
        </el-button>
      </div>
      <div class="flex flex-1 flex-col">
        <el-row class="h-75% flex-col">
          <h3 class="text-12px w-full">接收区</h3>
          <el-input
            v-model="receiveContent"
            readonly
            type="textarea"
            placeholder="接收内容"
            class="flex-1 h-full h-input"
          ></el-input>
        </el-row>
        <el-row class="h-25% flex-col mt-12px">
          <h3 class="text-12px w-full">发送区</h3>
          <el-input
            ref="sendInput"
            v-model="sendContent"
            type="textarea"
            class="flex-1 h-full h-input"
            placeholder="输入信息"
          ></el-input>
        </el-row>
      </div>
      <div class="bg='#f5f7fa' w-200px">
        <div class="flex flex-wrap justify-between box-border p-8px border-l-[1px_solid_#ccc]">
          <el-button size="large" class="!mx-auto mb-12px w-80%" @click="openSerialportWindow">
            打开新窗口
          </el-button>
          <el-button size="large" class="!mx-auto w-80%" @click="openBluetoothWindow">
            打开蓝牙窗口
          </el-button>
        </div>
      </div>
    </div>
    <div class="flex h-40px w-full items-center py-5px px-12px">
      <el-form inline class="flex items-center w-[calc(100%-200px)]">
        <el-form-item label="周期" class="flex items-center my-0 !mr-12px">
          <el-input
            v-model="frequency"
            placeholder="输入周期"
            size="small"
            class="w-60px"
            :disabled="loopSend"
          />
        </el-form-item>
        <el-form-item class="flex items-center my-0">
          <el-checkbox v-model="loopSend" class="w-60px">循环发送</el-checkbox>
        </el-form-item>
        <el-form-item class="flex items-center my-0 flex-1 !mr-12px">
          <div :class="{ 'progress-container': isUploading }" class="flex flex-1">
            <div
              class="progress-bar"
              :class="{ complete: !isUploading }"
              :style="{ width: uploadProgress + '%' }"
            ></div>
            <el-input v-model="fileData.filePath" disabled size="small" class="file flex-1" />
          </div>
        </el-form-item>
        <el-button size="small" :disabled="isUploading" @click="selectFile">选择文件</el-button>
        <el-button size="small" :disabled="isUploading" type="primary" @click="sendFile">发送文件</el-button>
      </el-form>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.h-input) .el-textarea__inner {
  height: 100%;
  resize: none;
  border: 1px solid #6c6c6c;
}

:deep(.h-input) .el-textarea__inner:focus {
  box-shadow: none;
}

:deep(.h-input) .el-textarea__inner:focus-visible {
  outline: none;
}

:deep(.port-form) .el-form-item__label {
  padding: 0;
}

.file :deep(.el-input__inner) {
  color: #606266;
  -webkit-text-fill-color: #606266;
  cursor: auto;
}

.progress-container {
  position: relative;
  flex: 1;
}

.progress-bar {
  position: absolute;
  height: 20px;
  top: 50%;
  transform: translateY(-50%);
  background-color: red; /* 进度条的背景色 */
  transition: width 0.3s linear; /* 动画效果 */
  z-index: 1; /* 确保在输入框下 */
}
.progress-bar.complete {
  background-color: transparent; /* 完成后变为透明或其他颜色 */
}

.file :deep(.el-input__inner) {
  color: #606266;
  -webkit-text-fill-color: #606266;
  cursor: auto;
  background-color: transparent; /* 使输入框背景透明以显示进度条 */
  z-index: 2; /* 确保在进度条上 */
}
</style>
