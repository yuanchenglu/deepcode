import { Config } from "effect"
import { Product } from "../product"

function read(key: string) {
  return process.env[key.startsWith("OPENCODE_") ? `${Product.envPrefix}_${key.slice("OPENCODE_".length)}` : key]
}

export function truthy(key: string) {
  const value = read(key)?.toLowerCase()
  return value === "true" || value === "1"
}

const copy = read("OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
const fff = read("OPENCODE_DISABLE_FFF")

function enabledByExperimental(key: string) {
  return read(key) === undefined ? truthy("OPENCODE_EXPERIMENTAL") : truthy(key)
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: read("OTEL_EXPORTER_OTLP_ENDPOINT"),
  OTEL_EXPORTER_OTLP_HEADERS: read("OTEL_EXPORTER_OTLP_HEADERS"),

  OPENCODE_AUTO_HEAP_SNAPSHOT: truthy("OPENCODE_AUTO_HEAP_SNAPSHOT"),
  OPENCODE_GIT_BASH_PATH: read("OPENCODE_GIT_BASH_PATH"),
  OPENCODE_CONFIG: read("OPENCODE_CONFIG"),
  get OPENCODE_CONFIG_CONTENT() {
    return read("OPENCODE_CONFIG_CONTENT")
  },
  OPENCODE_DISABLE_AUTOUPDATE: truthy("OPENCODE_DISABLE_AUTOUPDATE"),
  OPENCODE_ALWAYS_NOTIFY_UPDATE: truthy("OPENCODE_ALWAYS_NOTIFY_UPDATE"),
  OPENCODE_DISABLE_PRUNE: truthy("OPENCODE_DISABLE_PRUNE"),
  OPENCODE_DISABLE_TERMINAL_TITLE: truthy("OPENCODE_DISABLE_TERMINAL_TITLE"),
  OPENCODE_SHOW_TTFD: truthy("OPENCODE_SHOW_TTFD"),
  OPENCODE_DISABLE_AUTOCOMPACT: truthy("OPENCODE_DISABLE_AUTOCOMPACT"),
  OPENCODE_DISABLE_MODELS_FETCH: truthy("OPENCODE_DISABLE_MODELS_FETCH"),
  OPENCODE_DISABLE_MOUSE: truthy("OPENCODE_DISABLE_MOUSE"),
  OPENCODE_FAKE_VCS: read("OPENCODE_FAKE_VCS"),
  OPENCODE_SERVER_PASSWORD: read("OPENCODE_SERVER_PASSWORD"),
  OPENCODE_SERVER_USERNAME: read("OPENCODE_SERVER_USERNAME"),
  OPENCODE_DISABLE_FFF: fff === undefined ? process.platform === "win32" : truthy("OPENCODE_DISABLE_FFF"),

  // Experimental
  OPENCODE_EXPERIMENTAL_FILEWATCHER: Config.boolean("DEEPCODE_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("DEEPCODE_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  OPENCODE_MODELS_URL: read("OPENCODE_MODELS_URL"),
  OPENCODE_MODELS_PATH: read("OPENCODE_MODELS_PATH"),
  OPENCODE_DB: read("OPENCODE_DB"),

  OPENCODE_WORKSPACE_ID: read("OPENCODE_WORKSPACE_ID"),
  OPENCODE_EXPERIMENTAL_WORKSPACES: enabledByExperimental("OPENCODE_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get OPENCODE_DISABLE_PROJECT_CONFIG() {
    return truthy("OPENCODE_DISABLE_PROJECT_CONFIG")
  },
  get OPENCODE_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("OPENCODE_EXPERIMENTAL_REFERENCES")
  },
  get OPENCODE_TUI_CONFIG() {
    return read("OPENCODE_TUI_CONFIG")
  },
  get OPENCODE_CONFIG_DIR() {
    return read("OPENCODE_CONFIG_DIR")
  },
  get OPENCODE_PURE() {
    return truthy("OPENCODE_PURE")
  },
  get OPENCODE_PERMISSION() {
    return read("OPENCODE_PERMISSION")
  },
  get OPENCODE_PLUGIN_META_FILE() {
    return read("OPENCODE_PLUGIN_META_FILE")
  },
  get OPENCODE_CLIENT() {
    return read("OPENCODE_CLIENT") ?? "cli"
  },
}
