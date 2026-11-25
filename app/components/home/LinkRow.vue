<script setup lang="ts">
import type { PublicLink } from '#shared/types/public-link'
import { Copy, CopyCheck, Link, QrCode } from '@lucide/vue'
import { useClipboard } from '@vueuse/core'
import { toast } from 'vue-sonner'

const props = defineProps<{ link: PublicLink }>()
const { t } = useI18n()
const origin = useRequestURL().origin
const path = computed(() => `/${encodeURIComponent(props.link.slug)}`)
const shortLink = computed(() => `${origin}${path.value}`)
const linkIcon = computed(() => `/_public/link-icon?slug=${encodeURIComponent(props.link.slug)}`)
const loadedIcon = shallowRef<HTMLImageElement>()
const qrLogo = computed(() => {
  const icon = loadedIcon.value
  if (icon?.getAttribute('src') !== linkIcon.value || !icon.complete || !icon.naturalWidth || !icon.naturalHeight)
    return ''

  // Reuse the avatar pixels so the QR code never waits on another icon request.
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 96 / Math.max(icon.naturalWidth, icon.naturalHeight))
  canvas.width = Math.max(1, Math.round(icon.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(icon.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context)
    return ''

  try {
    context.drawImage(icon, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL()
  }
  catch {
    return ''
  }
})
const displayName = computed(() => props.link.title === props.link.slug
  ? `${new URL(origin).host}${path.value}`
  : props.link.title)
const { copy, copied } = useClipboard({ legacy: true })

function rememberLoadedIcon(event: Event) {
  if (event.currentTarget instanceof HTMLImageElement)
    loadedIcon.value = event.currentTarget
}

async function copyLink() {
  try {
    await copy(shortLink.value)
    toast.success(t('home.directory.copied'))
  }
  catch {
    toast.error(t('home.directory.copy_error'))
  }
}
</script>

<template>
  <Item variant="outline" class="h-full content-start gap-y-1">
    <ItemMedia>
      <Avatar size="lg">
        <AvatarImage :src="linkIcon" alt="" loading="lazy" @load="rememberLoadedIcon" />
        <AvatarFallback>
          <img src="/icon.png" alt="" loading="lazy" width="40" height="40">
        </AvatarFallback>
      </Avatar>
    </ItemMedia>
    <ItemContent class="min-w-0">
      <h3 class="font-medium">
        <a
          :href="path"
          :aria-label="$t('home.directory.open_label', { name: displayName })"
          class="
            wrap-anywhere text-primary underline-offset-4
            hover:underline
            focus-visible:underline
          "
        >
          {{ displayName }}
        </a>
      </h3>
      <ItemDescription
        v-if="link.description" class="line-clamp-none wrap-anywhere"
      >
        {{ link.description }}
      </ItemDescription>
    </ItemContent>
    <ItemActions
      class="
        shrink-0 basis-full justify-end gap-0
        @sm/link-row:basis-auto
      "
    >
      <Button
        variant="ghost"
        size="icon"
        :title="copied ? $t('home.directory.copied') : $t('home.directory.copy_label', { name: displayName })"
        :aria-label="copied ? $t('home.directory.copied') : $t('home.directory.copy_label', { name: displayName })"
        @click="copyLink"
      >
        <CopyCheck v-if="copied" aria-hidden="true" />
        <Copy v-else aria-hidden="true" />
      </Button>
      <Button as-child variant="ghost" size="icon">
        <a
          :href="path"
          :title="$t('home.directory.open_label', { name: displayName })"
          :aria-label="$t('home.directory.open_label', { name: displayName })"
        >
          <Link aria-hidden="true" />
        </a>
      </Button>
      <Popover>
        <PopoverTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            :title="$t('home.directory.qr_label', { name: displayName })"
            :aria-label="$t('home.directory.qr_label', { name: displayName })"
          >
            <QrCode aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" class="w-auto">
          <DashboardLinksQRCode :data="shortLink" :image="qrLogo" />
        </PopoverContent>
      </Popover>
    </ItemActions>
  </Item>
</template>
