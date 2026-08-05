/**
 * S3-06: WCAG 2.2 AA 自动扫描（axe-core）
 *
 * 覆盖 PLAN S3-06 步骤 1 的自动验证部分：
 * - 核心页面（home / new-session）无阻断级 a11y 违规
 * - 对比度、语义、ARIA 自动检查
 *
 * 人工验证项（键盘顺序/焦点/读屏/缩放 200%/reduced motion）见
 * evidence/S3-06 README（依赖真实用户与人工走查）。
 */
import { test, expect } from "@playwright/test"
import axe from "axe-core"

test.describe("a11y axe scan (S3-06)", () => {
  test("home page has no critical a11y violations", async ({ page }) => {
    await page.goto("/")
    await page.waitForSelector("body")
    // 等待首屏渲染（NewHome 异步加载）
    await page.waitForTimeout(1500)

    const results = await page.evaluate(async (source) => {
      // axe-core 是 UMD，注入后挂 window.axe
      // @ts-expect-error axe 由注入提供
      if (!window.axe) {
        const script = document.createElement("script")
        script.textContent = source
        document.head.appendChild(script)
      }
      // @ts-expect-error axe 由注入提供
      return window.axe.run(document, {
        rules: {
          "color-contrast": { enabled: true },
          "aria-allowed-attr": { enabled: true },
          "button-name": { enabled: true },
          "landmark-one-main": { enabled: true },
          "page-has-heading-one": { enabled: false },
        },
      })
    }, axe.source)

    const violations = results.violations
      .filter((v: { impact: string }) => v.impact === "critical" || v.impact === "serious")
    // 输出违规详情定位真实元素（S3-06 审计）
    for (const v of violations) {
      console.log(`[a11y] ${v.id} impact=${v.impact} help=${(v as { help: string }).help}`)
      for (const n of v.nodes) {
        console.log(`  node: ${(n as { target: string[] }).target.join(" ")}`)
        console.log(`  html: ${(n as { html: string }).html.slice(0, 200)}`)
      }
    }
    expect(
      violations.map((v: { id: string; nodes: unknown[] }) => `${v.id}(${v.nodes.length})`),
    ).toEqual([])
  })

  test("new-session page has no critical a11y violations", async ({ page }) => {
    await page.goto("/new-session")
    await page.waitForSelector("body")
    await page.waitForTimeout(1500)

    const results = await page.evaluate(async (source) => {
      // @ts-expect-error axe 由注入提供
      if (!window.axe) {
        const script = document.createElement("script")
        script.textContent = source
        document.head.appendChild(script)
      }
      // @ts-expect-error axe 由注入提供
      return window.axe.run(document, {
        rules: {
          "color-contrast": { enabled: true },
          "aria-allowed-attr": { enabled: true },
          "button-name": { enabled: true },
          "landmark-one-main": { enabled: true },
          "page-has-heading-one": { enabled: false },
        },
      })
    }, axe.source)

    const violations = results.violations
      .filter((v: { impact: string }) => v.impact === "critical" || v.impact === "serious")
    // 输出违规详情定位真实元素（S3-06 审计）
    for (const v of violations) {
      console.log(`[a11y] ${v.id} impact=${v.impact} help=${(v as { help: string }).help}`)
      for (const n of v.nodes) {
        console.log(`  node: ${(n as { target: string[] }).target.join(" ")}`)
        console.log(`  html: ${(n as { html: string }).html.slice(0, 200)}`)
      }
    }
    expect(
      violations.map((v: { id: string; nodes: unknown[] }) => `${v.id}(${v.nodes.length})`),
    ).toEqual([])
  })
})
