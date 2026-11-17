import { isVideoOrBangumiPage } from '~/utils/main'

const COMMENTS_PENDING_CLASS = 'bewly-video-comments-pending'
const COMMENT_ROOT_SELECTOR = '#commentapp'
const SHADOW_ROOT_RETRY_INTERVAL = 300
const SHADOW_ROOT_RETRY_LIMIT = 10

/**
 * B 站视频页给左右两栏都加了 sticky：某一栏滚到底后吸附住，让更长的一栏继续滚动。
 * 评论区是懒加载的，加载完成前左栏只有播放器、工具栏和简介，稍微下滑就被判定为
 * 「已到底」而吸附，表现为只有右侧推荐列表在滚动；评论渲染出来后左栏又突然松开。
 * 评论首屏渲染前先不让左栏吸附，页面保持整体滚动。
 */
export function setupVideoStickyScrollGuard() {
  let commentRoot: Element | null = null
  let comments: Element | null = null
  let shadowRootRetries = 0
  let shadowRootRetryTimer: ReturnType<typeof setTimeout> | undefined
  const rootObserver = new MutationObserver(sync)
  const commentsObserver = new MutationObserver(sync)

  function isCommentsRendered(root: Element) {
    const current = root.querySelector('bili-comments')
    if (current !== comments) {
      comments = current
      shadowRootRetries = 0
      commentsObserver.disconnect()
    }

    // 旧版评论组件直接渲染在容器里，有内容即视为已渲染。
    if (!comments)
      return root.childElementCount > 0

    const shadowRoot = comments.shadowRoot
    if (!shadowRoot) {
      // 自定义元素升级前还没有 shadowRoot，也不会触发容器的 childList 变化。
      if (shadowRootRetries < SHADOW_ROOT_RETRY_LIMIT) {
        shadowRootRetries++
        clearTimeout(shadowRootRetryTimer)
        shadowRootRetryTimer = setTimeout(sync, SHADOW_ROOT_RETRY_INTERVAL)
      }
      return false
    }

    // 加载中只渲染 spinner；首屏数据返回后才渲染 #contents。切换视频重载评论时
    // #contents 会被移除，状态随之回到「未渲染」。
    commentsObserver.observe(shadowRoot, { childList: true })
    return !!shadowRoot.querySelector('#contents')
  }

  function sync() {
    const root = document.documentElement
    if (!commentRoot?.isConnected) {
      rootObserver.disconnect()
      commentsObserver.disconnect()
      comments = null
      commentRoot = isVideoOrBangumiPage() ? document.querySelector(COMMENT_ROOT_SELECTOR) : null
      if (commentRoot)
        rootObserver.observe(commentRoot, { childList: true })
    }

    const pending = !!commentRoot && !isCommentsRendered(commentRoot)
    if (pending === root.classList.contains(COMMENTS_PENDING_CLASS))
      return

    if (pending) {
      root.classList.add(COMMENTS_PENDING_CLASS)
      return
    }

    // B 站只在 scroll 事件里更新吸附位置。先让它按评论渲染后的左栏高度重算，
    // 再放开吸附，避免沿用左栏还很短时算出的 top。
    window.dispatchEvent(new Event('scroll'))
    root.classList.remove(COMMENTS_PENDING_CLASS)
  }

  const scheduleSync = () => queueMicrotask(sync)
  for (const eventName of ['pushstate', 'replacestate', 'popstate', 'pageshow'])
    window.addEventListener(eventName, scheduleSync, true)

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', sync, { once: true })
  else
    sync()
}
