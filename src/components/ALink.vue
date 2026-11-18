<script lang="ts" setup>
import { useBewlyApp } from '~/composables/useAppProvider'
import { settings } from '~/logic'
import { isActualHomepage, isHomePage, isInIframe } from '~/utils/main'
import { openLinkInBackground } from '~/utils/tabs'

const props = defineProps<{
  href?: string
  title?: string
  rel?: string
  type: 'topBar' | 'videoCard' | 'searchBar'
  customClickEvent?: boolean
  customClickEventIncludesModifiers?: boolean
  stopPropagation?: boolean
  disableDragging?: boolean
}>()

const emit = defineEmits<{
  /** 每次点击都会触发，包括修饰键和由浏览器原生打开的情况。 */
  (e: 'activate', value: MouseEvent): void
  /** 仅在 customClickEvent 接管打开行为时触发。 */
  (e: 'click', value: MouseEvent): void
}>()

const { openIframeDrawer, openVideoDialog } = useBewlyApp()

const processedHref = computed(() => {
  if (!props.href)
    return 'javascript:void(0)'

  return props.href
})

const openMode = computed(() => {
  if (props.type === 'topBar')
    return settings.value.topBarLinkOpenMode
  else if (props.type === 'videoCard')
    return settings.value.videoCardLinkOpenMode
  else if (props.type === 'searchBar')
    return settings.value.searchBarLinkOpenMode
  return 'newTab'
})

// Since BewlyBewly sometimes uses an iframe to open the original Bilibili page in the current tab
// please set the target to `_top` instead of `_self`
function getTarget() {
  if (openMode.value === 'newTab') {
    return '_blank'
  }
  if (openMode.value === 'currentTabIfNotHomepage') {
    // When in iframe, treat as homepage by default
    if (isInIframe()) {
      return '_blank'
    }
    return isHomePage() ? '_blank' : '_top'
  }
  if (openMode.value === 'currentTabIfHomepage') {
    return isActualHomepage() ? '_top' : '_blank'
  }
  if (openMode.value === 'currentTab') {
    return '_top'
  }
  return '_top'
}

function handleClick(event: MouseEvent) {
  // Dock navigation can change the URL without remounting this link.
  const link = event.currentTarget as HTMLAnchorElement
  link.target = getTarget()

  if (props.stopPropagation) {
    event.stopPropagation()
  }

  emit('activate', event)

  if (props.customClickEvent) {
    if (!props.customClickEventIncludesModifiers && (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey))
      return

    event.preventDefault()
    emit('click', event)
    return
  }

  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
    return

  if (openMode.value === 'drawer') {
    event.preventDefault()
    if (props.href) {
      openIframeDrawer(processedHref.value)
    }
    return
  }

  if (openMode.value === 'dialog') {
    event.preventDefault()
    if (props.href) {
      openVideoDialog(processedHref.value)
    }
    return
  }

  if (openMode.value === 'background' && props.href) {
    event.preventDefault()
    openLinkInBackground(processedHref.value)
  }
}
</script>

<template>
  <a
    :href="processedHref"
    :target="getTarget()"
    :title="title"
    :rel="rel"
    :draggable="disableDragging ? false : undefined"
    @click="handleClick"
  >
    <slot />
  </a>
</template>
