const routes = [
  {
    path: '/',
    redirect: '/index'
  },
  {
    path: '/index',
    name: 'Index',
    component: () => import('@views/index.vue'),
    meta: {
      title: '串口通信'
    }
  },
  {
    path: '/bluetooth',
    name: 'Bluetooth',
    component: () => import('@views/bluetooth.vue'),
    meta: {
      title: '串口通信'
    }
  }
]

export default routes
