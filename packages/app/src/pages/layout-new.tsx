import { createEffect, ErrorBoundary, Suspense, type ParentProps } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { DebugBar } from "@/components/debug-bar"
import { HelpButton } from "@/components/help-button"
import { Titlebar, type TitlebarUpdate } from "@/components/titlebar"
import { usePlatform } from "@/context/platform"
import { setNavigate } from "@/utils/notification-click"
import { setV2Toast, ToastRegion } from "@/utils/toast"

/** S3-05: 壳级加载态（Suspense fallback，避免路由切换白屏闪烁） */
function LayoutFallback() {
  return (
    <div class="flex-1 min-h-0 min-w-0 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3" role="status" aria-live="polite">
        <div class="w-6 h-6 border-2 border-v2-border-border-base border-t-v2-text-text-base rounded-full animate-spin" />
        <span class="text-v2-text-text-weak text-sm">加载中…</span>
      </div>
    </div>
  )
}

/** S3-05: 壳级错误边界（路由/子页面异常时不白屏） */
function LayoutErrorBoundary(props: ParentProps) {
  return (
    <ErrorBoundary
      fallback={(err, reset) => (
        <div class="flex-1 min-h-0 min-w-0 flex items-center justify-center p-6">
          <div class="flex flex-col items-start gap-3 max-w-md">
            <h2 class="text-v2-text-text-base text-base font-semibold">页面加载失败</h2>
            <p class="text-v2-text-text-weak text-sm break-all">{(err as Error)?.message ?? String(err)}</p>
            <button
              type="button"
              class="px-3 py-1.5 rounded-md bg-v2-background-bg-raised text-v2-text-text-base text-sm hover:bg-v2-background-bg-hover"
              onClick={reset}
            >
              重试
            </button>
          </div>
        </div>
      )}
    >
      {props.children}
    </ErrorBoundary>
  )
}

export default function NewLayout(props: ParentProps) {
  const platform = usePlatform()
  const navigate = useNavigate()
  setNavigate(navigate)

  createEffect(() => setV2Toast(true))

  const update: TitlebarUpdate = {
    version: () => {
      const state = platform.updater?.state()
      if (state?.status !== "ready") return
      return state.version
    },
    installing: () => platform.updater?.state().status === "installing",
    install: () => void platform.updater?.install(),
  }

  return (
    <div
      class="relative bg-v2-background-bg-deep flex-1 min-h-0 min-w-0 flex flex-col select-none [&_input]:select-text [&_textarea]:select-text [&_[contenteditable]]:select-text"
      style={{
        "padding-top": "env(safe-area-inset-top, 0px)",
        "padding-bottom": "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <Titlebar update={update} />
      <main class="flex-1 min-h-0 min-w-0 overflow-x-hidden flex flex-col items-start contain-strict">
        <LayoutErrorBoundary>
          <Suspense fallback={<LayoutFallback />}>{props.children}</Suspense>
        </LayoutErrorBoundary>
      </main>
      {import.meta.env.DEV && <DebugBar inline />}
      <HelpButton />
      <ToastRegion v2 />
    </div>
  )
}
