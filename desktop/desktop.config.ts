import { defineDesktopConfig } from '@owdproject/nuxt'

export default defineDesktopConfig({
  theme: 'owd-nuxt-theme-win95',
  modules: ['@owdproject/nuxt-module-pinia-persistence', '@owdproject/nuxt-module-fs'],
  jazz: {
    broadcastOnly: true
  }
})
