import { strict as assert } from 'node:assert'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { apply } from '../src/host.js'

function makeHome() {
  return mkdtempSync(join(tmpdir(), 'pua-receipt-test-'))
}

function setup(options) {
  const settings = options || {}
  const listeners = new Map()
  const routes = []
  const commands = new Map()
  const disposers = []
  const prompts = []

  const webServer = {
    register(route) {
      routes.push(route)
      return function () {
        const index = routes.indexOf(route)
        if (index >= 0) routes.splice(index, 1)
      }
    },
  }

  const sessionController = settings.noChat === true ? undefined : {
    async prompt(request) {
      prompts.push(request)
      if (settings.accepted === false) return { accepted: false }
      return { accepted: true }
    },
  }

  const agents = settings.noAgents === true ? undefined : {
    get() { return { status: settings.status || 'running' } },
  }

  const services = {
    webServer: webServer,
    sessionController: sessionController,
    agents: agents,
  }

  const ctx = {
    get(name) { return services[name] },
    on(event, listener) {
      const list = listeners.get(event) || []
      list.push(listener)
      listeners.set(event, list)
      const dispose = function () {
        const current = listeners.get(event) || []
        const index = current.indexOf(listener)
        if (index >= 0) current.splice(index, 1)
        if (current.length === 0) listeners.delete(event)
      }
      disposers.push(dispose)
      return dispose
    },
    effect(fn) {
      const dispose = fn()
      const wrapped = typeof dispose === 'function' ? dispose : function () {}
      disposers.push(wrapped)
      return wrapped
    },
    commands: {
      register(definition) {
        commands.set(definition.name, definition)
        const dispose = function () { commands.delete(definition.name) }
        disposers.push(dispose)
        return dispose
      },
    },
  }

  const home = settings.home || makeHome()
  apply(ctx, {
    dshHome: home,
    rounds: settings.rounds === undefined ? 3 : settings.rounds,
    receiptPath: settings.receiptPath,
  })

  async function preStep(agentId, turn, step) {
    let nextCalls = 0
    const next = async function () {
      nextCalls += 1
      return { kind: 'enter', messages: [] }
    }
    const payload = {
      agent: { id: agentId },
      turn: turn,
      step: step,
      messages: [],
      signal: new AbortController().signal,
    }
    for (const listener of (listeners.get('agent/pre-step') || []).slice()) {
      await listener(payload, next)
    }
    return nextCalls
  }

  async function tool(agentId, name, args, isError) {
    const exec = {
      name: name,
      arguments: args,
      callId: 'call-' + String(Math.random()).slice(2),
      agent: { id: agentId },
      signal: new AbortController().signal,
    }
    const result = { isError: isError === true, value: null, content: [] }
    for (const listener of (listeners.get('tools/result') || []).slice()) {
      await listener(exec, result)
    }
  }

  async function streamText(agentId, text) {
    const payload = {
      agent: { id: agentId },
      frame: { type: 'chunk', chunk: { type: 'text-delta', index: 0, text: text } },
    }
    for (const listener of (listeners.get('agent/assistant-stream') || []).slice()) {
      await listener(payload)
    }
  }

  async function turnStopping(agentId, turn) {
    const payload = { agent: { id: agentId }, turn: turn, signal: new AbortController().signal }
    for (const listener of (listeners.get('agent/turn-stopping') || []).slice()) {
      await listener(payload)
    }
  }

  async function step(agentId, turn, stepNumber, calls, text) {
    await preStep(agentId, turn, stepNumber)
    for (const call of calls || []) {
      await tool(agentId, call.name, call.args, call.failed)
    }
    if (typeof text === 'string' && text.length > 0) await streamText(agentId, text)
    await turnStopping(agentId, turn)
  }

  async function run(rawInput, agentId) {
    const definition = commands.get('pua')
    assert.ok(definition, 'the /pua command was registered')
    return definition.handler({
      commandId: 'cmd-1',
      agent: { id: agentId || 'a1' },
      rawInput: rawInput,
      attachments: [],
      signal: new AbortController().signal,
    })
  }

  async function state() {
    const route = routes[0]
    assert.ok(route, 'the state route was registered')
    let payload
    const res = {
      statusCode: 0,
      setHeader() {},
      end(text) { payload = JSON.parse(text) },
    }
    await route.handler({ method: 'GET', url: '/dsh-pua-receipt/state' }, res)
    return payload
  }

  function dispose() {
    const pending = disposers.splice(0)
    for (const disposeOne of pending) {
      try { disposeOne() } catch (error) { /* ignore */ }
    }
  }

  return {
    home: home,
    receiptPath: settings.receiptPath || join(home, 'pua-receipts.jsonl'),
    commands: commands,
    routes: routes,
    listeners: listeners,
    prompts: prompts,
    preStep: preStep,
    tool: tool,
    streamText: streamText,
    turnStopping: turnStopping,
    step: step,
    run: run,
    state: state,
    dispose: dispose,
  }
}

const writeCall = { name: 'write', args: { file_path: 'src/a.js', content: 'x' } }
const verifyCall = { name: 'read', args: { file_path: 'test/host.test.mjs' } }

test('a pressure window produces a changed receipt, persists it and ranks it', async () => {
  const h = setup()
  for (let i = 1; i <= 3; i += 1) await h.step('a1', 1, i, [writeCall])

  const result = await h.run('/pua')
  assert.equal(result.kind, 'success')
  assert.match(result.text, /已施压/)
  assert.match(result.text, /前窗 3\/3 轮/)
  assert.equal(h.prompts.length, 1)
  assert.equal(h.prompts[0].mode, 'steer')
  assert.equal(h.prompts[0].sessionId, 'a1')
  assert.match(h.prompts[0].content[0].text, /这个需求今天必须落地/)
  assert.match(h.prompts[0].content[0].text, /接下来 3 轮/)

  for (let i = 4; i <= 6; i += 1) await h.step('a1', 1, i, [verifyCall])

  const state = await h.state()
  assert.equal(state.stats.changed, 1)
  assert.equal(state.stats.pending, 0)
  assert.equal(state.active.length, 0)
  assert.equal(state.receipts[0].verdict, 'changed')
  assert.equal(state.receipts[0].before.toolCalls, 3)
  assert.equal(state.receipts[0].after.verifySteps, 3)
  assert.equal(state.ranking.length, 1)
  assert.equal(state.ranking[0].lineId, 'deadline')
  assert.equal(state.ranking[0].changed, 1)

  const lines = readFileSync(h.receiptPath, 'utf8').trim().split(/\r?\n/)
  assert.equal(lines.length, 1)
  assert.equal(JSON.parse(lines[0]).verdict, 'changed')
})

test('the next automatic pressure rotates to the next sentence', async () => {
  const h = setup()
  for (let i = 1; i <= 3; i += 1) await h.step('a1', 1, i, [writeCall])
  await h.run('/pua')
  for (let i = 4; i <= 6; i += 1) await h.step('a1', 1, i, [verifyCall])

  const second = await h.run('/pua')
  assert.equal(second.kind, 'success')
  assert.equal(h.prompts.length, 2)
  assert.match(h.prompts[1].content[0].text, /先别解释，把证据拿出来/)
})

test('text without action is classified as restated', async () => {
  const h = setup()
  for (let i = 1; i <= 3; i += 1) await h.step('a1', 1, i, [writeCall, writeCall])
  await h.run('/pua')
  for (let i = 4; i <= 6; i += 1) {
    await h.step('a1', 1, i, [], '我会先分析一下，然后给出一个完整的方案，并且保证这次一定处理好。')
  }
  const state = await h.state()
  assert.equal(state.receipts[0].verdict, 'restated')
  assert.equal(state.stats.restated, 1)
  assert.equal(state.ranking[0].restated, 1)
})

test('the same call volume with no new evidence is unchanged', async () => {
  const h = setup()
  for (let i = 1; i <= 3; i += 1) await h.step('a1', 1, i, [writeCall, writeCall])
  await h.run('/pua')
  for (let i = 4; i <= 6; i += 1) await h.step('a1', 1, i, [writeCall, writeCall])
  const state = await h.state()
  assert.equal(state.receipts[0].verdict, 'unchanged')
  assert.equal(state.stats.unchanged, 1)
})

test('breaking a repeated-call loop counts as changed', async () => {
  const h = setup()
  for (let i = 1; i <= 3; i += 1) await h.step('a1', 1, i, [writeCall, writeCall])
  await h.run('/pua')
  for (let i = 4; i <= 6; i += 1) {
    await h.step('a1', 1, i, [
      { name: 'read', args: { file_path: 'src/a.js' } },
      { name: 'write', args: { file_path: 'src/b.js', content: 'y' } },
    ])
  }
  const state = await h.state()
  assert.equal(state.receipts[0].verdict, 'changed')
  assert.match(state.receipts[0].evidence, /重复调用峰值/)
})

test('a drop in failed calls counts as changed', async () => {
  const h = setup()
  const fail = { name: 'pwsh', args: { command: 'node -e "process.exit(1)"' }, failed: true }
  const pass = { name: 'pwsh', args: { command: 'node -e "process.exit(1)"' }, failed: false }
  for (let i = 1; i <= 3; i += 1) await h.step('a1', 1, i, [fail])
  await h.run('/pua')
  for (let i = 4; i <= 6; i += 1) await h.step('a1', 1, i, [pass])
  const state = await h.state()
  assert.equal(state.receipts[0].verdict, 'changed')
  assert.match(state.receipts[0].evidence, /失败调用 3→0/)
})

test('a short before-window is reported as a partial receipt', async () => {
  const h = setup()
  await h.step('a1', 1, 1, [writeCall])
  const started = await h.run('/pua')
  assert.match(started.text, /前窗不足 3 轮/)
  for (let i = 2; i <= 4; i += 1) await h.step('a1', 1, i, [writeCall])
  const state = await h.state()
  assert.equal(state.receipts[0].before.steps, 1)
  assert.equal(state.receipts[0].after.steps, 3)
  const receipts = await h.run('/pua receipts')
  assert.match(receipts.text, /窗口 1\/3 → 3\/3 轮/)
})

test('cancel marks the receipt cancelled and keeps it out of the ranking', async () => {
  const h = setup()
  for (let i = 1; i <= 3; i += 1) await h.step('a1', 1, i, [writeCall])
  await h.run('/pua')
  const off = await h.run('/pua off')
  assert.equal(off.kind, 'success')
  assert.match(off.text, /已取消/)
  const state = await h.state()
  assert.equal(state.receipts[0].verdict, 'cancelled')
  assert.equal(state.stats.cancelled, 1)
  assert.equal(state.ranking.length, 0)
  const again = await h.run('/pua off')
  assert.match(again.text, /没有进行中/)
})

test('without sessionController the command refuses to create an experiment', async () => {
  const h = setup({ noChat: true })
  for (let i = 1; i <= 3; i += 1) await h.step('a1', 1, i, [writeCall])
  const result = await h.run('/pua')
  assert.equal(result.kind, 'error')
  assert.match(result.text, /sessionController/)
  const state = await h.state()
  assert.equal(state.receipts.length, 0)
  assert.equal(state.stats.pending, 0)
})

test('a rejected pressure message creates no receipt', async () => {
  const h = setup({ accepted: false })
  for (let i = 1; i <= 3; i += 1) await h.step('a1', 1, i, [writeCall])
  const result = await h.run('/pua')
  assert.equal(result.kind, 'error')
  assert.match(result.text, /没有被宿主接收/)
  const state = await h.state()
  assert.equal(state.receipts.length, 0)
  assert.equal(state.active.length, 0)
})

test('two sessions do not contaminate each other\'s window', async () => {
  const h = setup()
  for (let i = 1; i <= 3; i += 1) await h.step('a1', 1, i, [writeCall])
  await h.run('/pua', 'a1')
  for (let i = 4; i <= 6; i += 1) await h.step('a2', 1, i, [verifyCall])
  for (let i = 4; i <= 6; i += 1) await h.step('a1', 1, i, [writeCall])
  const state = await h.state()
  assert.equal(state.receipts[0].verdict, 'unchanged')
  assert.equal(state.receipts[0].after.verifySteps, 0)
})

test('the state route reports the requested history and refuses non-GET', async () => {
  const h = setup()
  for (let i = 1; i <= 3; i += 1) await h.step('a1', 1, i, [writeCall])
  await h.run('/pua')
  for (let i = 4; i <= 6; i += 1) await h.step('a1', 1, i, [verifyCall])

  const route = h.routes[0]
  assert.equal(route.kind, 'prefix')
  assert.equal(route.path, '/dsh-pua-receipt')

  let status
  let payload
  const res = {
    setHeader() {},
    end(text) { payload = JSON.parse(text) },
  }
  await route.handler({ method: 'POST', url: '/dsh-pua-receipt/state' }, res)
  status = res.statusCode
  assert.equal(status, 405)
  assert.match(payload.error, /method not allowed/)
})

test('receipts survive a host restart through the JSONL file', async () => {
  const home = makeHome()
  const first = setup({ home: home })
  for (let i = 1; i <= 3; i += 1) await first.step('a1', 1, i, [writeCall])
  await first.run('/pua')
  for (let i = 4; i <= 6; i += 1) await first.step('a1', 1, i, [verifyCall])
  const id = (await first.state()).receipts[0].id

  const second = setup({ home: home })
  const state = await second.state()
  assert.equal(state.stats.changed, 1)
  assert.equal(state.receipts[0].id, id)
  assert.equal(state.receipts[0].verdict, 'changed')
})

test('the command exposes help, list, status, receipts and rank', async () => {
  const h = setup()
  const help = await h.run('/pua help')
  assert.match(help.text, /\/pua rank/)
  const list = await h.run('/pua list')
  assert.equal(list.text.split('\n').length, 16)
  const status = await h.run('/pua status')
  assert.match(status.text, /没有进行中/)
  const receipts = await h.run('/pua receipts')
  assert.match(receipts.text, /还没有回执/)
  const rank = await h.run('/pua rank')
  assert.match(rank.text, /还没有完成的回执/)
})

test('argument validation refuses bad numbers and unknown words', async () => {
  const h = setup()
  assert.equal((await h.run('/pua 0')).kind, 'error')
  assert.equal((await h.run('/pua 16')).kind, 'error')
  assert.equal((await h.run('/pua --rounds 0')).kind, 'error')
  assert.equal((await h.run('/pua --rounds 13')).kind, 'error')
  assert.equal((await h.run('/pua nonsense')).kind, 'error')
  assert.equal(h.prompts.length, 0)
})

test('an explicit sentence and a custom round count are honoured', async () => {
  const h = setup()
  for (let i = 1; i <= 5; i += 1) await h.step('a1', 1, i, [writeCall])
  const result = await h.run('/pua 7 --rounds 5')
  assert.equal(result.kind, 'success')
  assert.match(h.prompts[0].content[0].text, /别只改表面/)
  const state = await h.state()
  assert.equal(state.receipts[0].rounds, 5)
  assert.equal(state.receipts[0].lineId, 'root-cause')
  for (let i = 6; i <= 10; i += 1) await h.step('a1', 1, i, [verifyCall])
  assert.equal((await h.state()).receipts[0].verdict, 'changed')
})

test('the after-window only starts on the step after the pressure message', async () => {
  const h = setup()
  for (let i = 1; i <= 3; i += 1) await h.step('a1', 1, i, [writeCall])

  // A step is already open when the user sends /pua. Its tool calls belong to
  // the before context and must not be counted as "after".
  await h.preStep('a1', 1, 4)
  await h.tool('a1', 'write', writeCall.args)
  const result = await h.run('/pua')
  assert.equal(result.kind, 'success')
  await h.turnStopping('a1', 1)

  for (let i = 5; i <= 7; i += 1) await h.step('a1', 1, i, [verifyCall])
  const state = await h.state()
  assert.equal(state.receipts[0].after.steps, 3)
  assert.equal(state.receipts[0].after.verifySteps, 3)
})

test('a circular tool argument does not escape as an exception', async () => {
  const h = setup()
  const circular = { self: null }
  circular.self = circular
  for (let i = 1; i <= 3; i += 1) await h.step('a1', 1, i, [{ name: 'write', args: circular }])
  const result = await h.run('/pua')
  assert.equal(result.kind, 'success')
  for (let i = 4; i <= 6; i += 1) await h.step('a1', 1, i, [writeCall])
  const state = await h.state()
  assert.equal(state.receipts.length, 1)
})

test('unloading removes the command, listeners and route', () => {
  const h = setup()
  assert.ok(h.commands.get('pua'), 'command registered while loaded')
  assert.ok(h.listeners.get('agent/pre-step'), 'pre-step listener registered while loaded')
  assert.equal(h.routes.length, 1, 'route registered while loaded')

  h.dispose()

  assert.equal(h.commands.has('pua'), false, 'command removed on unload')
  assert.equal(h.listeners.size, 0, 'no listener left behind')
  assert.equal(h.routes.length, 0, 'route removed on unload')
})

test('disposal finalises an unfinished window as incomplete', async () => {
  const h = setup()
  for (let i = 1; i <= 3; i += 1) await h.step('a1', 1, i, [writeCall])
  await h.run('/pua')
  await h.step('a1', 1, 4, [verifyCall])

  const disposed = { agent: { id: 'a1' } }
  for (const listener of (h.listeners.get('agent/disposed') || []).slice()) {
    await listener(disposed)
  }
  const lines = readFileSync(h.receiptPath, 'utf8').trim().split(/\r?\n/)
  assert.equal(lines.length, 1)
  assert.equal(JSON.parse(lines[0]).verdict, 'incomplete')
})
