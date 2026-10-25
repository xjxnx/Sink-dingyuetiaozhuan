<script setup lang="ts">
import type { DashboardLink } from '@/types/dashboard-links'
import { Pin } from '@lucide/vue'
import { toast } from 'vue-sonner'

const props = defineProps<{ link: DashboardLink }>()
const { t } = useI18n()
const linksStore = useDashboardLinksStore()
const linksSearchStore = useDashboardLinksSearchStore()
const saving = shallowRef(false)
const pinned = computed(() => props.link.pinned ?? false)

async function togglePin() {
  if (saving.value)
    return
  saving.value = true
  try {
    const { link } = await useAPI<{ link: DashboardLink }>('/api/link/pin', {
      method: 'PUT',
      body: { slug: props.link.slug, id: props.link.id, pinned: !pinned.value },
    })
    linksSearchStore.syncLink(link, 'edit')
    linksStore.notifyLinkUpdate(link, 'edit')
    await refreshNuxtData('home-link-directory')
  }
  catch {
    toast.error(t('links.pin.save_failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <Button
    class="relative z-20 shrink-0"
    :variant="pinned ? 'default' : 'ghost'"
    size="icon-sm"
    :disabled="saving"
    :aria-busy="saving"
    :aria-pressed="pinned"
    :title="$t(pinned ? 'links.pin.unpin' : 'links.pin.pin')"
    :aria-label="$t(pinned ? 'links.pin.unpin_label' : 'links.pin.pin_label', { slug: link.slug })"
    @click="togglePin"
  >
    <Pin aria-hidden="true" />
  </Button>
</template>
