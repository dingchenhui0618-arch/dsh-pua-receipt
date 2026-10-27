/* dsh-pua-receipt client bundle — generated from src/client.cjs */
window.__ModuleLoader__.load({
  id: "dsh-pua-receipt",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
// Client half of dsh-pua-receipt: the 回执 Tab in the conversation view.
//
// Must stay CommonJS — the build wraps this in window.__ModuleLoader__.load()
// and React is supplied by the harness.

const React = require('react')
const h = React.createElement
const CSS = ".pr-root{height:100%;overflow:auto;color:inherit;font-size:13px;line-height:1.5}.pr-shell{max-width:940px;margin:0 auto;padding:22px 22px 32px;display:flex;flex-direction:column;gap:20px}.pr-head{display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap}.pr-kicker{font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.42;margin-bottom:4px}.pr-title{margin:0;font-size:21px;font-weight:650;letter-spacing:-.015em;line-height:1.2}.pr-sub{font-size:12px;opacity:.58;margin-top:6px;max-width:620px}.pr-pill{margin-left:auto;font-size:11px;padding:4px 10px;border-radius:999px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);opacity:.7;white-space:nowrap}.pr-error{border:1px solid color-mix(in srgb,#dc2626 50%,transparent);background:color-mix(in srgb,#dc2626 7%,transparent);border-radius:8px;padding:8px 11px;font-size:12px}.pr-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.pr-stat{border:1px solid color-mix(in srgb,currentColor 13%,transparent);border-radius:9px;padding:9px 11px}.pr-stat b{display:block;font-size:19px;font-weight:620;font-variant-numeric:tabular-nums;line-height:1.15}.pr-stat span{font-size:11px;opacity:.55}.pr-stat.good b{color:color-mix(in srgb,#0f766e 78%,currentColor)}.pr-stat.warn b{color:color-mix(in srgb,#b45309 78%,currentColor)}.pr-stat.info b{color:color-mix(in srgb,#2563eb 78%,currentColor)}.pr-section{display:flex;flex-direction:column;gap:9px}.pr-section-head{display:flex;align-items:baseline;gap:9px}.pr-section-title{font-size:12px;font-weight:600;letter-spacing:.03em;opacity:.78}.pr-section-note{margin-left:auto;font-size:11px;opacity:.4;font-variant-numeric:tabular-nums}.pr-active{border:1px solid color-mix(in srgb,#2563eb 38%,transparent);background:color-mix(in srgb,#2563eb 6%,transparent);border-radius:10px;padding:11px 13px}.pr-active-top{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.pr-active-label{font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,#2563eb 80%,currentColor)}.pr-active-count{font-size:11px;opacity:.55;font-variant-numeric:tabular-nums}.pr-dots{display:flex;gap:4px;margin-left:auto}.pr-dot{width:18px;height:4px;border-radius:999px;background:color-mix(in srgb,currentColor 16%,transparent)}.pr-dot.on{background:color-mix(in srgb,#2563eb 70%,transparent)}.pr-active-line{font-size:13px;font-weight:500;margin-top:8px;line-height:1.5}.pr-active-meta{font-size:11px;opacity:.55;margin-top:5px;font-variant-numeric:tabular-nums}.pr-rank{border:1px solid color-mix(in srgb,currentColor 13%,transparent);border-radius:10px;overflow:hidden}.pr-rank-row{display:grid;grid-template-columns:30px minmax(0,1fr) 42px;gap:12px;align-items:center;padding:11px 14px;border-top:1px solid color-mix(in srgb,currentColor 8%,transparent)}.pr-rank-row:first-child{border-top:0}.pr-rank-row.top{background:color-mix(in srgb,#0f766e 6%,transparent)}.pr-rank-no{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;opacity:.42;font-variant-numeric:tabular-nums}.pr-rank-row.top .pr-rank-no{opacity:.85;color:color-mix(in srgb,#0f766e 80%,currentColor)}.pr-rank-line{font-size:13px;font-weight:500;line-height:1.4;overflow-wrap:anywhere}.pr-rank-meta{font-size:11px;opacity:.52;margin-top:3px;font-variant-numeric:tabular-nums}.pr-bar{height:3px;border-radius:999px;background:color-mix(in srgb,currentColor 10%,transparent);margin-top:7px;overflow:hidden}.pr-bar span{display:block;height:100%;border-radius:999px;background:color-mix(in srgb,#0f766e 72%,transparent)}.pr-rank-rate{font-size:11px;text-align:right;opacity:.55;font-variant-numeric:tabular-nums}.pr-empty{border:1px dashed color-mix(in srgb,currentColor 20%,transparent);border-radius:10px;padding:16px;font-size:12px;opacity:.6}.pr-empty code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:4px;padding:0 4px}.pr-cards{display:flex;flex-direction:column;gap:10px}.pr-card{border:1px solid color-mix(in srgb,currentColor 13%,transparent);border-left:3px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:10px;padding:12px 14px 10px}.pr-card.pr-good{border-left-color:color-mix(in srgb,#0f766e 72%,transparent)}.pr-card.pr-warn{border-left-color:color-mix(in srgb,#b45309 72%,transparent)}.pr-card.pr-info{border-left-color:color-mix(in srgb,#2563eb 72%,transparent)}.pr-card-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.pr-id{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;opacity:.45}.pr-tag{font-size:10px;letter-spacing:.03em;padding:1px 7px;border-radius:999px;border:1px solid color-mix(in srgb,currentColor 16%,transparent);opacity:.62}.pr-time{font-size:11px;opacity:.4;font-variant-numeric:tabular-nums}.pr-badge{margin-left:auto;font-size:10.5px;padding:1px 9px;border-radius:999px;border:1px solid transparent;white-space:nowrap}.pr-badge.pr-good{background:color-mix(in srgb,#0f766e 14%,transparent);color:color-mix(in srgb,#0f766e 85%,currentColor);border-color:color-mix(in srgb,#0f766e 30%,transparent)}.pr-badge.pr-warn{background:color-mix(in srgb,#b45309 14%,transparent);color:color-mix(in srgb,#b45309 85%,currentColor);border-color:color-mix(in srgb,#b45309 30%,transparent)}.pr-badge.pr-info{background:color-mix(in srgb,#2563eb 14%,transparent);color:color-mix(in srgb,#2563eb 85%,currentColor);border-color:color-mix(in srgb,#2563eb 30%,transparent)}.pr-badge.pr-mute{background:color-mix(in srgb,currentColor 7%,transparent);opacity:.7}.pr-quote{font-size:13px;font-weight:500;line-height:1.55;margin:9px 0 11px;overflow-wrap:anywhere}.pr-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.pr-metric{border:1px solid color-mix(in srgb,currentColor 10%,transparent);border-radius:7px;padding:6px 9px}.pr-metric-label{font-size:10px;opacity:.48;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pr-metric-value{font-size:15px;font-weight:560;font-variant-numeric:tabular-nums;margin-top:1px;white-space:nowrap}.pr-before{opacity:.42}.pr-pending{opacity:.5}.pr-arrow{opacity:.3;font-size:12px}.pr-delta{font-size:10.5px;font-weight:500;margin-left:6px;opacity:.55}.pr-delta.good{color:color-mix(in srgb,#0f766e 82%,currentColor);opacity:1}.pr-delta.bad{color:color-mix(in srgb,#b45309 82%,currentColor);opacity:1}.pr-tools{display:flex;flex-wrap:wrap;gap:4px;margin-top:9px}.pr-chip{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;padding:1px 6px;border-radius:4px;background:color-mix(in srgb,currentColor 7%,transparent);opacity:.65}.pr-evidence{font-size:11.5px;line-height:1.55;opacity:.66;margin-top:9px;padding-left:9px;border-left:2px solid color-mix(in srgb,currentColor 14%,transparent)}.pr-foot{display:flex;justify-content:space-between;gap:8px;font-size:10.5px;opacity:.38;margin-top:8px;font-variant-numeric:tabular-nums}.pr-foot-note{font-size:11px;opacity:.38;line-height:1.5;border-top:1px solid color-mix(in srgb,currentColor 8%,transparent);padding-top:12px}@media (max-width:720px){.pr-shell{padding:16px 14px 24px}.pr-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.pr-metrics{grid-template-columns:1fr}.pr-pill{margin-left:0}}"

const API = '/dsh-pua-receipt'
const POLL_MS = 1200

let snap = { data: null, error: '', at: 0 }
const listeners = new Set()
let timer = null

function emit() {
  Array.from(listeners).forEach(function (fn) {
    try {
      fn(snap)
    } catch (error) {
      if (typeof console !== 'undefined' && console.warn) console.warn('[dsh-pua-receipt] listener failed', error)
    }
  })
}

function load() {
  fetch(API + '/state', { headers: { accept: 'application/json' } })
    .then(function (res) { return res.json() })
    .then(function (data) {
      snap = { data: data, error: '', at: Date.now() }
      emit()
    })
    .catch(function (error) {
      snap = { data: snap.data, error: String((error && error.message) || error), at: Date.now() }
      emit()
    })
}

function subscribe(fn) {
  listeners.add(fn)
  if (timer === null) {
    load()
    timer = setInterval(load, POLL_MS)
  }
  fn(snap)
  return function () {
    listeners.delete(fn)
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }
}

function pad(n) { return n < 10 ? '0' + n : String(n) }

function clock(ms) {
  const d = new Date(ms)
  return pad(d.getHours()) + ':' + pad(d.getMinutes())
}

function signed(n) {
  const value = Number(n) || 0
  return value > 0 ? '+' + value : String(value)
}

const VERDICT = {
  changed: { label: '改变了做法', tone: 'pr-good' },
  restated: { label: '只是重述', tone: 'pr-warn' },
  unchanged: { label: '无变化', tone: 'pr-mute' },
  pending: { label: '待结算', tone: 'pr-info' },
  incomplete: { label: '证据不足', tone: 'pr-mute' },
  cancelled: { label: '已取消', tone: 'pr-mute' },
}

function verdictOf(verdict) {
  return VERDICT[verdict] || { label: String(verdict), tone: 'pr-mute' }
}

function Stat(props) {
  return h('div', { className: 'pr-stat ' + (props.tone || '') },
    h('b', null, String(props.value)),
    h('span', null, props.label),
  )
}

function Metric(props) {
  const before = Number(props.before) || 0
  const after = Number(props.after) || 0
  const delta = after - before
  let deltaTone = ''
  if (props.goodWhen === 'up' && delta > 0) deltaTone = 'good'
  if (props.goodWhen === 'down' && delta < 0) deltaTone = 'good'
  if (props.goodWhen === 'up' && delta < 0) deltaTone = 'bad'
  if (props.goodWhen === 'down' && delta > 0) deltaTone = 'bad'
  if (props.pending) {
    return h('div', { className: 'pr-metric' },
      h('div', { className: 'pr-metric-label' }, props.label),
      h('div', { className: 'pr-metric-value' },
        h('span', { className: 'pr-before' }, String(before)),
        h('span', { className: 'pr-arrow' }, ' → '),
        h('span', { className: 'pr-pending' }, '—'),
        h('span', { className: 'pr-delta' }, '待结算'),
      ),
    )
  }
  return h('div', { className: 'pr-metric' },
    h('div', { className: 'pr-metric-label' }, props.label),
    h('div', { className: 'pr-metric-value' },
      h('span', { className: 'pr-before' }, String(before)),
      h('span', { className: 'pr-arrow' }, ' → '),
      h('span', null, String(after)),
      h('span', { className: 'pr-delta ' + deltaTone }, delta === 0 ? '±0' : signed(delta)),
    ),
  )
}

function ActiveCard(props) {
  const active = props.active
  const dots = []
  for (let i = 0; i < active.rounds; i += 1) {
    dots.push(h('span', { key: String(i), className: 'pr-dot' + (i < active.collected ? ' on' : '') }))
  }
  return h('div', { className: 'pr-active' },
    h('div', { className: 'pr-active-top' },
      h('span', { className: 'pr-active-label' }, active.started ? '实验进行中' : '等待下一步'),
      h('span', { className: 'pr-active-count' }, active.collected + '/' + active.rounds + ' 轮'),
      h('span', { className: 'pr-dots' }, dots),
    ),
    h('div', { className: 'pr-active-line' }, '「' + active.line + '」'),
    h('div', { className: 'pr-active-meta' },
      '前窗 ' + active.before.steps + ' 轮 · 工具 ' + active.before.toolCalls +
      ' · 验证 ' + active.before.verifySteps + ' · 重复峰值 ' + active.before.repeatedMax,
    ),
  )
}

function RankRow(props) {
  const item = props.item
  const rate = item.uses > 0 ? Math.round((item.changed / item.uses) * 100) : 0
  return h('div', { className: 'pr-rank-row' + (item.rank === 1 ? ' top' : '') },
    h('div', { className: 'pr-rank-no' }, pad(item.rank)),
    h('div', { className: 'pr-rank-main' },
      h('div', { className: 'pr-rank-line' }, '「' + item.line + '」'),
      h('div', { className: 'pr-rank-meta' },
        item.uses + ' 次施压 · 改变 ' + item.changed + ' · 重述 ' + item.restated +
        ' · 无变化 ' + item.unchanged + ' · 验证 ' + signed(item.verifyLift),
      ),
      h('div', { className: 'pr-bar' }, h('span', { style: { width: rate + '%' } })),
    ),
    h('div', { className: 'pr-rank-rate' }, rate + '%'),
  )
}

function ReceiptCard(props) {
  const receipt = props.receipt
  const meta = verdictOf(receipt.verdict)
  const before = receipt.before || { steps: 0, toolCalls: 0, verifySteps: 0, repeatedMax: 0, toolCounts: [] }
  const after = receipt.after || { steps: 0, toolCalls: 0, verifySteps: 0, repeatedMax: 0, toolCounts: [] }
  const chips = (after.toolCounts || []).slice(0, 5)
  const pending = receipt.verdict === 'pending'

  return h('article', { className: 'pr-card ' + meta.tone },
    h('div', { className: 'pr-card-head' },
      h('span', { className: 'pr-id' }, '#' + pad(receipt.lineNo || 0)),
      h('span', { className: 'pr-tag' }, receipt.tone || '话术'),
      h('span', { className: 'pr-time' }, clock(receipt.at)),
      h('span', { className: 'pr-badge ' + meta.tone }, meta.label),
    ),
    h('div', { className: 'pr-quote' }, '「' + receipt.line + '」'),
    h('div', { className: 'pr-metrics' },
      h(Metric, { label: '工具调用', before: before.toolCalls, after: after.toolCalls, pending: pending }),
      h(Metric, { label: '验证类步骤', before: before.verifySteps, after: after.verifySteps, goodWhen: 'up', pending: pending }),
      h(Metric, { label: '重复调用峰值', before: before.repeatedMax, after: after.repeatedMax, goodWhen: 'down', pending: pending }),
    ),
    chips.length > 0 ? h('div', { className: 'pr-tools' },
      chips.map(function (chip) {
        return h('span', { key: chip.name, className: 'pr-chip' }, chip.name + ' ×' + chip.count)
      }),
    ) : null,
    h('div', { className: 'pr-evidence' }, receipt.evidence || '等待后窗结算。'),
    h('div', { className: 'pr-foot' },
      h('span', null, pending
        ? '窗口 ' + before.steps + '/' + receipt.rounds + ' → 等待后窗'
        : '窗口 ' + before.steps + '/' + receipt.rounds + ' → ' + after.steps + '/' + receipt.rounds + ' 轮'),
      h('span', null, receipt.completedAt ? '结算于 ' + clock(receipt.completedAt) : '进行中'),
    ),
  )
}

function PuaReceiptView() {
  const [state, setState] = React.useState(snap)
  React.useEffect(function () { return subscribe(setState) }, [])

  const data = state.data
  const stats = (data && data.stats) || { today: 0, changed: 0, restated: 0, unchanged: 0, pending: 0 }
  const active = (data && data.active) || []
  const receipts = (data && data.receipts) || []
  const ranking = (data && data.ranking) || []
  const rounds = (data && data.config && data.config.rounds) || 3

  return h('div', { className: 'pr-root' },
    h('div', { className: 'pr-shell' },
      h('header', { className: 'pr-head' },
        h('div', null,
          h('div', { className: 'pr-kicker' }, 'DSH · /PUA'),
          h('h2', { className: 'pr-title' }, '施压回执'),
          h('div', { className: 'pr-sub' }, '每次 /pua 对比前后 ' + rounds + ' 轮：工具调用、验证类步骤、重复调用。'),
        ),
        h('div', { className: 'pr-pill' }, '观察窗口 ' + rounds + ' 轮'),
      ),

      state.error ? h('div', { className: 'pr-error' }, '与 host 通信失败：' + state.error) : null,

      h('div', { className: 'pr-stats' },
        h(Stat, { label: '今日施压', value: stats.today }),
        h(Stat, { label: '改变了做法', value: stats.changed, tone: 'good' }),
        h(Stat, { label: '只是重述', value: stats.restated, tone: 'warn' }),
        h(Stat, { label: '无变化', value: stats.unchanged }),
        h(Stat, { label: '待结算', value: stats.pending, tone: 'info' }),
      ),

      active.length > 0 ? h('section', { className: 'pr-section' },
        h('div', { className: 'pr-section-head' },
          h('span', { className: 'pr-section-title' }, '进行中'),
          h('span', { className: 'pr-section-note' }, active.length + ' 条'),
        ),
        active.map(function (item) { return h(ActiveCard, { key: item.id, active: item }) }),
      ) : null,

      h('section', { className: 'pr-section' },
        h('div', { className: 'pr-section-head' },
          h('span', { className: 'pr-section-title' }, '今天哪句话真的推动了工作'),
          h('span', { className: 'pr-section-note' }, data ? data.today : ''),
        ),
        ranking.length === 0
          ? h('div', { className: 'pr-empty' },
            '还没有完成的回执。在对话里输入 ',
            h('code', null, '/pua'),
            '，之后 ' + rounds + ' 轮会生成第一张。',
          )
          : h('div', { className: 'pr-rank' }, ranking.map(function (item) {
            return h(RankRow, { key: item.lineId, item: item })
          })),
      ),

      h('section', { className: 'pr-section' },
        h('div', { className: 'pr-section-head' },
          h('span', { className: 'pr-section-title' }, '回执'),
          h('span', { className: 'pr-section-note' }, receipts.length > 0 ? '最近 ' + receipts.length + ' 张' : ''),
        ),
        receipts.length === 0
          ? h('div', { className: 'pr-empty' }, '没有记录。施压前后各 ' + rounds + ' 轮的工具调用会写进这里。')
          : h('div', { className: 'pr-cards' }, receipts.map(function (receipt) {
            return h(ReceiptCard, { key: receipt.id, receipt: receipt })
          })),
      ),

      h('footer', { className: 'pr-foot-note' },
        data && data.note ? data.note : '回执只记录前后差异，不证明因果。',
      ),
    ),
  )
}

function apply(ctx) {
  // dsh can unload a plugin at runtime, so every registration here has a
  // matching teardown. The shared poll lives at module scope and therefore
  // outlives one apply(); unmounting the view is not guaranteed on unload, so
  // it needs an explicit disposer of its own.
  ctx.effect(function () {
    return function () {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
      listeners.clear()
      snap = { data: null, error: '', at: 0 }
    }
  })

  ctx.effect(function () {
    const style = document.createElement('style')
    style.dataset.plugin = 'dsh-pua-receipt'
    style.textContent = CSS
    document.head.appendChild(style)
    return function () { style.remove() }
  })

  // Guarded, and normalised to always hand Cordis a disposer: a changed slot
  // contract must degrade this one panel and say so, not abort the client boot
  // for every other plugin in the graph.
  ctx.slots.inject('conversation.view', function () {
    let disposeView
    try {
      disposeView = ctx.slots.register(
        { name: 'conversation.view', id: 'pua-receipt', order: 31, label: '回执' },
        PuaReceiptView,
      )
    } catch (error) {
      disposeView = undefined
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[dsh-pua-receipt] could not register the 回执 view; the command still runs on the host', error)
      }
    }
    return typeof disposeView === 'function' ? disposeView : function () {}
  })
}

module.exports = {
  name: 'dsh-pua-receipt',
  inject: ['slots'],
  apply: apply,
}
    return module.exports;
  },
});
