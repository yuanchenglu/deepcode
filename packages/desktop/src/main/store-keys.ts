// S3-07: DeepCode 桌面 store key（从 opencode 前缀迁移；旧 opencode.* 键由
// migrate.ts 显式迁移，不默认读取 OpenCode Desktop userData）
export const SETTINGS_STORE = "deepcode.settings"
export const DEFAULT_SERVER_URL_KEY = "defaultServerUrl"
export const WSL_SERVERS_KEY = "wslServers"
export const PINCH_ZOOM_ENABLED_KEY = "pinchZoomEnabled"
export const WINDOW_IDS_KEY = "windowIds"
