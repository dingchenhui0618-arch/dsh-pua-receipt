// Measurement, verdicts and ranking for dsh-pua-receipt.
//
// The unit is one model step ("一轮"): a step starts at `agent/pre-step` and is
// closed by the next step or by `agent/turn-stopping`. Tool calls observed
// through `tools/result` are attributed to the open step. A receipt compares
// the last N completed steps before the pressure message with the first N
// completed steps after it.
//
// Everything here is a pure function so the host half can be tested without a
// running harness.

const VERIFY_COMMAND_PATTERNS = [
  /\bnode\s+--test\b/i,
  /\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:test|build|lint|typecheck|check|verify)\b/i,
  /\b(?:npx|pnpm\s+exec|yarn\s+exec)\s+(?:vitest|jest|mocha|tsc|eslint|prettier|playwright)\b/i,
  /\b(?:vitest|jest|mocha|pytest|py\.test|phpunit)\b/i,
  /\b(?:cargo|go|dotnet|mvn|gradle|swift|deno)\s+test\b/i,
  /\b(?:tsc|eslint|ruff|flake8|mypy|clippy)\b/i,
  /\bgit\s+(?:diff|status|log|show)\b/i,
  /\b(?:Get-FileHash|sha256sum|shasum|certutil\s+-hashfile)\b/i,
  /\bgh\s+(?:run|pr\s+checks|workflow)\b/i,
  /\b(?:curl|wget)\b[^\n]*(?:localhost|127\.0\.0\.1|::1|\/health|\/status)\b/i,
  /\b(?:verify|validate|smoke[- ]?test|regression)\b/i,
]

const TEST_PATH = /(^|[\\/])(?:test|tests|spec|specs|__tests__|coverage)([\\/]|$)|\.(?:test|spec)\.[^\\/]+$|\.log$/i

function firstString() {
  for (let i = 0; i < arguments.length; i += 1) {
    const value = arguments[i]
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return ''
}

function commandOf(args) {
  if (args === null || typeof args !== 'object') return ''
  const command = Array.isArray(args.command) ? args.command.join(' ') : args.command
  return firstString(command, args.cmd, args.script, args.line, args.shell, args.input)
}

// `verify` is a heuristic, not a proof: it answers "does this call look like an
// attempt to check the result?" (tests, builds, type checks, diffs, hashes, CI
// status, local health probes, test/log reads, visual inspection). Tool names
// and argument patterns are used because the plugin cannot see tool schemas.
export function classifyCall(name, args) {
  const tool = String(name === undefined || name === null ? '' : name).toLowerCase()
  const a = args !== null && typeof args === 'object' ? args : {}
  const command = commandOf(a)

  if (command.length > 0) {
    for (const pattern of VERIFY_COMMAND_PATTERNS) {
      if (pattern.test(command)) return { verify: true, reason: 'command' }
    }
  }

  const path = firstString(a.file_path, a.path, a.filePath, a.directory)
  if (tool === 'read' && TEST_PATH.test(path)) return { verify: true, reason: 'read-test-artifact' }
  if ((tool === 'grep' || tool === 'search') && TEST_PATH.test(path)) return { verify: true, reason: 'search-test-artifact' }
  if (tool === 'glob' && TEST_PATH.test(firstString(a.pattern, path))) return { verify: true, reason: 'find-test-artifact' }
  if (tool === 'read_image') return { verify: true, reason: 'visual' }
  if (tool === 'computer' && /^(?:screenshot|zoom|read_image)$/.test(firstString(a.action))) {
    return { verify: true, reason: 'visual' }
  }

  return { verify: false, reason: '' }
}

export function safeStringify(value) {
  try {
    const text = JSON.stringify(value)
    return typeof text === 'string' ? text : ''
  } catch (error) {
    return ''
  }
}

function stable(value, depth) {
  if (depth > 5) return '"[deep]"'
  if (value === null || typeof value !== 'object') {
    const text = JSON.stringify(value)
    return typeof text === 'string' ? text : 'null'
  }
  if (Array.isArray(value)) {
    return '[' + value.map(function (item) { return stable(item, depth + 1) }).join(',') + ']'
  }
  const keys = Object.keys(value).sort()
  return '{' + keys.map(function (key) {
    return JSON.stringify(key) + ':' + stable(value[key], depth + 1)
  }).join(',') + '}'
}

// A stable signature makes "the agent ran the same failing command again"
// countable without storing any tool arguments in the receipt file.
export function signatureOf(name, args) {
  let body = ''
  try {
    body = stable(args === undefined ? null : args, 0)
  } catch (error) {
    body = ''
  }
  return String(name) + '|' + body.replace(/\s+/g, ' ').trim().slice(0, 500)
}

export function emptySummary() {
  return {
    steps: 0,
    toolCalls: 0,
    verifySteps: 0,
    failedCalls: 0,
    repeatedMax: 0,
    textChars: 0,
    distinctTools: [],
    toolCounts: [],
  }
}

export function summarize(steps) {
  const list = Array.isArray(steps) ? steps : []
  const counts = new Map()
  const byName = new Map()
  let toolCalls = 0
  let verifySteps = 0
  let failedCalls = 0
  let textChars = 0

  for (const step of list) {
    if (step === null || typeof step !== 'object') continue
    textChars += Number(step.textChars) || 0
    const calls = Array.isArray(step.toolCalls) ? step.toolCalls : []
    for (const call of calls) {
      if (call === null || typeof call !== 'object') continue
      toolCalls += 1
      if (call.verify === true) verifySteps += 1
      if (call.failed === true) failedCalls += 1
      const signature = typeof call.signature === 'string' ? call.signature : String(call.name)
      counts.set(signature, (counts.get(signature) || 0) + 1)
      const name = String(call.name)
      byName.set(name, (byName.get(name) || 0) + 1)
    }
  }

  const repeatedMax = counts.size === 0 ? 0 : Math.max.apply(null, Array.from(counts.values()))
  const toolCounts = Array.from(byName.entries())
    .map(function (entry) { return { name: entry[0], count: entry[1] } })
    .sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name) })

  return {
    steps: list.length,
    toolCalls: toolCalls,
    verifySteps: verifySteps,
    failedCalls: failedCalls,
    repeatedMax: repeatedMax,
    textChars: textChars,
    distinctTools: toolCounts.map(function (item) { return item.name }).sort(),
    toolCounts: toolCounts,
  }
}

// Deterministic three-way verdict. It answers "what did the window look like
// after the sentence?" — not "did the sentence cause it?". The README says the
// same thing to the user.
export function verdictOf(before, after) {
  const b = before || emptySummary()
  const a = after || emptySummary()
  const worked = a.toolCalls > 0

  const verifyUp = a.verifySteps > b.verifySteps
  const loopBroken = b.repeatedMax >= 2 && a.repeatedMax < b.repeatedMax
  const newTool = a.distinctTools.some(function (name) { return b.distinctTools.indexOf(name) < 0 })
  const failureDrop = b.failedCalls >= 2 && a.failedCalls < b.failedCalls

  if (worked && (verifyUp || loopBroken || (newTool && a.toolCalls >= b.toolCalls) || failureDrop)) {
    return 'changed'
  }

  const quiet = a.toolCalls <= Math.floor(b.toolCalls * 0.25)
  if (quiet && a.textChars >= 20) return 'restated'
  return 'unchanged'
}

function delta(before, after) {
  const d = Number(after) - Number(before)
  return d > 0 ? '+' + d : String(d)
}

function signed(value) {
  const n = Number(value) || 0
  return n > 0 ? '+' + n : String(n)
}

export function evidenceOf(before, after, verdict) {
  const b = before || emptySummary()
  const a = after || emptySummary()
  const parts = []

  if (b.steps < 1) parts.push('前窗没有可用步骤，只能做参考')
  if (a.steps < 1) parts.push('后窗没有完成步骤')

  if (verdict === 'changed') {
    if (a.verifySteps > b.verifySteps) parts.push('验证类步骤 ' + b.verifySteps + '→' + a.verifySteps)
    if (b.repeatedMax >= 2 && a.repeatedMax < b.repeatedMax) parts.push('重复调用峰值 ' + b.repeatedMax + '→' + a.repeatedMax)
    const added = a.distinctTools.filter(function (name) { return b.distinctTools.indexOf(name) < 0 })
    if (added.length > 0) parts.push('出现新工具：' + added.slice(0, 4).join('、'))
    if (b.failedCalls >= 2 && a.failedCalls < b.failedCalls) parts.push('失败调用 ' + b.failedCalls + '→' + a.failedCalls)
    return parts.join('；') + '。后窗确实换了做法，但不证明是这句话导致的。'
  }

  if (verdict === 'restated') {
    return '后窗只有 ' + a.textChars + ' 字说明、没有有效动作（工具调用 ' + b.toolCalls + '→' + a.toolCalls + '）。只是重述，没有新证据。'
  }

  if (verdict === 'incomplete') {
    return '窗口没走满：只收集到 ' + a.steps + ' 个完整步骤。不判定，也不进排行。'
  }

  if (verdict === 'cancelled') {
    return '手动取消，未参与排行。'
  }

  return '工具调用 ' + b.toolCalls + '→' + a.toolCalls + '，验证类 ' + b.verifySteps + '→' + a.verifySteps + '，重复峰值 ' + b.repeatedMax + '→' + a.repeatedMax + '。没有可测的做法变化。'
}

export function dateKey(ms) {
  const d = new Date(typeof ms === 'number' ? ms : Date.now())
  const pad = function (n) { return n < 10 ? '0' + n : String(n) }
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

export function clock(ms) {
  const d = new Date(typeof ms === 'number' ? ms : Date.now())
  const pad = function (n) { return n < 10 ? '0' + n : String(n) }
  return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
}

export function rankReceipts(receipts, day) {
  const target = day || dateKey()
  const groups = new Map()

  for (const receipt of Array.isArray(receipts) ? receipts : []) {
    if (receipt === null || typeof receipt !== 'object') continue
    if (receipt.verdict !== 'changed' && receipt.verdict !== 'restated' && receipt.verdict !== 'unchanged') continue
    if ((receipt.date || dateKey(receipt.at)) !== target) continue

    const key = String(receipt.lineId)
    let group = groups.get(key)
    if (group === undefined) {
      group = {
        lineId: key,
        line: receipt.line,
        tone: receipt.tone,
        uses: 0,
        changed: 0,
        restated: 0,
        unchanged: 0,
        verifyLift: 0,
        toolDelta: 0,
      }
      groups.set(key, group)
    }
    group.uses += 1
    if (receipt.verdict === 'changed') group.changed += 1
    if (receipt.verdict === 'restated') group.restated += 1
    if (receipt.verdict === 'unchanged') group.unchanged += 1
    const before = receipt.before || emptySummary()
    const after = receipt.after || emptySummary()
    group.verifyLift += Math.max(0, (after.verifySteps || 0) - (before.verifySteps || 0))
    group.toolDelta += (after.toolCalls || 0) - (before.toolCalls || 0)
  }

  return Array.from(groups.values())
    .sort(function (a, b) {
      return b.changed - a.changed ||
        b.verifyLift - a.verifyLift ||
        b.uses - a.uses ||
        String(a.lineId).localeCompare(String(b.lineId))
    })
    .map(function (group, index) {
      group.rank = index + 1
      return group
    })
}

const VERDICT_LABEL = {
  changed: '改变了做法',
  restated: '只是重述',
  unchanged: '无变化',
  pending: '待结算',
  incomplete: '证据不足',
  cancelled: '已取消',
}

export function verdictLabel(verdict) {
  return VERDICT_LABEL[verdict] || String(verdict)
}

export function formatReceipt(receipt) {
  const r = receipt || {}
  const before = r.before || emptySummary()
  const after = r.after || emptySummary()
  const lines = []
  lines.push('【PUA 回执 ' + String(r.id || '') + '】')
  lines.push('「' + String(r.line || '') + '」')
  lines.push('判定：' + verdictLabel(r.verdict) + '（窗口 ' + before.steps + '/' + r.rounds + ' → ' + after.steps + '/' + r.rounds + ' 轮）')
  lines.push('前：工具 ' + before.toolCalls + ' · 验证 ' + before.verifySteps + ' · 重复峰值 ' + before.repeatedMax)
  lines.push('后：工具 ' + after.toolCalls + ' · 验证 ' + after.verifySteps + ' · 重复峰值 ' + after.repeatedMax)
  lines.push('Δ：工具 ' + signed(after.toolCalls - before.toolCalls) + ' · 验证 ' + signed(after.verifySteps - before.verifySteps))
  if (r.evidence) lines.push('依据：' + r.evidence)
  return lines.join('\n')
}

export function formatRank(ranking, day) {
  const list = Array.isArray(ranking) ? ranking : []
  const head = '今天哪句话真的推动了工作' + (day ? '（' + day + '）' : '')
  if (list.length === 0) return head + '\n还没有完成的回执。'
  const rows = list.map(function (item) {
    return item.rank + '. 「' + item.line + '」\n   ' +
      '施压 ' + item.uses + ' 次 · 改变 ' + item.changed + ' · 重述 ' + item.restated +
      ' · 无变化 ' + item.unchanged + ' · 验证提升 ' + signed(item.verifyLift)
  })
  return head + '\n' + rows.join('\n')
}

// Kept for callers that only need the numeric comparison in one line.
export function comparisonLine(before, after) {
  const b = before || emptySummary()
  const a = after || emptySummary()
  return '工具 ' + b.toolCalls + '→' + a.toolCalls + '（' + delta(b.toolCalls, a.toolCalls) + '） · ' +
    '验证 ' + b.verifySteps + '→' + a.verifySteps + '（' + delta(b.verifySteps, a.verifySteps) + '）'
}
