<script setup lang="ts">
import type { DashboardLink } from '@/types/dashboard-links'
import { toast } from 'vue-sonner'

const props = defineProps<{ link: DashboardLink }>()
const { t } = useI18n()
const linksStore = useDashboardLinksStore()
const linksSearchStore = useDashboardLinksSearchStore()
const saving = shallowRef(false)
const visible = shallowRef(props.link.showOnHomepage ?? true)
const switchId = useId()

watch(() => props.link.showOnHomepage, value => visible.value = value ?? true)

async function setVisibility(value: boolean) {
  if (saving.value)
    return
  const previous = visible.value
  visible.value = value
  saving.value = true
  try {
    const { link } = await useAPI<{ link: DashboardLink }>('/api/link/visibility', {
      method: 'PUT',
      body: { slug: props.link.slug, id: props.link.id, showOnHomepage: value },
    })
    linksSearchStore.syncLink(link, 'edit')
    linksStore.notifyLinkUpdate(link, 'edit')
  }
  catch {
    visible.value = previous
    toast.error(t('links.visibility.save_failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="relative z-20 ml-auto flex shrink-0 items-center gap-2">
    <Label :for="switchId" class="text-xs text-muted-foreground">
      {{ $t('links.visibility.label') }}
    </Label>
    <Switch
      :id="switchId"
      :model-value="visible"
      :disabled="saving"
      :aria-busy="saving"
      :aria-label="$t('links.visibility.accessible_label', { slug: link.slug })"
      @update:model-value="setVisibility"
    />
  </div>
</template>
