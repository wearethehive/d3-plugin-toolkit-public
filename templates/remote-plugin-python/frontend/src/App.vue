<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

interface HealthResponse {
  ok: boolean
  name: string
  backend: string
  version: string
}

interface DesignerStatus {
  ok: boolean
  host: string
  port: number
  message: string
}

const backendUrl = computed(() => {
  const configured = import.meta.env.VITE_D3_REMOTE_BACKEND_URL as string | undefined
  return configured || window.location.origin
})

const health = ref<HealthResponse | null>(null)
const designer = ref<DesignerStatus | null>(null)
const loading = ref(false)
const error = ref('')

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${backendUrl.value}${path}`)
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return response.json() as Promise<T>
}

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    health.value = await getJson<HealthResponse>('/api/health')
    designer.value = await getJson<DesignerStatus>('/api/designer/status')
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void refresh()
})
</script>

<template>
  <main class="shell">
    <header class="topbar">
      <div>
        <h1>{{title}}</h1>
        <p>Remote Designer plugin</p>
      </div>
      <button type="button" :disabled="loading" @click="refresh">
        {{ loading ? 'Checking' : 'Refresh' }}
      </button>
    </header>

    <section class="status-grid" aria-label="Status">
      <article>
        <span class="label">Backend</span>
        <strong>{{ health?.ok ? 'Online' : 'Unknown' }}</strong>
        <small>{{ health?.backend || 'python' }}</small>
      </article>
      <article>
        <span class="label">Designer</span>
        <strong>{{ designer?.ok ? 'Connected' : 'Not connected' }}</strong>
        <small>{{ designer?.host || '127.0.0.1' }}:{{ designer?.port || 80 }}</small>
      </article>
    </section>

    <section class="panel">
      <h2>Diagnostics</h2>
      <dl>
        <div>
          <dt>Backend URL</dt>
          <dd>{{ backendUrl }}</dd>
        </div>
        <div>
          <dt>Plugin</dt>
          <dd>{{ health?.name || '{{pluginName}}' }}</dd>
        </div>
        <div>
          <dt>Designer status</dt>
          <dd>{{ designer?.message || 'Not checked yet' }}</dd>
        </div>
      </dl>
      <p v-if="error" class="error">{{ error }}</p>
    </section>
  </main>
</template>
