<script setup lang="ts">
import type { LinkUpdateType } from '@/types'
import type { DashboardLink, DashboardLinkListResponse } from '@/types/dashboard-links'
import { AlertCircle, GripVertical, Inbox, LoaderCircle } from '@lucide/vue'
import { useInfiniteScroll } from '@vueuse/core'
import { toast } from 'vue-sonner'

const linksStore = useDashboardLinksStore()
const { t } = useI18n()
const { previewMode } = useRuntimeConfig().public

const links = ref<DashboardLink[]>([])
const listComplete = ref(false)
const listError = ref(false)
const listLoading = ref(false)
const limit = 24
let cursor = ''
let requestGeneration = 0
let nextPageLimit = limit
let replaceOnLoad = false
const savingOrder = ref(false)
const draggedSlug = ref<string>()
const dropTargetSlug = ref<string>()
const isManualOrder = computed(() => linksStore.sortBy === 'manual')
const canReorder = computed(() => isManualOrder.value && !previewMode && !savingOrder.value && !listLoading.value)

const { countersMap, counterErrorIds, fetchCounters, resetCounters } = useLinkCounters()
provide(LINKS_COUNTERS_MAP_KEY, countersMap)
provide(LINKS_COUNTER_ERROR_IDS_KEY, counterErrorIds)
provide(RETRY_LINK_COUNTERS_KEY, (id: string) => void fetchCounters([id]))

const scrollContainer = shallowRef<HTMLElement | null>(null)

onMounted(() => {
  scrollContainer.value = document.getElementById('dashboard-main')
  void getLinks()
})

async function getLinks() {
  if (listLoading.value || listComplete.value || savingOrder.value)
    return

  const generation = requestGeneration
  const requestCursor = cursor
  const replace = replaceOnLoad
  listLoading.value = true
  try {
    const data = await useAPI<DashboardLinkListResponse>('/api/link/list', {
      query: {
        limit: nextPageLimit,
        cursor: requestCursor,
        sort: linksStore.sortBy,
        status: linksStore.status,
        tag: linksStore.tag,
      },
    })

    if (generation !== requestGeneration)
      return

    const newLinks = data.links.filter(Boolean)
    const existingSlugs = new Set(links.value.map(link => link.slug))
    links.value = replace ? newLinks : links.value.concat(newLinks.filter(link => !existingSlugs.has(link.slug)))
    replaceOnLoad = false
    nextPageLimit = limit
    cursor = data.cursor
    listComplete.value = data.list_complete
    listError.value = false

    const ids = newLinks.map(l => l.id).filter(id => !countersMap.value[id])
    void fetchCounters(ids)
  }
  catch (error) {
    if (generation !== requestGeneration)
      return
    console.error(error)
    listError.value = true
  }
  finally {
    if (generation === requestGeneration)
      listLoading.value = false
  }
}

async function resetAndLoad(keepVisible = false) {
  endDrag()
  requestGeneration++
  nextPageLimit = keepVisible ? Math.min(1000, Math.max(limit, links.value.length)) : limit
  replaceOnLoad = keepVisible
  if (!keepVisible) {
    links.value = []
    resetCounters()
  }
  cursor = ''
  listComplete.value = false
  listError.value = false
  listLoading.value = false
  await getLinks()
}

function endDrag() {
  draggedSlug.value = undefined
  dropTargetSlug.value = undefined
}

function startDrag(event: DragEvent, link: DashboardLink) {
  if (!canReorder.value || !event.dataTransfer) {
    event.preventDefault()
    return
  }
  draggedSlug.value = link.slug
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', link.slug)
  const card = (event.currentTarget as HTMLElement).closest('[data-reorder-card]')
  if (card instanceof HTMLElement)
    event.dataTransfer.setDragImage(card, 24, 24)
}

function dragOver(event: DragEvent, link: DashboardLink) {
  if (!canReorder.value || !draggedSlug.value || draggedSlug.value === link.slug)
    return
  event.preventDefault()
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = 'move'
  dropTargetSlug.value = link.slug
}

function dragLeave(event: DragEvent, link: DashboardLink) {
  if (event.relatedTarget instanceof Node && (event.currentTarget as HTMLElement).contains(event.relatedTarget))
    return
  if (dropTargetSlug.value === link.slug)
    dropTargetSlug.value = undefined
}

function dropLink(event: DragEvent, target: DashboardLink) {
  if (!draggedSlug.value)
    return
  event.preventDefault()
  const source = links.value.find(link => link.slug === draggedSlug.value)
  endDrag()
  if (source)
    void moveLink(source, target)
}

async function moveLink(source: DashboardLink, target: DashboardLink) {
  if (!canReorder.value || source.slug === target.slug)
    return
  if (Boolean(source.pinned) !== Boolean(target.pinned)) {
    toast(t('links.reorder.pinned_group'))
    return
  }

  const sourceIndex = links.value.findIndex(link => link.slug === source.slug)
  const targetIndex = links.value.findIndex(link => link.slug === target.slug)
  if (sourceIndex < 0 || targetIndex < 0)
    return

  savingOrder.value = true
  const generation = requestGeneration
  const originalOrder = new Map(links.value.map((link, index) => [link.slug, index]))
  links.value.splice(sourceIndex, 1)
  links.value.splice(targetIndex, 0, source)
  try {
    await useAPI('/api/link/reorder', {
      method: 'PUT',
      body: {
        slug: source.slug,
        id: source.id,
        targetSlug: target.slug,
        targetId: target.id,
        placement: sourceIndex < targetIndex ? 'after' : 'before',
      },
    })
    toast(t('links.reorder.saved'))
    void refreshNuxtData('home-link-directory')
  }
  catch (error) {
    if (generation === requestGeneration)
      links.value.sort((a, b) => (originalOrder.get(a.slug) ?? Infinity) - (originalOrder.get(b.slug) ?? Infinity))
    console.error(error)
    toast.error(t('links.reorder.save_failed'))
  }
  finally {
    savingOrder.value = false
    // Reordering invalidates the old pagination boundary; reload before appending.
    await resetAndLoad(generation === requestGeneration)
    await nextTick()
    document.getElementById(`link-reorder-${source.slug}`)?.focus({ preventScroll: true })
  }
}

function reorderWithKeyboard(event: KeyboardEvent, link: DashboardLink) {
  const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key)
    ? -1
    : ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : 0
  if (!direction)
    return
  event.preventDefault()
  const index = links.value.findIndex(item => item.slug === link.slug)
  const target = links.value[index + direction]
  if (target)
    void moveLink(link, target)
}

useInfiniteScroll(
  scrollContainer,
  getLinks,
  {
    distance: 0,
    interval: 1000,
    canLoadMore: () => {
      return !listError.value && !listComplete.value
    },
  },
)

watch(
  [() => linksStore.sortBy, () => linksStore.status, () => linksStore.tag],
  () => void resetAndLoad(),
)

function matchesCurrentFilters(link: DashboardLink) {
  const isExpired = Boolean(link.expiration && link.expiration <= Math.floor(Date.now() / 1000))
  return (linksStore.status === 'expired') === isExpired
    && (!linksStore.tag || link.tags?.includes(linksStore.tag))
}

function updateLinkList(link: DashboardLink, type: LinkUpdateType) {
  if (type === 'edit') {
    const index = links.value.findIndex(l => l.slug === link.slug)
    if (isManualOrder.value && index >= 0 && Boolean(links.value[index]?.pinned) !== Boolean(link.pinned)) {
      void resetAndLoad()
      return
    }
    if (index >= 0 && matchesCurrentFilters(link))
      links.value[index] = link
    else if (index >= 0)
      links.value.splice(index, 1)
  }
  else if (type === 'delete') {
    const index = links.value.findIndex(l => l.slug === link.slug)
    if (index >= 0)
      links.value.splice(index, 1)
  }
  else {
    if (!matchesCurrentFilters(link))
      return

    if (isManualOrder.value) {
      void resetAndLoad()
      return
    }

    if (linksStore.sortBy !== 'newest') {
      linksStore.sortBy = 'newest'
      return
    }

    links.value = [link, ...links.value.filter(item => item.slug !== link.slug)]
  }
}

linksStore.onLinkUpdate(({ link, type }) => {
  updateLinkList(link, type)
})
</script>

<template>
  <p
    v-if="isManualOrder && links.length && !previewMode" class="
      text-sm text-muted-foreground
    "
  >
    {{ $t('links.reorder.hint') }}
  </p>
  <section
    v-if="links.length"
    class="
      grid grid-cols-1 gap-4
      md:grid-cols-2
      lg:grid-cols-3
    "
  >
    <div
      v-for="link in links"
      :key="link.slug"
      data-reorder-card
      class="min-w-0 rounded-2xl"
      :class="{ 'opacity-50': draggedSlug === link.slug, 'ring-2 ring-ring': dropTargetSlug === link.slug }"
      @dragover="dragOver($event, link)"
      @dragleave="dragLeave($event, link)"
      @drop="dropLink($event, link)"
    >
      <DashboardLinksLink :link="link">
        <template v-if="isManualOrder && !previewMode" #reorder-handle>
          <Button
            :id="`link-reorder-${link.slug}`"
            type="button"
            variant="ghost"
            size="icon-sm"
            class="
              relative z-20 shrink-0 cursor-grab
              active:cursor-grabbing
            "
            :draggable="canReorder"
            :disabled="!canReorder"
            :aria-label="$t('links.reorder.handle', { slug: link.slug })"
            :title="$t('links.reorder.handle', { slug: link.slug })"
            @dragstart="startDrag($event, link)"
            @dragend="endDrag"
            @keydown="reorderWithKeyboard($event, link)"
          >
            <GripVertical aria-hidden="true" />
          </Button>
        </template>
      </DashboardLinksLink>
    </div>
  </section>
  <section
    v-else-if="listLoading"
    class="
      grid grid-cols-1 gap-4
      md:grid-cols-2
      lg:grid-cols-3
    "
    role="status"
    aria-live="polite"
  >
    <DashboardLinksLinkSkeleton v-for="index in 6" :key="index" />
    <span class="sr-only">{{ $t('dashboard.loading') }}</span>
  </section>
  <div
    v-if="links.length"
    class="flex min-h-14 items-center justify-center py-4"
    role="status"
    aria-live="polite"
  >
    <template v-if="listLoading">
      <LoaderCircle class="motion-safe:animate-spin" aria-hidden="true" />
      <span class="sr-only">{{ $t('dashboard.loading') }}</span>
    </template>
    <span v-else-if="listComplete" class="text-sm">
      {{ $t('links.no_more') }}
    </span>
  </div>
  <Card v-if="!listLoading && listComplete && links.length === 0">
    <CardContent
      class="
        flex min-h-48 flex-col items-center justify-center gap-3 text-center
        text-muted-foreground
      "
    >
      <Inbox class="size-8" aria-hidden="true" />
      <p class="text-sm">
        {{ $t('links.no_filtered_results') }}
      </p>
    </CardContent>
  </Card>
  <Alert
    v-if="listError"
    variant="destructive"
    class="mx-auto max-w-xl"
  >
    <AlertCircle aria-hidden="true" />
    <AlertTitle>{{ $t('links.load_failed') }}</AlertTitle>
    <AlertDescription>
      <Button variant="link" size="sm" class="text-destructive" @click="getLinks">
        {{ $t('common.try_again') }}
      </Button>
    </AlertDescription>
  </Alert>
</template>
