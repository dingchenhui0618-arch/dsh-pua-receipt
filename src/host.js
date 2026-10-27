// Host half of dsh-pua-receipt.
//
// The contract with the user is narrow and measurable:
//
//   /pua  ->  one real pressure message enters the session through the host's
//             sessionController.prompt({ mode: 'steer' })
//          ->  the plugin counts the N completed model steps before it and the
//             N completed steps after it (tool calls, verification-class steps,
//             repeated-call peak, assistant text)
//          ->  when the after-window fills, one receipt is written to
//             $DSH_HOME/pua-receipts.jsonl and exposed to the panel
//   rank  ->  today's receipts, grouped by sentence, ordered by observed
//             behaviour change
//
// Nothing here claims causality. The receipt is a before/after observation, and
// the README tells the user that plainly.

import { randomUUID } from 'node:crypto'
import { appendFileSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { LINES, findLine, lineAt, lineByNumber, lineLabel, lineNumber } from './library.js'
import {
  classifyCall,
  clock,
  dateKey,
  emptySummary,
  evidenceOf,
  formatRank,
  formatReceipt,
  rankReceipts,
  signatureOf,
  summarize,
  verdictLabel,
  verdictOf,
} from './metrics.js'

export const name = 'dsh-pua-receipt'
export const inject = ['commands']

const DEFAULT_ROUNDS = 3
const MAX_ROUNDS = 12
const MAX_RECEIPTS = 1000
const MAX_STEPS = 80
const ROUTE = '/dsh-pua-receipt'

function dshHome() {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv
  return join(homedir(), '.dsh')
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

function loadReceipts(path) {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch (error) {
    return []
  }
  const out = []
  for (const line of raw.split(/\r?\n/)) {
    if (line.trim().length === 0) continue
    try {
      const receipt = JSON.parse(line)
      if (receipt !== null && typeof receipt === 'object' && typeof receipt.id === 'string' && typeof receipt.lineId === 'string') {
        out.push(receipt)
      }
    } catch (error) {
      // A torn last line must not make the whole history unreadable.
    }
  }
  return out.slice(-MAX_RECEIPTS)
}

function shortId() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

function clampRounds(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULT_ROUNDS
  return Math.min(MAX_ROUNDS, Math.max(1, Math.trunc(n)))
}

function signed(value) {
  const n = Number(value) || 0
  return n > 0 ? '+' + n : String(n)
}

function helpText() {
  return [
    '用法：',
    '  /pua                     施压一次，自动轮换话术，默认观察后 ' + DEFAULT_ROUNDS + ' 轮',
    '  /pua 7                   使用第 7 条话术',
    '  /pua evidence            按 id / 语气选话术（/pua list 查看）',
    '  /pua --rounds 5          本轮观察 5 轮（1–' + MAX_ROUNDS + '）',
    '  /pua status              当前实验进度',
    '  /pua receipts            最近的回执',
    '  /pua rank                今天哪句话真的推动了工作',
    '  /pua list                15 条话术',
    '  /pua off                 取消当前实验（不参与排行）',
    '',
    '回执对比施压前后各 N 轮的工具调用数、验证类步骤数和重复调用峰值，',
    '判定为「改变了做法 / 只是重述 / 无变化」。只记录差异，不证明因果。',
  ].join('\n')
}

function buildPressureText(receipt) {
  return [
    '【PUA 施压 · 回执实验 ' + receipt.id + '】',
    '「' + receipt.line + '」',
    '接下来 ' + receipt.rounds + ' 轮：不要重复上一轮的做法。先改变做法，再用可复现的证据说明结果；如果已经反复失败，换一条路径，而不是重试同一条命令。',
    '（这是 dsh-pua-receipt 的对照实验输入：它会对比施压前后各 ' + receipt.rounds + ' 轮的工具调用与验证类步骤。）',
  ].join('\n')
}

export function apply(ctx, config) {
  const settings = config !== null && typeof config === 'object' ? config : {}
  const home = typeof settings.dshHome === 'string' && settings.dshHome.length > 0 ? settings.dshHome : dshHome()
  const receiptPath = typeof settings.receiptPath === 'string' && settings.receiptPath.length > 0
    ? settings.receiptPath
    : join(home, 'pua-receipts.jsonl')
  const defaultRounds = clampRounds(settings.rounds === undefined ? DEFAULT_ROUNDS : settings.rounds)

  const sessions = new Map()
  const receipts = loadReceipts(receiptPath)
  let activations = receipts.length

  function remember(receipt) {
    receipts.push(receipt)
    if (receipts.length > MAX_RECEIPTS) receipts.splice(0, receipts.length - MAX_RECEIPTS)
  }

  function forget(receipt) {
    const index = receipts.indexOf(receipt)
    if (index >= 0) receipts.splice(index, 1)
  }

  function persist(receipt) {
    try {
      appendFileSync(receiptPath, JSON.stringify(receipt) + '\n', 'utf8')
    } catch (error) {
      // A read-only home must not break the session. The panel still shows the
      // in-memory receipt; only durability is lost.
    }
  }

  function sessionOf(agent, create) {
    if (agent === undefined || agent === null) return undefined
    const id = String(agent.id === undefined ? agent : agent.id)
    if (id.length === 0) return undefined
    let session = sessions.get(id)
    if (session === undefined && create === true) {
      session = { id: id, steps: [], current: null, pressure: null }
      sessions.set(id, session)
    }
    return session
  }

  function openStep(session, turn, step) {
    if (session.current !== null) closeStep(session)
    if (session.pressure !== null && session.pressure.started !== true) {
      session.pressure.started = true
      session.pressure.startTurn = turn
      session.pressure.startStep = step
    }
    session.current = { turn: turn, step: step, toolCalls: [], textChars: 0 }
  }

  function closeStep(session) {
    const step = session.current
    if (step === null) return
    session.current = null
    session.steps.push(step)
    if (session.steps.length > MAX_STEPS) session.steps.splice(0, session.steps.length - MAX_STEPS)

    const pressure = session.pressure
    if (pressure !== null && pressure.started === true) {
      pressure.afterSteps.push(step)
      if (pressure.afterSteps.length >= pressure.rounds) finalize(session, false)
    }
  }

  function finalize(session, incomplete) {
    const pressure = session.pressure
    if (pressure === null) return
    session.pressure = null

    const receipt = pressure.receipt
    const before = summarize(pressure.beforeSteps)
    const after = summarize(pressure.afterSteps)
    const verdict = incomplete === true ? 'incomplete' : verdictOf(before, after)

    receipt.before = before
    receipt.after = after
    receipt.verdict = verdict
    receipt.evidence = evidenceOf(before, after, verdict)
    receipt.completedAt = Date.now()
    persist(receipt)
  }

  function cancel(session) {
    const pressure = session.pressure
    if (pressure === null) return false
    session.pressure = null
    const receipt = pressure.receipt
    receipt.before = summarize(pressure.beforeSteps)
    receipt.after = summarize(pressure.afterSteps)
    receipt.verdict = 'cancelled'
    receipt.evidence = evidenceOf(receipt.before, receipt.after, 'cancelled')
    receipt.completedAt = Date.now()
    persist(receipt)
    return true
  }

  function nextLine() {
    // `activations` is advanced exactly once, in activate(), so an automatic
    // pick and an explicit pick cost the same rotation step.
    return lineAt(activations)
  }

  function agentStatus(sessionId) {
    const agents = ctx.get('agents')
    if (agents === undefined || typeof agents.get !== 'function') return undefined
    try {
      const agent = agents.get(sessionId)
      if (agent === undefined || agent === null) return undefined
      return typeof agent.status === 'string' ? agent.status : undefined
    } catch (error) {
      return undefined
    }
  }

  async function activate(session, line, rounds, invocation) {
    if (session.pressure !== null) {
      return {
        kind: 'error',
        text: '已有一条施压实验在进行中（' + session.pressure.receipt.id + '）。先 /pua status 看进度，或 /pua off 取消。',
      }
    }

    const beforeSteps = session.steps.slice(-rounds)
    const before = summarize(beforeSteps)
    const receipt = {
      id: shortId(),
      at: Date.now(),
      date: dateKey(),
      lineId: line.id,
      lineNo: lineNumber(line.id),
      line: line.text,
      tone: line.tone,
      rounds: rounds,
      before: before,
      after: emptySummary(),
      verdict: 'pending',
      evidence: '等待后 ' + rounds + ' 轮行为…',
    }

    const sessionId = invocation && invocation.agent ? invocation.agent.id : undefined
    if (sessionId === undefined || sessionId === null) {
      return { kind: 'error', text: '找不到当前会话，未创建实验。' }
    }

    const chat = ctx.get('sessionController')
    if (chat === undefined || typeof chat.prompt !== 'function') {
      return {
        kind: 'error',
        text: '这个宿主没有 sessionController.prompt 接口，施压消息发不出去。为避免回执测量空气，已拒绝创建实验。',
      }
    }

    remember(receipt)

    try {
      const accepted = await chat.prompt({
        requestId: randomUUID(),
        sessionId: sessionId,
        mode: 'steer',
        content: [{ type: 'text', text: buildPressureText(receipt) }],
      })
      if (!accepted || accepted.accepted !== true) throw new Error('host rejected the pressure message')
    } catch (error) {
      forget(receipt)
      const message = error && error.message ? error.message : String(error)
      return { kind: 'error', text: '施压消息没有被宿主接收（' + message + '）。未创建实验，也没有写回执。' }
    }

    session.pressure = {
      receipt: receipt,
      rounds: rounds,
      beforeSteps: beforeSteps,
      afterSteps: [],
      started: false,
    }

    activations += 1

    const status = agentStatus(sessionId)
    const lines = [
      '已施压：' + lineLabel(line),
      '「' + line.text + '」',
      '前窗 ' + before.steps + '/' + rounds + ' 轮：工具 ' + before.toolCalls + ' · 验证 ' + before.verifySteps + ' · 重复峰值 ' + before.repeatedMax,
      before.steps < rounds ? '前窗不足 ' + rounds + ' 轮，回执会标为「部分」。' : '',
      status !== undefined && status !== 'running' ? '会话当前空闲，这条施压会起一轮新工作。' : '',
      '后 ' + rounds + ' 轮结束后结算；/pua status 看进度，对话视图的「施压回执」面板看结果。',
    ].filter(function (text) { return text.length > 0 })
    return { kind: 'success', text: lines.join('\n') }
  }

  async function handle(rawInput, invocation) {
    const raw = typeof rawInput === 'string' ? rawInput.trim() : ''
    let words = raw.length === 0 ? [] : raw.split(/\s+/)
    // The host normally hands over only the arguments, but accepting the full
    // "/pua ..." line makes the command testable and tolerant of either shape.
    if (words.length > 0 && (words[0] === '/pua' || words[0].toLowerCase() === 'pua')) {
      words = words.slice(1)
    }
    const verb = words.length > 0 ? words[0].toLowerCase() : ''
    const session = sessionOf(invocation && invocation.agent ? invocation.agent : undefined, true)

    if (verb === 'help' || verb === '?') return { kind: 'success', text: helpText() }

    if (verb === 'list') {
      const lines = ['15 条施压话术（/pua 编号 使用）：']
      LINES.forEach(function (line, index) {
        lines.push(String(index + 1) + '. [' + line.tone + '] ' + line.text)
      })
      return { kind: 'success', text: lines.join('\n') }
    }

    if (verb === 'rank') {
      return { kind: 'success', text: formatRank(rankReceipts(receipts, dateKey()), dateKey()) }
    }

    if (verb === 'receipts' || verb === 'log') {
      const recent = receipts.slice(-5).reverse()
      if (recent.length === 0) return { kind: 'success', text: '还没有回执。输入 /pua 开始第一次实验。' }
      return { kind: 'success', text: recent.map(formatReceipt).join('\n\n') }
    }

    if (verb === 'off' || verb === 'cancel') {
      if (session === undefined) return { kind: 'error', text: '找不到当前会话。' }
      if (!cancel(session)) return { kind: 'success', text: '当前没有进行中的施压实验。' }
      return { kind: 'success', text: '已取消当前实验。这条回执标记为「已取消」，不参与排行。' }
    }

    if (verb === 'status') {
      if (session === undefined) return { kind: 'error', text: '找不到当前会话。' }
      if (session.pressure !== null) {
        const pressure = session.pressure
        const before = summarize(pressure.beforeSteps)
        return {
          kind: 'success',
          text: [
            '进行中：' + pressure.receipt.id + ' · ' + lineLabel({ id: pressure.receipt.lineId, tone: pressure.receipt.tone }),
            '「' + pressure.receipt.line + '」',
            '已收集 ' + pressure.afterSteps.length + '/' + pressure.rounds + ' 轮' + (pressure.started ? '' : '（等待下一步）'),
            '前窗 ' + before.steps + ' 轮：工具 ' + before.toolCalls + ' · 验证 ' + before.verifySteps + ' · 重复峰值 ' + before.repeatedMax,
          ].join('\n'),
        }
      }
      const last = receipts[receipts.length - 1]
      return {
        kind: 'success',
        text: last === undefined ? '当前没有进行中的实验，也没有历史回执。' : '当前没有进行中的实验。最近一条：\n' + formatReceipt(last),
      }
    }

    // Activation. `--rounds N` is parsed first so `/pua 7 --rounds 5` and
    // `/pua --rounds 5` both work.
    let rounds = defaultRounds
    let chosen
    for (let index = 0; index < words.length; index += 1) {
      const token = words[index]
      if (token === '--rounds' || token === '-r') {
        const value = Number(words[index + 1])
        if (!Number.isInteger(value) || value < 1 || value > MAX_ROUNDS) {
          return { kind: 'error', text: '--rounds 需要 1–' + MAX_ROUNDS + ' 之间的整数。' }
        }
        rounds = value
        index += 1
        continue
      }
      const inline = /^--rounds=(\d+)$/.exec(token)
      if (inline !== null) {
        const value = Number(inline[1])
        if (value < 1 || value > MAX_ROUNDS) return { kind: 'error', text: '--rounds 需要 1–' + MAX_ROUNDS + ' 之间的整数。' }
        rounds = value
        continue
      }
      if (chosen !== undefined) continue
      const asNumber = Number(token)
      if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= LINES.length) {
        chosen = lineByNumber(asNumber)
        continue
      }
      if (/^\d+$/.test(token)) {
        return { kind: 'error', text: '话术编号只能是 1–' + LINES.length + '。' }
      }
      const found = findLine(token)
      if (found !== undefined) {
        chosen = found
        continue
      }
      return { kind: 'error', text: '看不懂「' + token + '」。用 /pua list 看编号，或 /pua help。' }
    }

    if (session === undefined) return { kind: 'error', text: '找不到当前会话，未创建实验。' }
    const line = chosen === undefined ? nextLine() : chosen
    return activate(session, line, rounds, invocation)
  }

  ctx.effect(function () {
    return ctx.commands.register({
      name: 'pua',
      description: '施压一次，并对比前后 N 轮的工具调用与验证步骤，生成一张回执。',
      input: { hint: '[编号|list|status|receipts|rank|off] [--rounds N]' },
      recordInput: true,
      handler: function (invocation) {
        return handle(invocation && typeof invocation.rawInput === 'string' ? invocation.rawInput : '', invocation)
          .catch(function (error) {
            const message = error && error.message ? error.message : String(error)
            return { kind: 'error', text: '/pua 执行失败：' + message }
          })
      },
    })
  })

  // Counting is deliberately failure-proof: a bad payload from a future host
  // must not break a turn. Every listener returns control to the pipeline.
  ctx.on('agent/created', function (payload) {
    try {
      sessionOf(payload && payload.agent, true)
    } catch (error) {
      // ignore
    }
  })

  ctx.on('agent/pre-step', function (payload, next) {
    try {
      const session = sessionOf(payload && payload.agent, true)
      if (session !== undefined) {
        const turn = Number(payload.turn)
        const step = Number(payload.step)
        if (session.current !== null && (session.current.turn !== turn || session.current.step !== step)) {
          closeStep(session)
        }
        if (session.current === null) openStep(session, turn, step)
      }
    } catch (error) {
      // never reject a step because measurement failed
    }
    return next()
  })

  ctx.on('tools/result', function (exec, result) {
    try {
      const session = sessionOf(exec && exec.agent, true)
      if (session === undefined || session.current === null) return
      const classified = classifyCall(exec.name, exec.arguments)
      session.current.toolCalls.push({
        name: String(exec.name),
        verify: classified.verify,
        failed: Boolean(result && result.isError),
        signature: signatureOf(exec.name, exec.arguments),
      })
    } catch (error) {
      // ignore
    }
  })

  ctx.on('agent/assistant-stream', function (payload) {
    try {
      const frame = payload && payload.frame
      const session = sessionOf(payload && payload.agent, true)
      if (session === undefined || frame === null || frame === undefined) return
      if (frame.type === 'start') {
        const turn = Number(frame.turn)
        const step = Number(frame.step)
        if (session.current === null) {
          openStep(session, turn, step)
        } else if (session.current.turn !== turn || session.current.step !== step) {
          closeStep(session)
          openStep(session, turn, step)
        }
        return
      }
      if (frame.type === 'chunk' && frame.chunk && frame.chunk.type === 'text-delta' && typeof frame.chunk.text === 'string') {
        if (session.current !== null) session.current.textChars += frame.chunk.text.length
      }
    } catch (error) {
      // ignore
    }
  })

  ctx.on('agent/turn-stopping', function (payload) {
    try {
      const session = sessionOf(payload && payload.agent, false)
      if (session !== undefined && session.current !== null) closeStep(session)
    } catch (error) {
      // ignore
    }
  })

  ctx.on('agent/disposed', function (payload) {
    try {
      const session = sessionOf(payload && payload.agent, false)
      if (session === undefined) return
      if (session.current !== null) closeStep(session)
      if (session.pressure !== null) finalize(session, true)
      sessions.delete(session.id)
    } catch (error) {
      // ignore
    }
  })

  function snapshot() {
    const today = dateKey()
    const todayReceipts = receipts.filter(function (receipt) {
      return (receipt.date || dateKey(receipt.at)) === today
    })
    const count = function (verdict) {
      return todayReceipts.filter(function (receipt) { return receipt.verdict === verdict }).length
    }
    const active = []
    for (const session of sessions.values()) {
      if (session.pressure === null) continue
      const pressure = session.pressure
      active.push({
        id: pressure.receipt.id,
        lineId: pressure.receipt.lineId,
        line: pressure.receipt.line,
        tone: pressure.receipt.tone,
        rounds: pressure.rounds,
        collected: pressure.afterSteps.length,
        started: pressure.started,
        at: pressure.receipt.at,
        before: summarize(pressure.beforeSteps),
      })
    }
    return {
      config: { rounds: defaultRounds, lines: LINES.length, maxRounds: MAX_ROUNDS },
      stats: {
        today: todayReceipts.length,
        changed: count('changed'),
        restated: count('restated'),
        unchanged: count('unchanged'),
        incomplete: count('incomplete'),
        cancelled: count('cancelled'),
        pending: receipts.filter(function (receipt) { return receipt.verdict === 'pending' }).length,
      },
      active: active,
      receipts: receipts.filter(function (receipt) {
        return (receipt.date || dateKey(receipt.at)) === today || receipt.verdict === 'pending'
      }).slice(-40).reverse(),
      ranking: rankReceipts(receipts, today),
      note: '回执只记录前后差异，不证明因果；窗口不满会标为证据不足。',
      today: today,
      updatedAt: Date.now(),
    }
  }

  // The panel is disposable. If the route cannot be registered (a changed
  // webServer contract, a host without a web server), the command and all
  // measurement keep working.
  ctx.effect(function () {
    let disposeRoute
    try {
      const web = ctx.get('webServer')
      if (web === undefined || typeof web.register !== 'function') return function () {}
      disposeRoute = web.register({
        kind: 'prefix',
        path: ROUTE,
        handler: function (req, res) {
          try {
            if (req.method === 'GET') {
              sendJson(res, 200, snapshot())
              return
            }
            sendJson(res, 405, { error: 'method not allowed' })
          } catch (error) {
            sendJson(res, 500, { error: String((error && error.message) || error) })
          }
        },
      })
    } catch (error) {
      disposeRoute = undefined
    }
    return function () {
      if (typeof disposeRoute === 'function') disposeRoute()
    }
  })
}

// Exported for tests and for anyone who wants the exact sentence the current
// rotation would pick. It has no side effects.
export function nextSentenceFor(receiptCount) {
  return lineAt(Number(receiptCount) || 0)
}

// Exported so a receipt formatter and the host cannot drift on labels.
export { verdictLabel, clock, signed }
