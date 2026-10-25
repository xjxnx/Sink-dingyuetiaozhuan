<script setup lang="ts">
import type { PublicLinksResponse } from '#shared/types/public-link'
import { ArrowDown, Link, LoaderCircle, RefreshCw } from '@lucide/vue'

const { data, status, error, refresh } = await useFetch<PublicLinksResponse>('/_public/links', {
  key: 'home-link-directory',
  server: false,
  lazy: true,
})
const morePending = ref(false)
const moreError = ref(false)

async function loadMore() {
  if (!data.value?.cursor || morePending.value)
    return

  morePending.value = true
  moreError.value = false
  try {
    const next = await $fetch<PublicLinksResponse>('/_public/links', { query: { cursor: data.value.cursor } })
    const existing = new Set(data.value.links.map(link => link.slug))
    data.value = { ...next, links: [...data.value.links, ...next.links.filter(link => !existing.has(link.slug))] }
  }
  catch {
    moreError.value = true
  }
  finally {
    morePending.value = false
  }
}
</script>

<template>
  <section
    aria-labelledby="link-directory-title"
    class="
      py-12
      md:py-20
    "
  >
    <div
      class="
        mx-auto max-w-5xl space-y-5 px-6
        sm:space-y-6
      "
    >
      <header class="space-y-2">
        <h2
          id="link-directory-title" class="
            text-xl font-semibold
            sm:text-2xl
          "
        >
          {{ $t('home.directory.label') }}
        </h2>
        <p class="text-sm/relaxed text-muted-foreground">
          {{ $t('home.directory.subtitle') }}
        </p>
      </header>

      <div v-if="status === 'pending' && !data" class="space-y-3" role="status">
        <span class="sr-only">{{ $t('home.directory.loading') }}</span>
        <Item
          v-for="index in 4" :key="index" variant="outline" class="flex-nowrap" aria-hidden="true"
        >
          <ItemMedia variant="image">
            <Skeleton class="size-10" />
          </ItemMedia>
          <ItemContent class="min-w-0">
            <Skeleton class="h-5 w-1/2" />
          </ItemContent>
          <ItemActions>
            <Skeleton class="h-9 w-24" />
          </ItemActions>
        </Item>
      </div>

      <Empty v-else-if="error || !data?.links.length" role="status">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Link aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{{ $t(error ? 'home.directory.error_title' : 'home.directory.empty_title') }}</EmptyTitle>
          <EmptyDescription>
            {{ $t(error ? 'home.directory.error_description' : 'home.directory.empty_description') }}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent v-if="error">
          <Button variant="outline" @click="refresh()">
            <RefreshCw aria-hidden="true" />
            {{ $t('home.directory.retry') }}
          </Button>
        </EmptyContent>
      </Empty>

      <div v-else class="space-y-8">
        <ul class="space-y-3">
          <li v-for="link in data.links" :key="link.slug">
            <HomeLinkRow :link="link" />
          </li>
        </ul>

        <div v-if="!data.list_complete" class="flex flex-col items-center gap-3">
          <p v-if="moreError" class="text-sm text-muted-foreground" role="alert">
            {{ $t('home.directory.error_description') }}
          </p>
          <Button variant="outline" :disabled="morePending" @click="loadMore">
            <LoaderCircle
              v-if="morePending" class="
                animate-spin
                motion-reduce:animate-none
              " aria-hidden="true"
            />
            <ArrowDown v-else aria-hidden="true" />
            {{ $t(morePending ? 'home.directory.loading' : moreError ? 'home.directory.retry' : 'home.directory.more') }}
          </Button>
        </div>
      </div>
    </div>
  </section>
</template>
