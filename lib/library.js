// The measured sentence bank.
//
// These fifteen lines are original to dsh-pua-receipt. They are deliberately
// short, attributable and individually measurable: a receipt points at exactly
// one id, so the end-of-day ranking can say which sentence preceded a behaviour
// change. Renaming an id breaks the historical ranking; add a new id instead.

export const LINES = [
  { id: 'deadline', tone: '期限', text: '这个需求今天必须落地，别再给我方案了。' },
  { id: 'evidence', tone: '证据', text: '先别解释，把证据拿出来。' },
  { id: 'proof', tone: '交付', text: '我不要听「应该可以」，我要看到它跑通。' },
  { id: 'method', tone: '方法', text: '同样的问题出现第二次，就说明方法错了。' },
  { id: 'reflection', tone: '复盘', text: '你是在解决问题，还是在重复劳动？' },
  { id: 'risk', tone: '风险', text: '这个结果放到线上，你敢签字吗？' },
  { id: 'root-cause', tone: '根因', text: '别只改表面，找到根因再动手。' },
  { id: 'reproduce', tone: '复现', text: '我要的是可复现的结论，不是一次运气。' },
  { id: 'scope', tone: '范围', text: '先把最小闭环跑通，再谈优化。' },
  { id: 'progress', tone: '进度', text: '你现在的进度，对得起这个时间点吗？' },
  { id: 'data', tone: '数据', text: '别让我替你做判断，把数据摆出来。' },
  { id: 'pivot', tone: '换路', text: '如果这条路走不通，就换一条，不要硬撑。' },
  { id: 'self-check', tone: '自检', text: '交付前自己先验一遍，别等人来挑错。' },
  { id: 'test', tone: '测试', text: '这个 bug 修没修好，用测试说话。' },
  { id: 'urgency', tone: '紧迫', text: '今天可以做完的事，不要留到明天。' },
]

export function lineAt(index) {
  const n = Number(index)
  if (!Number.isFinite(n)) return LINES[0]
  const i = ((Math.trunc(n) % LINES.length) + LINES.length) % LINES.length
  return LINES[i]
}

export function lineByNumber(oneBased) {
  const n = Number(oneBased)
  if (!Number.isInteger(n) || n < 1 || n > LINES.length) return undefined
  return LINES[n - 1]
}

export function findLine(query) {
  const text = String(query === undefined || query === null ? '' : query).trim().toLowerCase()
  if (text.length === 0) return undefined
  return LINES.find(function (line) {
    return line.id === text || line.tone === text || line.text === text
  })
}

export function lineNumber(id) {
  const index = LINES.findIndex(function (line) { return line.id === id })
  return index < 0 ? 1 : index + 1
}

export function lineLabel(line) {
  return '第 ' + lineNumber(line.id) + ' 条 · ' + line.tone
}
