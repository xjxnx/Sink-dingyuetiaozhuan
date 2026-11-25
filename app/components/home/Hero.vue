<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import { GitHubIcon, XIcon } from 'vue3-simple-icons'
import heroUrl from '@/assets/images/hero.svg?url'

const { title, description, github, twitter } = useAppConfig()
</script>

<template>
  <section
    class="
      grid items-center
      md:grid-cols-2 md:gap-8
      lg:gap-12
    "
  >
    <div class="max-w-lg min-w-0">
      <!-- Twitter Follow Badge -->
      <a
        v-if="twitter"
        :href="twitter"
        target="_blank"
        rel="noopener"
        :title="$t('home.twitter.follow')"
        class="
          mb-6 inline-flex w-fit items-center gap-2 rounded-full border bg-card
          p-1 pr-3 text-card-foreground transition-colors
          hover:bg-accent hover:text-accent-foreground
          focus-visible:ring-2 focus-visible:ring-ring
        "
      >
        <span
          class="
            flex size-7 items-center justify-center rounded-full bg-primary
            text-xs text-primary-foreground
          "
        >
          <XIcon aria-hidden="true" class="size-3" />
        </span>
        <span class="text-sm">{{ $t('home.twitter.follow') }}</span>
        <span class="block h-4 w-px bg-border" />
        <ArrowRight aria-hidden="true" class="size-4" />
      </a>

      <h1
        class="
          text-4xl font-medium text-balance
          md:text-5xl
          xl:text-6xl
        "
      >
        {{ title }}
      </h1>
      <p class="mt-4 text-lg text-pretty text-muted-foreground">
        {{ description }}
      </p>

      <div class="mt-6 flex flex-wrap items-center gap-2">
        <Button
          as-child
          size="lg"
        >
          <NuxtLink to="/dashboard">
            <span class="text-nowrap">{{ $t('dashboard.title') }}</span>
          </NuxtLink>
        </Button>
        <Button
          as-child
          size="lg"
          variant="ghost"
        >
          <a
            :href="github"
            target="_blank"
            rel="noopener noreferrer"
            :title="$t('layouts.footer.social.github')"
          >
            <GitHubIcon aria-hidden="true" />
            <span class="text-nowrap">{{ $t('home.hero.github_repo') }}</span>
          </a>
        </Button>
      </div>
    </div>

    <img
      :src="heroUrl"
      class="
        hidden aspect-square h-auto justify-self-center
        md:block md:w-60
        lg:w-72
        xl:w-80
      "
      alt="Link sharing illustration"
    >
  </section>
</template>
