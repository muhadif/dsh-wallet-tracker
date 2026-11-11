/** Runnable check: node check.mjs */
import assert from 'node:assert/strict'
import { buildLedger, readDeltas } from './index.js'

// Buy 10 @1 SOL, buy 10 @2 SOL, sell 15 @3 SOL, then buy 4 @0.5 SOL.
const swap = (sol, mint, delta, time) => ({ sol, changes: [[mint, delta]], time })
const history = [
  swap(-10, 'A', 10, 1),
  swap(-20, 'A', 10, 2),
  swap(45, 'A', -15, 3),
  swap(-2, 'A', 4, 4),
  swap(0, 'A', 5, 5), // airdrop: no SOL leg, skipped
  swap(-1, 'B', 100, 6), // transfer-ish but priced; tracked separately
]

const ledger = buildLedger(history)
// FIFO on A: 10@1 + 5@2 = 20 cost, proceeds 45 -> realised 25.
assert.ok(Math.abs(ledger.stats.get('A').realizedSol - 25) < 1e-9, 'realised SOL')
// Remaining A: 5@2 + 4@0.5 = 12 SOL of cost for 9 tokens.
assert.ok(Math.abs(ledger.remainingCost('A') - 12) < 1e-9, 'remaining cost')
assert.ok(Math.abs(ledger.remainingQty('A') - 9) < 1e-9, 'remaining qty')
assert.equal(ledger.skipped, 1)
assert.ok(Math.abs(ledger.remainingCost('B') - 1) < 1e-9, 'unrelated mint kept separate')

// readDeltas reads a parsed transaction's SOL and token changes for one owner.
const tx = {
  blockTime: 7,
  transaction: { message: { accountKeys: [{ pubkey: 'me' }] } },
  meta: {
    preBalances: [2_000_000_000, 0],
    postBalances: [1_500_000_000, 0],
    preTokenBalances: [{ owner: 'me', mint: 'A', uiTokenAmount: { amount: '1000000', decimals: 6 } }],
    postTokenBalances: [{ owner: 'me', mint: 'A', uiTokenAmount: { amount: '3000000', decimals: 6 } }],
  },
}
const deltas = readDeltas(tx, 'me')
assert.equal(deltas.sol, -0.5)
assert.deepEqual(deltas.changes, [['A', 2]])
assert.equal(readDeltas({ ...tx, meta: { ...tx.meta, postTokenBalances: [] } }, 'nobody'), null)

// A token received while only paying the fee must not look like a trade paid with 5000 lamports.
const received = {
  blockTime: 8,
  transaction: { message: { accountKeys: [{ pubkey: 'me' }] } },
  meta: {
    fee: 5000,
    preBalances: [2_000_000_000, 0],
    postBalances: [1_999_995_000, 0],
    preTokenBalances: [],
    postTokenBalances: [{ owner: 'me', mint: 'USD1', uiTokenAmount: { amount: '70000', decimals: 6 } }],
  },
}
const receivedDeltas = readDeltas(received, 'me')
assert.ok(Math.abs(receivedDeltas.sol) < 1e-12, 'fee-only native leg cancels out')
const feeOnly = buildLedger([{ sol: receivedDeltas.sol, changes: receivedDeltas.changes, time: 8 }])
assert.equal(feeOnly.stats.size, 0, 'no lot is created from a fee-only transfer')
assert.equal(buildLedger([{ sol: -1e-8, changes: [['DUST', 5]], time: 9 }]).skipped, 1, 'dust leg is not a price')

console.log('sol-wallet checks passed')

// The Client half must register its sidebar entry and main panel when the loader runs it.
let factory
globalThis.window = {
  __ModuleLoader__: { load({ id, factory: load }) { assert.equal(id, 'dsh-wallet-tracker'); factory = load } },
}
await import('./client.js')
const reactStub = {
  createElement: () => null,
  useState: () => [undefined, () => {}],
  useEffect: () => {},
  useMemo: () => undefined,
  useCallback: fn => fn,
}
const plugin = factory(name => {
  assert.equal(name, 'react')
  return reactStub
})
const slots = []
let localeRegistered = false
const fakeCtx = {
  effect: fn => fn(),
  locale: { register: () => void (localeRegistered = true), bind: () => key => key },
  slots: {
    inject(slot, callback) {
      const effect = callback()
      const steps = effect && typeof effect.next === 'function' ? [...effect] : [effect]
      for (const step of steps) slots.push([slot, step])
    },
    register: (options, component) => ({ options, component }),
  },
}
plugin.apply(fakeCtx)
assert.ok(localeRegistered, 'locale dictionaries registered')
assert.deepEqual(slots.map(entry => entry[0]), ['main', 'sidebar.panellist'])
assert.equal(slots[0][1].options.key, 'sol-wallet')
assert.equal(slots[1][1].options.id, 'sol-wallet')
assert.equal(slots[1][1].options.order, 20)
assert.equal(typeof slots[1][1].component, 'function')
console.log('sol-wallet client checks passed')
