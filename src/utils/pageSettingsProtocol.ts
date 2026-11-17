import { stripBilibiliLocalePathname } from './bilibiliLocale'

export type PageCommentReplyTreeMode = 'lineCollapseMain' | 'lineKeepMain' | 'indentOnly'
export type PageCommentReplyPaginationMode = 'loadMore' | 'pagination'

/** Minimal settings payload shared with the page's main-world script. */
export interface PageSettingsPayload {
  localLoudnessEnabled: boolean
  localLoudnessTarget: number
  localLoudnessStrength: number
  /** 音画同步关闭时，页面脚本不接管声音做延后。 */
  audioDelayEnabled: boolean
  /** 收藏夹整理需要在三连后同步时，页面脚本才监听三连请求。 */
  observeTripleRequests: boolean
  adjustCommentImageHeight: boolean
  cleanShareLinkIncludeTitle: boolean
  cleanShareLinkRemoveTrackingParams: boolean
  commentReplyPaginationMode: PageCommentReplyPaginationMode
  commentReplyTreeContainerHeight: number
  commentReplyTreeMode: PageCommentReplyTreeMode
  depersonalizeSearchResults: boolean
  enableCleanShareLink: boolean
  enableCommentReplyTreeContainer: boolean
  enableCommentReplyTreeDisplay: boolean
  language: string
  /** 普通视频页默认使用原生宽屏：页面脚本在 document_start 提前按宽屏排版。 */
  preApplyNativeWidescreen: boolean
  preventMobileRedirect: boolean
  showCommentHostTag: boolean
  showIPLocation: boolean
  showSex: boolean
  skipConciseDanmaku: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCommentReplyTreeMode(value: unknown): value is PageCommentReplyTreeMode {
  return value === 'lineCollapseMain' || value === 'lineKeepMain' || value === 'indentOnly'
}

function isCommentReplyPaginationMode(value: unknown): value is PageCommentReplyPaginationMode {
  return value === 'loadMore' || value === 'pagination'
}

function isCommentReplyTreeContainerHeight(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * /video/ 页在文档开始时还分不清分 P 与合集，只有这些场景都沿用原生宽屏时才能提前排版。
 */
function prefersNativeWidescreenOnVideoPage(value: Record<string, unknown>): boolean {
  if (value.defaultVideoPlayerMode !== 'widescreen')
    return false
  if (value.enableVideoPlayerModeOverrides !== true)
    return true

  const overrides = isRecord(value.videoPlayerModeOverrides) ? value.videoPlayerModeOverrides : {}
  return ['multipart', 'collection'].every((context) => {
    const override = overrides[context]
    return override === undefined || override === 'inherit' || override === 'widescreen'
  })
}

export function createPageSettingsPayload(value: unknown): PageSettingsPayload | null {
  if (!isRecord(value)
    || typeof value.adjustCommentImageHeight !== 'boolean'
    || typeof value.cleanShareLinkIncludeTitle !== 'boolean'
    || typeof value.cleanShareLinkRemoveTrackingParams !== 'boolean'
    || !isCommentReplyPaginationMode(value.commentReplyPaginationMode)
    || !isCommentReplyTreeContainerHeight(value.commentReplyTreeContainerHeight)
    || !isCommentReplyTreeMode(value.commentReplyTreeMode)
    || typeof value.depersonalizeSearchResults !== 'boolean'
    || typeof value.enableCleanShareLink !== 'boolean'
    || typeof value.enableCommentReplyTreeContainer !== 'boolean'
    || typeof value.enableCommentReplyTreeDisplay !== 'boolean'
    || typeof value.language !== 'string'
    || typeof value.preventMobileRedirect !== 'boolean'
    || typeof value.showCommentHostTag !== 'boolean'
    || typeof value.showIPLocation !== 'boolean'
    || typeof value.showSex !== 'boolean') {
    return null
  }

  // 页面脚本校验已转换的 payload 时没有总开关字段，此时子项已按总开关计算过。
  const commentsEnabled = value.enableCommentEnhancements !== false
  const playerEnabled = value.enablePlayerEnhancements !== false

  return {
    localLoudnessEnabled: playerEnabled && value.localLoudnessEnabled === true,
    localLoudnessTarget: typeof value.localLoudnessTarget === 'number' && Number.isFinite(value.localLoudnessTarget)
      ? Math.max(-24, Math.min(-14, value.localLoudnessTarget))
      : -18,
    localLoudnessStrength: typeof value.localLoudnessStrength === 'number' && Number.isFinite(value.localLoudnessStrength)
      ? Math.max(40, Math.min(100, value.localLoudnessStrength))
      : 75,
    // 页面脚本会再次校验已转换的 payload，此时直接沿用字段。
    audioDelayEnabled: playerEnabled && (value.audioDelayEnabled === true || value.playerAudioDelayEnabled === true),
    observeTripleRequests: value.observeTripleRequests === true
      || (value.favoriteOrganizerSyncAfterTriple === true
        && Array.isArray(value.favoriteOrganizerFolders)
        && value.favoriteOrganizerFolders.length > 0),
    adjustCommentImageHeight: commentsEnabled && value.adjustCommentImageHeight,
    cleanShareLinkIncludeTitle: value.cleanShareLinkIncludeTitle,
    cleanShareLinkRemoveTrackingParams: value.cleanShareLinkRemoveTrackingParams,
    commentReplyPaginationMode: value.commentReplyPaginationMode,
    commentReplyTreeContainerHeight: value.commentReplyTreeContainerHeight,
    commentReplyTreeMode: value.commentReplyTreeMode,
    depersonalizeSearchResults: value.depersonalizeSearchResults,
    enableCleanShareLink: value.enableCleanShareLink,
    enableCommentReplyTreeContainer: commentsEnabled && value.enableCommentReplyTreeContainer,
    enableCommentReplyTreeDisplay: commentsEnabled && value.enableCommentReplyTreeDisplay,
    language: value.language,
    // 页面脚本再次校验已转换的 payload 时直接沿用字段。
    preApplyNativeWidescreen: playerEnabled
      && (value.preApplyNativeWidescreen === true || prefersNativeWidescreenOnVideoPage(value)),
    preventMobileRedirect: value.preventMobileRedirect,
    showCommentHostTag: commentsEnabled && value.showCommentHostTag,
    showIPLocation: commentsEnabled && value.showIPLocation,
    showSex: commentsEnabled && value.showSex,
    skipConciseDanmaku: playerEnabled && value.skipConciseDanmaku !== false,
  }
}

/**
 * 页面启动快照：主站 localStorage 中保存决定 document_start 钩子是否安装的开关。
 * 页面脚本启动时设置尚未送达，只能同步读取上一次加载写入的值；
 * 快照缺失或无法读取时调用方按默认行为处理，不能据此跳过默认开启的功能。
 */
export interface PageBootSnapshot {
  preApplyNativeWidescreen: boolean
  preventMobileRedirect: boolean
  skipConciseDanmaku: boolean
}

const PAGE_BOOT_SNAPSHOT_KEY = 'bewlycat:page-boot'

export function readPageBootSnapshot(): Partial<PageBootSnapshot> | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PAGE_BOOT_SNAPSHOT_KEY) ?? 'null')
    if (!isRecord(value))
      return null
    return {
      preApplyNativeWidescreen: typeof value.preApplyNativeWidescreen === 'boolean' ? value.preApplyNativeWidescreen : undefined,
      preventMobileRedirect: typeof value.preventMobileRedirect === 'boolean' ? value.preventMobileRedirect : undefined,
      skipConciseDanmaku: typeof value.skipConciseDanmaku === 'boolean' ? value.skipConciseDanmaku : undefined,
    }
  }
  catch {
    return null
  }
}

export function writePageBootSnapshot(settings: PageSettingsPayload) {
  const snapshot: PageBootSnapshot = {
    preApplyNativeWidescreen: settings.preApplyNativeWidescreen,
    preventMobileRedirect: settings.preventMobileRedirect,
    skipConciseDanmaku: settings.skipConciseDanmaku,
  }
  try {
    const value = JSON.stringify(snapshot)
    if (localStorage.getItem(PAGE_BOOT_SNAPSHOT_KEY) !== value)
      localStorage.setItem(PAGE_BOOT_SNAPSHOT_KEY, value)
  }
  catch {
    // 存储不可用时下次加载按默认行为安装钩子
  }
}

/** 内容脚本通知页面脚本结束宽屏预排版；applied 表示已点击原生宽屏按钮。 */
export const NATIVE_WIDESCREEN_PRE_LAYOUT_RELEASE = 'BEWLY_NATIVE_WIDESCREEN_PRE_LAYOUT_RELEASE'

/**
 * 当前文档是否在加载之初就按原生宽屏排版。页面脚本与内容脚本各自在启动时
 * 同步调用，读到的是同一份快照，结论一致。
 * 仅限顶层窗口的普通视频页：抽屉与弹窗 iframe 有各自的显示模式覆盖。
 */
export function shouldPreApplyNativeWidescreen(snapshot: Partial<PageBootSnapshot> | null): boolean {
  if (snapshot?.preApplyNativeWidescreen !== true)
    return false

  try {
    return window === window.top
      && location.hostname === 'www.bilibili.com'
      && stripBilibiliLocalePathname(location.pathname).startsWith('/video/')
  }
  catch {
    return false
  }
}
