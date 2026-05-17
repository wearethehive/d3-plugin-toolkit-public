import type { PythonApiModuleFactory } from '@disguise-one/designer-pythonapi'

export declare const example: PythonApiModuleFactory<{
  get_status: () => Promise<import('@disguise-one/designer-pythonapi').ExecuteResponse>
  get_track_info: () => Promise<import('@disguise-one/designer-pythonapi').ExecuteResponse>
}>
