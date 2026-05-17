import { ref, onMounted } from 'vue'
import {
  executePython,
  parseReturnValue,
  getDirectorEndpoint,
  type DesignerResponse,
} from '../designer-client.js'

export function useDesigner() {
  const endpoint = ref(getDirectorEndpoint())
  const connected = ref(false)

  function hostAndPort(): { host: string; port: number } {
    const parts = endpoint.value.split(':')
    return {
      host: parts[0] || '127.0.0.1',
      port: parseInt(parts[1] || '80', 10),
    }
  }

  async function execute(script: string): Promise<DesignerResponse> {
    const { host, port } = hostAndPort()
    return executePython(script, { host, port })
  }

  async function executeAndParse<T = unknown>(script: string): Promise<T | null> {
    const result = await execute(script)
    if (result.status.code !== 0) return null
    return parseReturnValue(result.returnValue) as T | null
  }

  async function testConnection(): Promise<boolean> {
    try {
      const result = await execute("return 'connected'")
      connected.value = result.status.code === 0
      return connected.value
    } catch {
      connected.value = false
      return false
    }
  }

  onMounted(() => testConnection())

  return { endpoint, connected, execute, executeAndParse, testConnection }
}
