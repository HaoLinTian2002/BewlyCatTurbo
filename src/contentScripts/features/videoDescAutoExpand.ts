import { watch } from 'vue'

import { settings, settingsReady } from '~/logic'
import { isVideoOrBangumiPage } from '~/utils/main'

/**
 * 自动展开期间用样式固定简介高度：B 站在组件挂载后才折叠简介，
 * 只靠点击「展开更多」会先折叠再展开，正文跟着跳动一次。
 */
const EXPANDED_CLASS = 'bewly-video-desc-expanded'
const CONTAINER_SELECTOR = '.video-desc-container'
/** 番剧等页面没有这个简介组件，不能一直监听整页的 DOM 变化。 */
const CONTAINER_WAIT_TIMEOUT = 15_000

/** 视频页默认展开视频简介；用户手动点过展开 / 收起后，当前视频交还给 B 站。 */
export function setupVideoDescAutoExpand() {
  let container: HTMLElement | null = null
  let settingsLoaded = false
  let userToggledPath: string | undefined
  let containerWaitTimer: ReturnType<typeof setTimeout> | undefined
  const containerObserver = new MutationObserver(sync)
  const pageObserver = new MutationObserver(sync)

  function isEngaged() {
    return settingsLoaded
      && settings.value.expandVideoDescByDefault
      && isVideoOrBangumiPage()
      && userToggledPath !== location.pathname
  }

  function stopWaitingForContainer() {
    pageObserver.disconnect()
    clearTimeout(containerWaitTimer)
    containerWaitTimer = undefined
  }

  function stop() {
    container = null
    containerObserver.disconnect()
    stopWaitingForContainer()
    document.documentElement.classList.remove(EXPANDED_CLASS)
  }

  function locateContainer() {
    if (container?.isConnected)
      return container

    containerObserver.disconnect()
    container = document.querySelector<HTMLElement>(CONTAINER_SELECTOR)
    if (!container) {
      // 简介尚未解析或被路由重建时，等它出现后再接管。
      if (containerWaitTimer === undefined) {
        pageObserver.observe(document.documentElement, { childList: true, subtree: true })
        containerWaitTimer = setTimeout(() => pageObserver.disconnect(), CONTAINER_WAIT_TIMEOUT)
      }
      return null
    }

    stopWaitingForContainer()
    containerObserver.observe(container, {
      attributes: true,
      attributeFilter: ['style'],
      childList: true,
      subtree: true,
    })
    // 容器被整体替换时需要重新定位。
    if (container.parentElement)
      containerObserver.observe(container.parentElement, { childList: true })
    return container
  }

  function sync() {
    if (!isEngaged()) {
      stop()
      return
    }

    document.documentElement.classList.add(EXPANDED_CLASS)
    const current = locateContainer()
    if (!current)
      return

    // B 站折叠时给正文写入像素高度并渲染切换按钮；点一次让它自己的状态
    // 变为「已展开」，按钮文案与字幕制作者列表才会一并同步。
    const desc = current.querySelector<HTMLElement>('.basic-desc-info')
    const toggle = current.querySelector<HTMLElement>('.toggle-btn')
    if (desc && toggle && desc.style.height.endsWith('px'))
      toggle.click()
  }

  document.addEventListener('click', (event) => {
    if (!event.isTrusted || !(event.target instanceof Element))
      return
    if (!event.target.closest(`${CONTAINER_SELECTOR} .toggle-btn`))
      return

    // 先撤掉样式，B 站随后的收起才能真正生效。
    userToggledPath = location.pathname
    stop()
  }, true)

  // inject/index.ts 在 history 方法执行前派发事件，等 URL 更新后再检查。
  const scheduleSync = () => queueMicrotask(() => {
    // 每次导航重新给一段等待时间。
    stopWaitingForContainer()
    sync()
  })
  for (const eventName of ['pushstate', 'replacestate', 'popstate', 'pageshow'])
    window.addEventListener(eventName, scheduleSync, true)

  void settingsReady.then(() => {
    settingsLoaded = true
    sync()
    watch(() => settings.value.expandVideoDescByDefault, sync)
  })
}
