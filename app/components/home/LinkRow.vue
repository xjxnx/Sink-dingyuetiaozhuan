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
const displayName = computed(() => props.link.title === props.link.slug
  ? `${new URL(origin).host}${path.value}`
  : props.link.title)
const { copy, copied } = useClipboard({ legacy: true })

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
  <Item variant="outline" class="flex-nowrap">
    <ItemMedia
      class="
        group-has-data-[slot=item-description]/item:translate-y-0
        group-has-data-[slot=item-description]/item:self-center
      "
    >
      <Avatar size="lg">
        <AvatarImage :src="linkIcon" alt="" loading="lazy" />
        <AvatarFallback>
          <img src="/icon.png" alt="" loading="lazy" width="40" height="40">
        </AvatarFallback>
      </Avatar>
    </ItemMedia>
    <ItemContent class="min-w-0 flex-row items-center gap-6">
      <h3 class="min-w-0">
        <Button as-child variant="link" class="max-w-full justify-start">
          <a :href="path" :title="displayName" :aria-label="$t('home.directory.open_label', { name: displayName })">
            <span class="truncate">{{ displayName }}</span>
          </a>
        </Button>
      </h3>
      <ItemDescription
        v-if="link.description" class="max-w-2/5 shrink-0 truncate" :title="link.description"
      >
        {{ link.description }}
      </ItemDescription>
    </ItemContent>
    <ItemActions class="shrink-0 gap-0">
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
          <DashboardLinksQRCode :data="shortLink" :image="linkIcon" />
        </PopoverContent>
      </Popover>
    </ItemActions>
  </Item>
</template>
