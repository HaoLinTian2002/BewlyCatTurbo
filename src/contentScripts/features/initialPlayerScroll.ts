import { getPlayerScrollTarget } from '~/utils/player'

/** 页面一直没有应用播放器模式时的上限，从第一帧可见画面开始计。 */
const ALIGNMENT_TIME_LIMIT = 10_000
/** 播放器模式应用后控件还会补齐一小段排版，继续跟随这段时间再结束。 */
const SETTLE_GRACE = 1200

export interface InitialPlayerScrollAlignment {
  /** 播放器模式已经应用，稍后结束对齐。 */
  settle: () => void
  cancel: () => void
}

/**
 * 页面加载之初就把播放器放到「调整显示模式后滚动」设置的位置，并在加载期间
 * 跟随排版变化即时修正，取代「模式应用 1 秒后再平滑滚动一次」。
 * 滚动位置一旦被用户或页面改动（滚轮、拖动滚动条、浏览器恢复滚动位置）就停止，
 * 不与之争抢。
 */
export function startInitialPlayerScrollAlignment(): InitialPlayerScrollAlignment {
  let stopped = false
  let frame: number | undefined
  let deadline: number | undefined
  let expectedScrollY: number | undefined

  function cancel() {
    stopped = true
    if (frame !== undefined)
      cancelAnimationFrame(frame)
    frame = undefined
  }

  function tick() {
    frame = undefined
    if (stopped)
      return

    const now = Date.now()
    deadline ??= now + ALIGNMENT_TIME_LIMIT
    if (now >= deadline
      || (expectedScrollY !== undefined && Math.abs(window.scrollY - expectedScrollY) >= 1)) {
      cancel()
      return
    }

    const target = getPlayerScrollTarget()
    if (target !== null && Math.abs(window.scrollY - target) >= 1)
      window.scrollTo({ top: target, behavior: 'instant' })
    // 文档还没解析到足够高度时滚动会被截断，以实际位置为准，下一帧继续。
    expectedScrollY = window.scrollY
    frame = requestAnimationFrame(tick)
  }

  frame = requestAnimationFrame(tick)

  return {
    settle: () => {
      deadline = Math.min(deadline ?? Number.POSITIVE_INFINITY, Date.now() + SETTLE_GRACE)
    },
    cancel,
  }
}
