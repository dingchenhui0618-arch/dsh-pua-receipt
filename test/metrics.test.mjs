import { strict as assert } from 'node:assert'
import test from 'node:test'
import {
  LINES,
  findLine,
  lineAt,
  lineByNumber,
  lineLabel,
  lineNumber,
} from '../src/library.js'
import {
  classifyCall,
  comparisonLine,
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
} from '../src/metrics.js'

function summary(overrides) {
  return Object.assign(emptySummary(), overrides || {})
}

test('the sentence bank has 15 unique, non-empty, attributable lines', () => {
  assert.equal(LINES.length, 15)
  assert.equal(new Set(LINES.map((line) => line.id)).size, 15)
  assert.equal(new Set(LINES.map((line) => line.text)).size, 15)
  for (const line of LINES) {
    assert.ok(line.id.length > 0)
    assert.ok(line.tone.length > 0)
    assert.ok(line.text.length > 0)
  }
})

test('line lookup is one-based and rejects out-of-range numbers', () => {
  assert.equal(lineByNumber(1), LINES[0])
  assert.equal(lineByNumber(15), LINES[14])
  assert.equal(lineByNumber(0), undefined)
  assert.equal(lineByNumber(16), undefined)
  assert.equal(lineNumber('test'), 14)
  assert.match(lineLabel(LINES[13]), /第 14 条/)
})

test('lineAt rotates and wraps, and findLine accepts id or tone', () => {
  assert.equal(lineAt(0), LINES[0])
  assert.equal(lineAt(15), LINES[0])
  assert.equal(lineAt(-1), LINES[14])
  assert.equal(findLine('evidence').id, 'evidence')
  assert.equal(findLine('证据').id, 'evidence')
  assert.equal(findLine('nope'), undefined)
})

test('verification commands are recognised across common toolchains', () => {
  assert.equal(classifyCall('pwsh', { command: 'node --test' }).verify, true)
  assert.equal(classifyCall('pwsh', { command: 'npm test' }).verify, true)
  assert.equal(classifyCall('pwsh', { command: 'pnpm run build' }).verify, true)
  assert.equal(classifyCall('pwsh', { command: 'pytest -q' }).verify, true)
  assert.equal(classifyCall('pwsh', { command: 'cargo test' }).verify, true)
  assert.equal(classifyCall('pwsh', { command: 'git diff --stat' }).verify, true)
  assert.equal(classifyCall('pwsh', { command: 'Get-FileHash .\\a.zip' }).verify, true)
  assert.equal(classifyCall('pwsh', { command: 'gh pr checks 12' }).verify, true)
  assert.equal(classifyCall('pwsh', { command: 'curl -s http://127.0.0.1:3080/health' }).verify, true)
})

test('ordinary commands are not verification', () => {
  assert.equal(classifyCall('pwsh', { command: 'git add -A' }).verify, false)
  assert.equal(classifyCall('pwsh', { command: 'node scripts/build.mjs' }).verify, false)
  assert.equal(classifyCall('write', { file_path: 'src/a.js', content: 'x' }).verify, false)
})

test('reading tests, logs and screenshots counts as verification', () => {
  assert.equal(classifyCall('read', { file_path: 'test/host.test.mjs' }).verify, true)
  assert.equal(classifyCall('read', { file_path: 'C:\\repo\\coverage\\index.html' }).verify, true)
  assert.equal(classifyCall('read', { file_path: 'build.log' }).verify, true)
  assert.equal(classifyCall('read', { file_path: 'src/host.js' }).verify, false)
  assert.equal(classifyCall('grep', { path: 'test', pattern: 'assert' }).verify, true)
  assert.equal(classifyCall('glob', { pattern: 'test/**/*.mjs' }).verify, true)
  assert.equal(classifyCall('read_image', { file_path: 'shot.png' }).verify, true)
  assert.equal(classifyCall('computer', { action: 'screenshot' }).verify, true)
  assert.equal(classifyCall('computer', { action: 'left_click' }).verify, false)
  assert.equal(classifyCall('bash', { command: ['npm', 'run', 'lint'] }).verify, true)
})

test('a signature ignores key order and collapses whitespace', () => {
  const a = signatureOf('pwsh', { command: 'node   --test', cwd: 'D:\\x' })
  const b = signatureOf('pwsh', { cwd: 'D:\\x', command: 'node --test' })
  assert.equal(a, b)
  assert.notEqual(a, signatureOf('pwsh', { command: 'node --test', cwd: 'D:\\y' }))
})

test('summarize aggregates calls, failures, repeats and text', () => {
  const steps = [
    {
      textChars: 10,
      toolCalls: [
        { name: 'read', verify: true, failed: false, signature: 'read|a' },
        { name: 'read', verify: true, failed: false, signature: 'read|a' },
      ],
    },
    {
      textChars: 5,
      toolCalls: [
        { name: 'write', verify: false, failed: true, signature: 'write|b' },
      ],
    },
  ]
  const out = summarize(steps)
  assert.equal(out.steps, 2)
  assert.equal(out.toolCalls, 3)
  assert.equal(out.verifySteps, 2)
  assert.equal(out.failedCalls, 1)
  assert.equal(out.repeatedMax, 2)
  assert.equal(out.textChars, 15)
  assert.deepEqual(out.distinctTools, ['read', 'write'])
  assert.deepEqual(out.toolCounts, [{ name: 'read', count: 2 }, { name: 'write', count: 1 }])
})

test('changed: more verification steps in the after-window', () => {
  const before = summary({ steps: 3, toolCalls: 6, verifySteps: 0 })
  const after = summary({ steps: 3, toolCalls: 6, verifySteps: 2, distinctTools: ['pwsh'] })
  assert.equal(verdictOf(before, after), 'changed')
  assert.match(evidenceOf(before, after, 'changed'), /验证类步骤 0→2/)
})

test('changed: breaking a repeated-call loop', () => {
  const before = summary({ steps: 3, toolCalls: 8, repeatedMax: 5, distinctTools: ['pwsh'] })
  const after = summary({ steps: 3, toolCalls: 4, repeatedMax: 1, distinctTools: ['pwsh'] })
  assert.equal(verdictOf(before, after), 'changed')
  assert.match(evidenceOf(before, after, 'changed'), /重复调用峰值 5→1/)
})

test('changed: a new tool appears without losing volume', () => {
  const before = summary({ steps: 3, toolCalls: 2, distinctTools: ['write'] })
  const after = summary({ steps: 3, toolCalls: 2, distinctTools: ['write', 'read'] })
  assert.equal(verdictOf(before, after), 'changed')
  assert.match(evidenceOf(before, after, 'changed'), /新工具：read/)
})

test('changed: failed calls drop', () => {
  const before = summary({ steps: 3, toolCalls: 3, failedCalls: 3, distinctTools: ['pwsh'] })
  const after = summary({ steps: 3, toolCalls: 3, failedCalls: 0, distinctTools: ['pwsh'] })
  assert.equal(verdictOf(before, after), 'changed')
  assert.match(evidenceOf(before, after, 'changed'), /失败调用 3→0/)
})

test('restated: text without effective action', () => {
  const before = summary({ steps: 3, toolCalls: 8, distinctTools: ['write'] })
  const after = summary({ steps: 3, toolCalls: 0, textChars: 240 })
  assert.equal(verdictOf(before, after), 'restated')
  assert.match(evidenceOf(before, after, 'restated'), /只是重述/)
})

test('unchanged: same volume and no new evidence', () => {
  const before = summary({ steps: 3, toolCalls: 6, repeatedMax: 6, distinctTools: ['write'] })
  const after = summary({ steps: 3, toolCalls: 6, repeatedMax: 6, distinctTools: ['write'] })
  assert.equal(verdictOf(before, after), 'unchanged')
  assert.match(evidenceOf(before, after, 'unchanged'), /没有可测的做法变化/)
})

test('an empty after-window is not silently called changed', () => {
  const before = summary({ steps: 3, toolCalls: 4, distinctTools: ['write'] })
  const after = emptySummary()
  assert.equal(verdictOf(before, after), 'unchanged')
})

test('incomplete and cancelled receipts explain themselves and stay out of ranking', () => {
  const before = summary({ steps: 3, toolCalls: 4 })
  const after = summary({ steps: 1, toolCalls: 1 })
  assert.match(evidenceOf(before, after, 'incomplete'), /窗口没走满/)
  assert.match(evidenceOf(before, after, 'cancelled'), /未参与排行/)
  const receipts = [
    { verdict: 'incomplete', lineId: 'a', line: 'A', date: '2026-10-27', before, after },
    { verdict: 'cancelled', lineId: 'b', line: 'B', date: '2026-10-27', before, after },
  ]
  assert.deepEqual(rankReceipts(receipts, '2026-10-27'), [])
})

test('ranking sorts by changed count, then verification lift, then uses', () => {
  const before = summary({ steps: 3, toolCalls: 4, verifySteps: 0 })
  const receipts = [
    { verdict: 'unchanged', lineId: 'a', line: 'A', tone: 'x', date: '2026-10-27', before, after: before },
    { verdict: 'changed', lineId: 'a', line: 'A', tone: 'x', date: '2026-10-27', before, after: summary({ steps: 3, toolCalls: 4, verifySteps: 1 }) },
    { verdict: 'changed', lineId: 'b', line: 'B', tone: 'y', date: '2026-10-27', before, after: summary({ steps: 3, toolCalls: 4, verifySteps: 4 }) },
    { verdict: 'restated', lineId: 'c', line: 'C', tone: 'z', date: '2026-10-27', before, after: summary({ steps: 3, textChars: 80 }) },
    { verdict: 'changed', lineId: 'd', line: 'D', tone: 'w', date: '2026-10-26', before, after: summary({ steps: 3, verifySteps: 9 }) },
  ]
  const ranking = rankReceipts(receipts, '2026-10-27')
  assert.equal(ranking.length, 3)
  assert.equal(ranking[0].lineId, 'b')
  assert.equal(ranking[0].verifyLift, 4)
  assert.equal(ranking[1].lineId, 'a')
  assert.equal(ranking[1].changed, 1)
  assert.equal(ranking[2].lineId, 'c')
  assert.equal(ranking[2].rank, 3)
})

test('receipt and rank formatters carry the verdict and the numbers', () => {
  const before = summary({ steps: 3, toolCalls: 8, verifySteps: 0, repeatedMax: 4 })
  const after = summary({ steps: 3, toolCalls: 6, verifySteps: 2, repeatedMax: 1 })
  const receipt = {
    id: 'r1',
    line: '先别解释，把证据拿出来。',
    verdict: 'changed',
    rounds: 3,
    before,
    after,
    evidence: evidenceOf(before, after, 'changed'),
  }
  const text = formatReceipt(receipt)
  assert.match(text, /改变了做法/)
  assert.match(text, /验证 0 · 重复峰值 4/)
  assert.match(text, /验证 \+2/)

  const rank = formatRank([{ rank: 1, line: '甲', uses: 2, changed: 2, restated: 0, unchanged: 0, verifyLift: 5 }], '2026-10-27')
  assert.match(rank, /今天哪句话真的推动了工作/)
  assert.match(rank, /「甲」/)
  assert.match(rank, /验证提升 \+5/)

  assert.equal(verdictLabel('changed'), '改变了做法')
  assert.match(comparisonLine(before, after), /工具 8→6/)
  assert.match(dateKey(new Date(2026, 9, 27).getTime()), /^2026-10-27$/)
})
