<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDesigner } from '@d3-toolkit/shared/composables'
import { useLiveUpdate, LiveUpdateOverlay } from '@disguise-one/vue-liveupdate'
import { example } from './example.py'

const { endpoint, connected } = useDesigner()
const liveUpdate = useLiveUpdate(endpoint.value)

// Connect to the Python module — it auto-registers with Designer on first use
const { get_status, get_track_info, registration } = example(endpoint.value)

const trackName = ref('')
const layers = ref<Array<{ name: string; uid: string }>>([])
const loading = ref(false)

function parseReturn<T>(resp: { returnValue?: string }): T | null {
  try {
    let val = resp.returnValue
    if (!val || val === 'None') return null
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1).replace(/\\"/g, '"')
    }
    val = val.replace(/\\n/g, '\n')
    return JSON.parse(val)
  } catch {
    return null
  }
}

async function loadTrackInfo() {
  loading.value = true
  try {
    const resp = await get_track_info()
    const data = parseReturn<{ track: string; layers: Array<{ name: string; uid: string }> }>(resp)
    if (data) {
      trackName.value = data.track
      layers.value = data.layers
    }
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await registration
  await loadTrackInfo()
})
</script>

<template>
  <div class="app">
    <header>
      <h1>{{title}}</h1>
      <span class="status" :class="{ connected }">
        {{ connected ? 'Connected' : 'Disconnected' }}
      </span>
    </header>
    <main>
      <div v-if="loading">Loading...</div>
      <div v-else-if="trackName">
        <p>Track: <strong>{{ trackName }}</strong></p>
        <p>{{ layers.length }} layers</p>
        <ul>
          <li v-for="layer in layers" :key="layer.uid">{{ layer.name }}</li>
        </ul>
      </div>
      <div v-else>
        <p>Waiting for Designer connection...</p>
      </div>
    </main>
    <LiveUpdateOverlay :liveUpdate="liveUpdate" />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #1a1a2e;
  color: #e0e0e0;
}

.app {
  padding: 16px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #333;
}

h1 {
  font-size: 18px;
  font-weight: 600;
}

.status {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  background: #4a1a1a;
  color: #ff6b6b;
}

.status.connected {
  background: #1a4a2e;
  color: #6bff8a;
}

main {
  padding: 12px 0;
}

ul {
  list-style: none;
  margin-top: 8px;
}

li {
  padding: 4px 0;
  font-size: 14px;
  color: #aaa;
}

code {
  background: #2d2d44;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 13px;
}
</style>
