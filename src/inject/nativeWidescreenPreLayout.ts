import { NATIVE_WIDESCREEN_PRE_LAYOUT_RELEASE } from '~/utils/pageSettingsProtocol'

type VideoPageWindow = Window & {
  isWide?: boolean
  setSize?: () => void
}

const WIDE_PLAYER_SELECTOR = '[data-screen="wide"]'
/** 内容脚本失效时的兜底，只在页面可见后计时：后台标签页里播放器不会初始化。 */
const SAFETY_RELEASE_DELAY = 20_000
const APPLIED_POLL_INTERVAL = 50
const APPLIED_POLL_LIMIT = 40

/**
 * B 站视频页的内联脚本用 `window.isWide` 决定 `setSize()` 写出普通还是宽屏排版，
 * 首次调用发生在解析 <head> 时，播放器真正进入宽屏则要等到页面加载完成之后。
 * 这里在 document_start 把 isWide 固定为 true，骨架屏和播放器容器从第一帧起就
 * 按宽屏排版；期间页面按播放器真实状态写入的值只记录、不生效，避免中途退回
 * 普通排版。内容脚本点击宽屏按钮（或放弃应用）后解除固定，交还给 B 站。
 */
export function installNativeWidescreenPreLayout() {
  const pageWindow = window as VideoPageWindow
  let pinned = true
  let pageValue = false
  let safetyTimer: ReturnType<typeof setTimeout> | undefined
  let appliedPollTimer: ReturnType<typeof setTimeout> | undefined

  try {
    Object.defineProperty(pageWindow, 'isWide', {
      configurable: true,
      enumerable: true,
      get: () => pinned || pageValue,
      set: (value: unknown) => {
        pageValue = !!value
      },
    })
  }
  catch {
    return
  }

  function release() {
    if (!pinned)
      return

    pinned = false
    clearTimeout(safetyTimer)
    clearTimeout(appliedPollTimer)
    window.removeEventListener('message', handleMessage)
    document.removeEventListener('visibilitychange', armSafetyRelease)

    // B 站可能还没监听到播放器的宽屏切换，以播放器当前状态补齐。
    const isWide = pageValue || !!document.querySelector(WIDE_PLAYER_SELECTOR)
    try {
      Object.defineProperty(pageWindow, 'isWide', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: isWide,
      })
      pageWindow.setSize?.()
    }
    catch {
      // 排版交还失败时保持现状，下一次窗口尺寸变化仍会触发 setSize。
    }
  }

  // 点击宽屏按钮后播放器稍后才写入 data-screen；等它生效再交还，避免先退回普通排版。
  function releaseWhenApplied(attempt = 0) {
    if (!pinned)
      return
    if (document.querySelector(WIDE_PLAYER_SELECTOR) || attempt >= APPLIED_POLL_LIMIT) {
      release()
      return
    }
    appliedPollTimer = setTimeout(() => releaseWhenApplied(attempt + 1), APPLIED_POLL_INTERVAL)
  }

  function handleMessage(event: MessageEvent) {
    if (event.source !== window || typeof event.data !== 'object' || event.data === null
      || event.data.type !== NATIVE_WIDESCREEN_PRE_LAYOUT_RELEASE) {
      return
    }

    if (event.data.applied === true)
      releaseWhenApplied()
    else
      release()
  }

  function armSafetyRelease() {
    if (safetyTimer === undefined && document.visibilityState === 'visible')
      safetyTimer = setTimeout(release, SAFETY_RELEASE_DELAY)
  }

  window.addEventListener('message', handleMessage)
  document.addEventListener('visibilitychange', armSafetyRelease)
  armSafetyRelease()
}
