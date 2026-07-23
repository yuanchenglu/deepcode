import { describe, it, expect } from "bun:test"
import { parseHttpEvent, parseWsEvent, parseAnyEvent, extractText } from "../src/feishu/parser"
import { parseQqPayload } from "../src/qq/parser"
import { parseInboundXml as wecomXml, toGatewayMessage as wecomToMsg } from "../src/wecom/parser"
import { parseInboundXml as wechatXml, toGatewayMessage as wechatToMsg } from "../src/wechat/parser"
import feishuUrl from "./fixtures/feishu/url-verification.json"
import feishuMsg from "./fixtures/feishu/im-message.json"
import feishuWs from "./fixtures/feishu/ws-event.json"
import qqText from "./fixtures/qq/text-message.json"
import qqAt from "./fixtures/qq/at-robot.json"
import qqHb from "./fixtures/qq/heartbeat.json"

describe("feishu parser", () => {
  it("extractText 从 JSON 里取 text", () => {
    expect(extractText(JSON.stringify({ text: "hi" }))).toBe("hi")
    expect(extractText("plain")).toBe("plain")
    expect(extractText(undefined)).toBe("")
  })

  it("parseHttpEvent 解析 im.message.receive_v1", () => {
    const m = parseHttpEvent(feishuMsg)
    expect(m).toBeDefined()
    expect(m!.platform).toBe("feishu")
    expect(m!.id).toBe("om_test_msg_001")
    expect(m!.chat.id).toBe("oc_test_chat_001")
    expect(m!.sender.id).toBe("ou_test_user_1")
    expect(m!.content).toBe("你好 DeepCode")
  })

  it("parseHttpEvent 对其他 event_type 返回 undefined", () => {
    expect(parseHttpEvent({ header: { event_type: "other" }, event: {} })).toBeUndefined()
    expect(parseHttpEvent(null)).toBeUndefined()
  })

  it("parseWsEvent 解析 WS 裸事件", () => {
    const m = parseWsEvent(feishuWs)
    expect(m).toBeDefined()
    expect(m!.id).toBe("om_ws_001")
    expect(m!.content).toBe("来自 WS 的消息")
  })

  it("parseAnyEvent 自动识别 HTTP/WS", () => {
    expect(parseAnyEvent(feishuMsg)?.id).toBe("om_test_msg_001")
    expect(parseAnyEvent(feishuWs)?.id).toBe("om_ws_001")
    // url_verification 不是消息事件，parseAnyEvent 返回 undefined
    expect(parseAnyEvent(feishuUrl)).toBeUndefined()
  })
})

describe("qq parser", () => {
  it("解析 MESSAGE_CREATE", () => {
    const m = parseQqPayload(qqText)
    expect(m).toBeDefined()
    expect(m!.platform).toBe("qq")
    expect(m!.id).toBe("qq_msg_001")
    expect(m!.chat.id).toBe("ch_001")
    expect(m!.sender.id).toBe("u_qq_001")
    expect(m!.content).toBe("hello from QQ")
  })
  it("解析 AT_MESSAGE_CREATE", () => {
    const m = parseQqPayload(qqAt)
    expect(m?.content).toContain("帮我写代码")
  })
  it("心跳 op=1 返回 undefined", () => {
    expect(parseQqPayload(qqHb)).toBeUndefined()
  })
  it("未知事件返回 undefined", () => {
    expect(parseQqPayload({ op: 0, t: "UNKNOWN" })).toBeUndefined()
    expect(parseQqPayload(null)).toBeUndefined()
  })
})

describe("wecom parser", () => {
  it("XML → GatewayMessage", () => {
    const xml = `<xml><ToUserName><![CDATA[ww123]]></ToUserName><FromUserName><![CDATA[wm456]]></FromUserName><CreateTime>1400000000</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[hello]]></Content><MsgId>111</MsgId><AgentID>1000002</AgentID></xml>`
    const m = wecomToMsg(wecomXml(xml))
    expect(m).toBeDefined()
    expect(m!.platform).toBe("wecom")
    expect(m!.sender.id).toBe("wm456")
    expect(m!.chat.id).toBe("ww123")
    expect(m!.content).toBe("hello")
  })
})

describe("wechat parser", () => {
  it("XML → GatewayMessage", () => {
    const xml = `<xml><ToUserName><![CDATA[gh_a]]></ToUserName><FromUserName><![CDATA[o_u1]]></FromUserName><CreateTime>1400000000</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[你好]]></Content><MsgId>222</MsgId></xml>`
    const m = wechatToMsg(wechatXml(xml))
    expect(m).toBeDefined()
    expect(m!.platform).toBe("wechat")
    expect(m!.sender.id).toBe("o_u1")
    expect(m!.chat.id).toBe("gh_a")
  })
  it("event 消息归类为 event 类型", () => {
    const xml = `<xml><ToUserName><![CDATA[gh_a]]></ToUserName><FromUserName><![CDATA[o_u1]]></FromUserName><CreateTime>1400000000</CreateTime><MsgType><![CDATA[event]]></MsgType><Event><![CDATA[subscribe]]></Event></xml>`
    const m = wechatToMsg(wechatXml(xml))
    expect(m?.type).toBe("event")
    expect(m?.content).toBe("subscribe")
  })
  it("未知 MsgType 返回 undefined", () => {
    const xml = `<xml><MsgType><![CDATA[location]]></MsgType></xml>`
    expect(wechatToMsg(wechatXml(xml))).toBeUndefined()
  })
})
