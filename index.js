/** Host half: Solana wallet data (balances, prices, FIFO PnL) behind two same-origin routes. */

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const TOKEN_PROGRAMS = [
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
]
const DEFAULTS = {
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  historyRpcUrl: 'https://solana-rpc.publicnode.com',
  heliusKey: '',
  explorers: {},
  historyConcurrency: 6,
  scanSignatures: 150,
  cacheMs: 10_000,
}

/** One entry per supported chain: how to read it, how to price it, how to validate its address. */
export const CHAINS = {
  solana: {
    kind: 'solana',
    label: 'Solana',
    native: { symbol: 'SOL' },
    gecko: 'solana',
    dexscreener: 'solana',
    address: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  },
  ethereum: {
    kind: 'evm',
    label: 'Ethereum',
    native: { symbol: 'ETH', wrapped: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
    explorer: 'https://eth.blockscout.com',
    dexscreener: 'ethereum',
    gecko: 'eth',
    address: /^0x[0-9a-fA-F]{40}$/,
  },
  optimism: {
    kind: 'evm',
    label: 'Optimism',
    native: { symbol: 'ETH', wrapped: '0x4200000000000000000000000000000000000006' },
    explorer: 'https://optimism.blockscout.com',
    dexscreener: 'optimism',
    gecko: 'optimism',
    address: /^0x[0-9a-fA-F]{40}$/,
  },
  base: {
    kind: 'evm',
    label: 'Base',
    native: { symbol: 'ETH', wrapped: '0x4200000000000000000000000000000000000006' },
    explorer: 'https://base.blockscout.com',
    dexscreener: 'base',
    gecko: 'base',
    address: /^0x[0-9a-fA-F]{40}$/,
  },
  arbitrum: {
    kind: 'evm',
    label: 'Arbitrum',
    native: { symbol: 'ETH', wrapped: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' },
    explorer: 'https://arbitrum.blockscout.com',
    dexscreener: 'arbitrum',
    gecko: 'arbitrum',
    address: /^0x[0-9a-fA-F]{40}$/,
  },
  bitcoin: {
    kind: 'bitcoin',
    label: 'Bitcoin',
    native: { symbol: 'BTC' },
    address: /^(bc1[a-zA-HJ-NP-Z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/,
  },
}

const chainOf = id => {
  const key = Object.prototype.hasOwnProperty.call(CHAINS, id ?? '') ? id : 'solana'
  return { ...CHAINS[key], id: key }
}

export const inject = ['webServer']

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

async function post(rpcUrl, payload) {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.status === 429 && attempt < 6) {
      await new Promise(resolve => setTimeout(resolve, 700))
      continue
    }
    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`)
    return res.json()
  }
}

async function rpc(rpcUrl, method, params) {
  const body = await post(rpcUrl, { jsonrpc: '2.0', id: 1, method, params })
  if (body.error) throw new Error(`RPC ${method}: ${body.error.message ?? 'error'}`)
  return body.result
}

/**
 * Jupiter's token search answers many mints in one call and knows about tokens so new that
 * DexScreener has not indexed a pair yet; DexScreener fills whatever Jupiter still misses.
 */
async function loadMarket(mints) {
  const out = new Map()
  const take = (mint, quote) => {
    if (!mint || !mints.includes(mint)) return
    const known = out.get(mint)
    if (known && known.liquidity >= quote.liquidity) return
    out.set(mint, quote)
  }

  for (let i = 0; i < mints.length; i += 40) {
    const chunk = mints.slice(i, i + 40)
    try {
      const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${chunk.join(',')}`)
      if (!res.ok) continue
      for (const token of (await res.json()) ?? []) {
        take(token?.id, {
          symbol: token?.symbol || '',
          name: token?.name || token?.symbol || '',
          icon: token?.icon ?? '',
          priceUsd: Number(token?.usdPrice) || 0,
          change24h: Number(token?.stats24h?.priceChange) || 0,
          liquidity: Number(token?.liquidity) || 0,
        })
      }
    } catch {
      // Keep falling through to DexScreener below.
    }
  }

  const missing = mints.filter(mint => !out.has(mint))
  for (let i = 0; i < missing.length; i += 30) {
    const chunk = missing.slice(i, i + 30)
    try {
      const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${chunk.join(',')}`)
      if (!res.ok) continue
      for (const pair of (await res.json()) ?? []) {
        const base = pair?.baseToken
        take(base?.address, {
          symbol: base?.symbol || '',
          name: base?.name || base?.symbol || '',
          icon: pair?.info?.imageUrl ?? '',
          priceUsd: Number(pair?.priceUsd) || 0,
          change24h: Number(pair?.priceChange?.h24) || 0,
          liquidity: Number(pair?.liquidity?.usd) || 0,
        })
      }
    } catch {
      // An unpriced token still belongs in the list; it renders without a value.
    }
  }
  return out
}

async function loadHoldings(cfg, address) {
  const [lamports, ...accounts] = await Promise.all([
    rpc(cfg.rpcUrl, 'getBalance', [address]),
    ...TOKEN_PROGRAMS.map(program =>
      rpc(cfg.rpcUrl, 'getTokenAccountsByOwner', [address, { programId: program }, { encoding: 'jsonParsed' }]),
    ),
  ])
  const held = []
  for (const entry of accounts) {
    for (const account of entry?.value ?? []) {
      const info = account?.account?.data?.parsed?.info
      const amount = Number(info?.tokenAmount?.uiAmountString ?? info?.tokenAmount?.uiAmount ?? 0)
      if (!info?.mint || !(amount > 0)) continue
      held.push({ mint: info.mint, amount, decimals: info.tokenAmount.decimals ?? 0 })
    }
  }
  const merged = new Map()
  for (const row of held) {
    const known = merged.get(row.mint)
    if (known) known.amount += row.amount
    else merged.set(row.mint, { ...row })
  }
  const sol = (lamports?.value ?? 0) / 1e9
  const mints = [SOL_MINT, ...merged.keys()]
  const market = await loadMarket(mints)
  const solPrice = market.get(SOL_MINT)?.priceUsd ?? 0

  const tokens = [...merged.values()]
    .map(row => {
      const quote = market.get(row.mint)
      const priceUsd = quote?.priceUsd || row.rate || 0
      return {
        mint: row.mint,
        amount: row.amount,
        decimals: row.decimals,
        symbol: quote?.symbol || `${row.mint.slice(0, 4)}…`,
        name: quote?.name ?? '',
        icon: quote?.icon ?? '',
        priceUsd,
        change24h: quote?.change24h ?? 0,
        valueUsd: row.amount * priceUsd,
        unpriced: !(priceUsd > 0),
      }
    })
    // A brand-new token has no quote yet; it still shows up, just without a value.
    .sort((a, b) => b.valueUsd - a.valueUsd || b.amount - a.amount)

  const priced = tokens.filter(row => !row.unpriced).reduce((sum, row) => sum + row.valueUsd, 0)
  return {
    chain: 'solana',
    address,
    native: sol,
    nativeSymbol: 'SOL',
    nativePrice: solPrice,
    nativeValueUsd: sol * solPrice,
    nativeChange24h: market.get(SOL_MINT)?.change24h ?? 0,
    totalUsd: priced + sol * solPrice,
    tokenCount: merged.size,
    pricedTokenCount: tokens.filter(row => !row.unpriced).length,
    unpricedCount: tokens.filter(row => row.unpriced).length,
    tokens,
    updatedAt: new Date().toISOString(),
  }
}

async function jsonFetch(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${new URL(url).host}`)
  return res.json()
}

/** DexScreener for one EVM chain: native price comes from its wrapped token. */
async function loadEvmMarket(chain, rows) {
  const out = new Map()
  const wanted = [String(chain.native.wrapped).toLowerCase(), ...rows.map(row => row.mint)]
  for (let i = 0; i < wanted.length; i += 30) {
    const chunk = wanted.slice(i, i + 30)
    try {
      const res = await fetch(`https://api.dexscreener.com/tokens/v1/${chain.dexscreener}/${chunk.join(',')}`)
      if (!res.ok) continue
      for (const pair of (await res.json()) ?? []) {
        const address = pair?.baseToken?.address?.toLowerCase()
        if (!address || !chunk.includes(address)) continue
        const liquidity = Number(pair.liquidity?.usd) || 0
        const known = out.get(address)
        if (known && known.liquidity >= liquidity) continue
        out.set(address, {
          symbol: pair.baseToken.symbol || '',
          name: pair.baseToken.name || '',
          icon: pair.info?.imageUrl ?? '',
          priceUsd: Number(pair.priceUsd) || 0,
          change24h: Number(pair.priceChange?.h24) || 0,
          liquidity,
        })
      }
    } catch {
      // A price miss leaves the row unpriced instead of dropping it.
    }
  }
  return out
}

async function loadEvmHoldings(cfg, chain, address) {
  const base = String(chain.explorer).replace(/\/$/, '')
  const [info, balances] = await Promise.all([
    jsonFetch(`${base}/api/v2/addresses/${address}`),
    jsonFetch(`${base}/api/v2/addresses/${address}/token-balances`),
  ]).catch(error => {
    throw new Error(
      `${chain.label} explorer tidak bisa diakses (${error.message}). Set explorers.${chain.id} di config ke instance Blockscout lain.`,
    )
  })
  const native = Number(BigInt(info?.coin_balance ?? '0')) / 1e18
  const held = (Array.isArray(balances) ? balances : [])
    .filter(entry => {
      const contract = entry?.token?.address_hash ?? entry?.token?.address ?? ''
      return entry?.token?.type === 'ERC-20' && /^0x[0-9a-fA-F]{40}$/.test(contract)
    })
    .map(entry => {
      const decimals = Number(entry.token.decimals ?? 18)
      const contract = entry.token.address_hash ?? entry.token.address
      const amount = Number(entry.value ?? 0) / 10 ** decimals
      const rate = Number(entry.token.exchange_rate) || 0
      return {
        mint: contract.toLowerCase(),
        symbol: entry.token.symbol ?? '',
        name: entry.token.name ?? '',
        icon: entry.token.icon_url ?? '',
        decimals,
        amount,
        rate,
        guessUsd: amount * rate,
      }
    })
    .filter(row => row.amount > 0)

  // A whale can hold hundreds of tokens; price the biggest ones and trust the explorer rate for the rest.
  const toQuote = [...held].sort((a, b) => b.guessUsd - a.guessUsd).slice(0, 120)
  const market = await loadEvmMarket(chain, toQuote)
  const nativePrice = market.get(String(chain.native.wrapped).toLowerCase())?.priceUsd ?? 0
  const tokens = held
    .map(row => {
      const quote = market.get(row.mint)
      const priceUsd = quote?.priceUsd || row.rate || 0
      return {
        ...row,
        symbol: row.symbol || quote?.symbol || `${row.mint.slice(0, 6)}…`,
        icon: row.icon || quote?.icon || '',
        priceUsd,
        change24h: quote?.change24h ?? 0,
        valueUsd: row.amount * priceUsd,
        unpriced: !(priceUsd > 0),
      }
    })
    .sort((a, b) => b.valueUsd - a.valueUsd || b.amount - a.amount)

  const priced = tokens.filter(row => !row.unpriced).reduce((sum, row) => sum + row.valueUsd, 0)
  return {
    chain: chain.id,
    address,
    native,
    nativeSymbol: chain.native.symbol,
    nativePrice,
    nativeValueUsd: native * nativePrice,
    nativeChange24h: market.get(String(chain.native.wrapped).toLowerCase())?.change24h ?? 0,
    totalUsd: priced + native * nativePrice,
    tokenCount: tokens.length,
    pricedTokenCount: tokens.filter(row => !row.unpriced).length,
    unpricedCount: tokens.filter(row => row.unpriced).length,
    tokens,
    updatedAt: new Date().toISOString(),
  }
}

const btcPriceCache = { at: 0, value: 0 }

async function btcPrice() {
  if (Date.now() - btcPriceCache.at < 60_000) return btcPriceCache.value
  try {
    const res = await fetch('https://api.dexscreener.com/tokens/v1/ethereum/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599')
    const pairs = res.ok ? await res.json() : []
    const best = (pairs ?? []).sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
    btcPriceCache.value = Number(best?.priceUsd) || btcPriceCache.value
    btcPriceCache.at = Date.now()
  } catch {
    // Keep the previous price.
  }
  return btcPriceCache.value
}

async function loadBtcHoldings(chain, address) {
  const info = await jsonFetch(`https://blockstream.info/api/address/${address}`)
  const confirmed = info?.chain_stats ?? {}
  const pending = info?.mempool_stats ?? {}
  const sats =
    (confirmed.funded_txo_sum ?? 0) - (confirmed.spent_txo_sum ?? 0) +
    (pending.funded_txo_sum ?? 0) - (pending.spent_txo_sum ?? 0)
  const native = sats / 1e8
  const price = await btcPrice()
  return {
    chain: chain.id,
    address,
    native,
    nativeSymbol: 'BTC',
    nativePrice: price,
    nativeValueUsd: native * price,
    nativeChange24h: 0,
    totalUsd: native * price,
    tokenCount: 0,
    pricedTokenCount: 0,
    unpricedCount: 0,
    tokens: [],
    txCount: confirmed.tx_count ?? 0,
    updatedAt: new Date().toISOString(),
  }
}

async function blockscoutPages(url, limit) {
  const items = []
  let next = url
  for (let page = 0; page < 8 && next; page += 1) {
    const body = await jsonFetch(next).catch(() => null)
    items.push(...(body?.items ?? []))
    const params = body?.next_page_params
    next = params ? `${url}?${new URLSearchParams(params)}` : null
    if (items.length >= limit) break
  }
  return items.slice(0, limit)
}

/**
 * Blockscout lists transactions and token transfers separately, so the EVM ledger joins them by
 * hash and keeps the same native-leg rule as Solana: one token delta plus a native leg is a swap.
 */
const evmHistoryCache = new Map()

async function readEvmHistory(cfg, chain, address, progress) {
  const cacheKey = `${chain.id}:${address.toLowerCase()}`
  const cached = evmHistoryCache.get(cacheKey)
  if (cached && Date.now() - cached.at < 300_000) {
    progress.total = cached.value.total
    progress.done = cached.value.total
    return cached.value
  }
  const base = String(chain.explorer).replace(/\/$/, '')
  const owner = address.toLowerCase()
  const limit = cfg.scanSignatures
  const [txs, transfers] = await Promise.all([
    blockscoutPages(`${base}/api/v2/addresses/${address}/transactions`, limit),
    blockscoutPages(`${base}/api/v2/addresses/${address}/token-transfers`, limit * 2),
  ])
  const byTx = new Map()
  for (const transfer of transfers) {
    const hash = transfer?.transaction_hash
    if (!hash) continue
    const list = byTx.get(hash) ?? []
    list.push(transfer)
    byTx.set(hash, list)
  }
  const rows = txs.reverse()
  progress.total = rows.length
  const out = []
  for (const tx of rows) {
    progress.done += 1
    if ((tx?.status ?? 'ok') !== 'ok') continue
    let nativeDelta = 0n
    const value = BigInt(tx?.value ?? '0')
    if ((tx?.from?.hash ?? '').toLowerCase() === owner) nativeDelta -= value
    if ((tx?.to?.hash ?? '').toLowerCase() === owner) nativeDelta += value
    const changes = new Map()
    for (const transfer of byTx.get(tx?.hash) ?? []) {
      const decimals = Number(transfer?.total?.decimals ?? 18)
      const amount = Number(transfer?.total?.value ?? 0) / 10 ** decimals
      const mint = String(transfer?.token?.address_hash ?? transfer?.token?.address ?? '').toLowerCase()
      if (!mint || !amount) continue
      let delta = 0
      if ((transfer?.to?.hash ?? '').toLowerCase() === owner) delta += amount
      if ((transfer?.from?.hash ?? '').toLowerCase() === owner) delta -= amount
      if (delta) changes.set(mint, (changes.get(mint) ?? 0) + delta)
    }
    if (!changes.size) continue
    out.push({
      sol: Number(nativeDelta) / 1e18,
      changes: [...changes].filter(([, delta]) => Math.abs(delta) > 1e-12),
      time: Date.parse(tx?.timestamp ?? '') / 1000 || 0,
    })
  }
  const sorted = out.filter(entry => entry.changes.length).sort((a, b) => a.time - b.time)
  sorted.failed = 0
  sorted.total = rows.length
  evmHistoryCache.set(cacheKey, { at: Date.now(), value: sorted })
  return sorted
}

/** DexScreener for one EVM chain: native price comes from its wrapped token. */
async function gecko(network, path, attempt = 0) {
  const res = await fetch(`https://api.geckoterminal.com/api/v2/networks/${network}${path}`, {
    headers: { accept: 'application/json' },
  })
  // The free tier allows ~30 calls a minute; a single paced retry absorbs a burst.
  if (res.status === 429 && attempt < 2) {
    await new Promise(resolve => setTimeout(resolve, 1200))
    return gecko(network, path, attempt + 1)
  }
  if (!res.ok) throw new Error(`GeckoTerminal HTTP ${res.status}`)
  return res.json()
}

const poolCache = new Map()
const holderCache = new Map()

async function bestPool(chain, mint) {
  const key = `${chain.id}:${mint}`
  const cached = poolCache.get(key)
  if (cached && Date.now() - cached.at < 300_000) return cached.value
  const body = await gecko(chain.gecko, `/tokens/${mint}/pools?page=1`).catch(() => null)
  const pool =
    (body?.data ?? [])
      .map(entry => entry?.attributes)
      .filter(attributes => attributes?.address)
      .sort((a, b) => Number(b.reserve_in_usd ?? 0) - Number(a.reserve_in_usd ?? 0))[0] ?? null
  if (pool) poolCache.set(key, { at: Date.now(), value: pool })
  return pool
}

/**
 * RugCheck answers a holder list without a key; the RPC call it replaces is throttled on
 * public endpoints, so it stays as a last resort.
 */
async function loadHolders(cfg, chain, mint) {
  if (chain.kind === 'evm') return evmHolders(cfg, chain, mint)
  try {
    const res = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`)
    if (res.ok) {
      const report = await res.json()
      const rows = (report?.topHolders ?? []).slice(0, 10).map(holder => ({
        address: holder?.owner ?? null,
        account: holder?.address ?? null,
        pct: Number(holder?.pct) || 0,
        amount: Number(holder?.uiAmountString) || 0,
      }))
      if (rows.length) return rows
    }
  } catch {
    // Fall through to the RPC.
  }
  return topHolders(cfg, mint)
}

async function holdersWithin(cfg, chain, mint, ms) {
  const key = `${chain.id}:${mint}`
  const cached = holderCache.get(key)
  if (cached && Date.now() - cached.at < 300_000) return cached.value
  const value = await Promise.race([
    loadHolders(cfg, chain, mint),
    new Promise(resolve => setTimeout(() => resolve([]), ms)),
  ])
  if (value.length) holderCache.set(key, { at: Date.now(), value })
  return value
}

async function loadTokenMeta(mint) {
  try {
    const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${mint}`)
    if (!res.ok) return null
    const token = ((await res.json()) ?? []).find(entry => entry?.id === mint)
    if (!token) return null
    return {
      symbol: token.symbol || `${mint.slice(0, 4)}…`,
      name: token.name ?? '',
      icon: token.icon ?? '',
      priceUsd: Number(token.usdPrice) || 0,
      change24h: Number(token.stats24h?.priceChange) || 0,
      liquidity: Number(token.liquidity) || 0,
      holders: Number(token.holderCount) || 0,
      supply: Number(token.totalSupply) || 0,
      createdAt: token.firstPool?.createdAt ?? token.createdAt ?? null,
    }
  } catch {
    return null
  }
}

/** Best-liquidity pool for a token, its candles, its newest trades and the largest holders. */
async function loadTokenDetail(cfg, chain, mint, tf) {
  const metaPromise =
    chain.kind === 'solana'
      ? loadTokenMeta(mint)
      : loadEvmTokenMeta(chain, mint)
  const [meta, pool] = await Promise.all([metaPromise, bestPool(chain, mint)])

  const [candleFrame, aggregate] = tf === '1h' ? ['hour', 1] : tf === '1d' ? ['day', 1] : ['minute', 15]
  const [candlesBody, tradesBody] = await Promise.all([
    pool
      ? gecko(
          chain.gecko,
          `/pools/${pool.address}/ohlcv/${candleFrame}?aggregate=${aggregate}&limit=96&currency=usd`,
        ).catch(() => null)
      : null,
    pool
      ? gecko(chain.gecko, `/pools/${pool.address}/trades?trade_volume_in_usd_greater_than=0`).catch(() => null)
      : null,
  ])

  const candles = (candlesBody?.data?.attributes?.ohlcv_list ?? [])
    .slice()
    .reverse()
    .map(([time, open, high, low, close, volume]) => [time, open, high, low, close, volume])
  const trades = (tradesBody?.data ?? []).slice(0, 15).map(entry => {
    const trade = entry?.attributes ?? {}
    const buy = trade.kind === 'buy'
    return {
      side: buy ? 'buy' : 'sell',
      tx: trade.tx_hash ?? '',
      wallet: trade.tx_from_address ?? '',
      amount: Number(buy ? trade.to_token_amount : trade.from_token_amount) || 0,
      priceUsd: Number(buy ? trade.price_to_in_usd : trade.price_from_in_usd) || 0,
      valueUsd: Number(trade.volume_in_usd) || 0,
      at: trade.block_timestamp ?? null,
    }
  })

  return {
    mint,
    tf,
    market: meta,
    pool: pool
      ? {
          address: pool.address,
          name: pool.name ?? '',
          liquidityUsd: Number(pool.reserve_in_usd) || 0,
          fdvUsd: Number(pool.fdv_usd) || 0,
          marketCapUsd: Number(pool.market_cap_usd) || 0,
          volume24h: Number(pool.volume_usd?.h24) || 0,
          volume1h: Number(pool.volume_usd?.h1) || 0,
          change1h: Number(pool.price_change_percentage?.h1) || 0,
          change24h: Number(pool.price_change_percentage?.h24) || 0,
          buys24h: Number(pool.transactions?.h24?.buys) || 0,
          sells24h: Number(pool.transactions?.h24?.sells) || 0,
          createdAt: pool.pool_created_at ?? null,
        }
      : null,
    candles,
    trades,
    links: {
      dexscreener: pool
        ? `https://dexscreener.com/${chain.chainRef ?? chain.dexscreener ?? 'solana'}/${pool.address}`
        : `https://dexscreener.com/${chain.chainRef ?? chain.dexscreener ?? 'solana'}/${mint}`,
      explorer:
        chain.kind === 'solana'
          ? `https://solscan.io/token/${mint}`
          : `${String(chain.explorer).replace(/\/$/, '')}/token/${mint}`,
      geckoterminal: pool ? `https://www.geckoterminal.com/${chain.gecko}/pools/${pool.address}` : null,
    },
    at: new Date().toISOString(),
  }
}

/** Price and supply detail for one EVM token: DexScreener for price, Blockscout for holders. */
async function loadEvmTokenMeta(chain, mint) {
  const base = String(chain.explorer).replace(/\/$/, '')
  const [market, counters] = await Promise.all([
    loadEvmMarket(chain, [{ mint: mint.toLowerCase() }]),
    jsonFetch(`${base}/api/v2/tokens/${mint}/counters`).catch(() => null),
  ])
  const quote = market.get(mint.toLowerCase())
  return {
    symbol: quote?.symbol || `${mint.slice(0, 6)}…`,
    name: quote?.name ?? '',
    icon: quote?.icon ?? '',
    priceUsd: quote?.priceUsd ?? 0,
    change24h: quote?.change24h ?? 0,
    liquidity: quote?.liquidity ?? 0,
    holders: Number(counters?.token_holders_count) || 0,
    supply: 0,
    createdAt: null,
  }
}

/** Blockscout's holder list for an EVM token, shaped like the Solana one. */
async function evmHolders(cfg, chain, mint) {
  const base = String(chain.explorer).replace(/\/$/, '')
  let items = []
  for (let attempt = 0; attempt < 2 && !items.length; attempt += 1) {
    if (attempt) await new Promise(resolve => setTimeout(resolve, 700))
    const body = await jsonFetch(`${base}/api/v2/tokens/${mint}/holders`).catch(() => null)
    items = Array.isArray(body?.items) ? body.items : []
  }
  return items.slice(0, 10).map(entry => ({
    address: entry?.address?.hash ?? null,
    account: entry?.address?.hash ?? null,
    pct: 0,
    amount: 0,
  }))
}

/** Largest token accounts and their owner wallets; empty when the endpoint throttles the call. */
async function topHolders(cfg, mint) {
  try {
    const largest = await rpc(cfg.rpcUrl, 'getTokenLargestAccounts', [mint])
    const rows = (largest?.value ?? []).slice(0, 10)
    const owners = new Map()
    await Promise.all(
      rows.map(async row => {
        try {
          const info = await rpc(cfg.historyRpcUrl || cfg.rpcUrl, 'getAccountInfo', [
            row.address,
            { encoding: 'jsonParsed' },
          ])
          const owner = info?.value?.data?.parsed?.info?.owner
          if (owner) owners.set(row.address, owner)
        } catch {
          // A missing owner still leaves the account address to show.
        }
      }),
    )
    return rows.map(row => ({
      address: owners.get(row.address) ?? null,
      account: row.address,
      amount: Number(row.uiAmountString) || 0,
    }))
  } catch {
    return []
  }
}

/** One transaction's token and SOL deltas for this wallet, memoized per signature process-wide. */
const txMemo = new Map()

function readDeltas(tx, address) {
  const meta = tx?.meta
  if (!meta) return null
  const keys = tx.transaction?.message?.accountKeys ?? []
  const index = keys.findIndex(key => (typeof key === 'string' ? key : key?.pubkey) === address)
  // The balance delta carries the network fee; without adding it back, a plain token transfer
  // reads as a buy paid with 5000 lamports and the cost basis collapses to zero.
  const fee = keys.length && index === 0 ? (meta.fee ?? 0) / 1e9 : 0
  const sol = index >= 0 ? (meta.postBalances[index] - meta.preBalances[index]) / 1e9 + fee : 0
  const sum = list => {
    const map = new Map()
    for (const balance of list ?? []) {
      if (balance?.owner !== address) continue
      const decimals = balance.uiTokenAmount?.decimals ?? 0
      const raw = Number(balance.uiTokenAmount?.amount ?? 0) / 10 ** decimals
      if (raw || !map.has(balance.mint)) map.set(balance.mint, (map.get(balance.mint) ?? 0) + raw)
    }
    return map
  }
  const before = sum(meta.preTokenBalances)
  const after = sum(meta.postTokenBalances)
  const changes = []
  for (const [mint, amount] of after) {
    const delta = amount - (before.get(mint) ?? 0)
    if (Math.abs(delta) > 1e-9) changes.push([mint, delta])
  }
  for (const [mint, amount] of before) {
    if (after.has(mint)) continue
    if (Math.abs(amount) > 1e-9) changes.push([mint, -amount])
  }
  if (!changes.length) return null
  return { sol, changes, time: tx.blockTime ?? 0 }
}

async function readHistory(cfg, address, progress) {
  const signatures = await rpc(cfg.rpcUrl, 'getSignaturesForAddress', [address, { limit: cfg.scanSignatures }])
  const rows = (signatures ?? []).filter(entry => !entry.err && entry.signature).reverse()
  progress.total = rows.length
  const out = []
  const missing = []
  for (const entry of rows) {
    const cached = txMemo.get(entry.signature)
    if (cached) {
      out.push(cached)
      progress.done += 1
    } else missing.push(entry.signature)
  }
  const historyUrl = cfg.historyRpcUrl || cfg.rpcUrl
  let failed = 0
  let cursor = 0
  const worker = async () => {
    while (cursor < missing.length) {
      const signature = missing[cursor]
      cursor += 1
      try {
        const tx = await rpc(historyUrl, 'getTransaction', [
          signature,
          { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
        ])
        const deltas = readDeltas(tx, address)
        if (deltas) {
          if (txMemo.size > 4000) txMemo.clear()
          txMemo.set(signature, deltas)
          out.push(deltas)
        }
      } catch {
        // One unreadable transaction must not abort the whole ledger; a later refresh retries it.
        failed += 1
      }
      progress.done += 1
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, cfg.historyConcurrency) }, worker))
  const sorted = out.sort((a, b) => a.time - b.time)
  sorted.failed = failed
  sorted.total = rows.length
  return sorted
}

/** FIFO cost basis in SOL, only from swaps that pair exactly one token mint with a SOL leg. */
function buildLedger(history) {
  const lots = new Map()
  const stats = new Map()
  let skipped = 0
  for (const tx of history) {
    if (Math.abs(tx.sol) < 1e-7 || tx.changes.length !== 1) {
      skipped += 1
      continue
    }
    const [mint, delta] = tx.changes[0]
    const unitCost = -tx.sol / delta
    if (!(unitCost > 0)) {
      skipped += 1
      continue
    }
    const stat = stats.get(mint) ?? { realizedSol: 0, trades: 0 }
    if (delta > 0) {
      const queue = lots.get(mint) ?? []
      queue.push({ qty: delta, unitCost })
      lots.set(mint, queue)
      stat.trades += 1
    } else {
      let remaining = -delta
      let cost = 0
      for (const lot of lots.get(mint) ?? []) {
        if (remaining <= 0) break
        const take = Math.min(lot.qty, remaining)
        cost += take * lot.unitCost
        lot.qty -= take
        remaining -= take
      }
      stat.realizedSol += tx.sol - cost
      stat.trades += 1
    }
    stats.set(mint, stat)
  }
  const remainingCost = mint => (lots.get(mint) ?? []).reduce((sum, lot) => sum + lot.qty * lot.unitCost, 0)
  const remainingQty = mint => (lots.get(mint) ?? []).reduce((sum, lot) => sum + lot.qty, 0)
  return { stats, remainingCost, remainingQty, skipped }
}

export { buildLedger, readDeltas }

export function apply(ctx, config) {
  const cfg = { ...DEFAULTS, ...(config ?? {}) }
  if (cfg.heliusKey && !cfg.rpcUrl.includes('helius')) {
    const fast = `https://mainnet.helius-rpc.com/?api-key=${cfg.heliusKey}`
    cfg.rpcUrl = fast
    cfg.historyRpcUrl = cfg.historyRpcUrl || fast
  }
  const portfolioCache = new Map()
  const detailCache = new Map()
  const pnlJobs = new Map()

  async function portfolio(chain, address) {
    const key = `${chain.id}:${address.toLowerCase()}`
    const cached = portfolioCache.get(key)
    if (cached && Date.now() - cached.at < cfg.cacheMs) return cached.value
    const value =
      chain.kind === 'solana'
        ? await loadHoldings(cfg, address)
        : chain.kind === 'evm'
          ? await loadEvmHoldings(cfg, chain, address)
          : await loadBtcHoldings(chain, address)
    const merged = { ...value, chain: chain.id, chainLabel: chain.label }
    portfolioCache.set(key, { at: Date.now(), value: merged })
    return merged
  }

  async function pnl(chain, address, refresh) {
    if (chain.kind === 'bitcoin') return { status: 'unsupported' }
    const key = `${chain.id}:${address.toLowerCase()}`
    let job = pnlJobs.get(key)
    if (job?.state === 'running') return job.snapshot()
    if (job?.state === 'ready' && !refresh && Date.now() - job.at < 5 * 60_000) return job.snapshot()
    const progress = { done: 0, total: 0 }
    const next = {
      state: 'running',
      at: Date.now(),
      error: null,
      progress,
      result: null,
      snapshot() {
        if (this.state === 'ready') return { status: 'ready', ...this.result }
        if (this.state === 'failed') return { status: 'failed', error: this.error }
        return { status: 'scanning', progress: this.progress }
      },
    }
    pnlJobs.set(key, next)
    void (async () => {
      try {
        const historyOf = chain.kind === 'solana' ? readHistory(cfg, address, progress) : readEvmHistory(cfg, chain, address, progress)
        const [holdings, history] = await Promise.all([portfolio(chain, address), historyOf])
        const ledger = buildLedger(history)
        const nativePrice = holdings.nativePrice
        const rows = holdings.tokens.map(row => {
          const stat = ledger.stats.get(row.mint) ?? { realizedSol: 0, trades: 0 }
          const quoted = !row.unpriced && nativePrice > 0
          const valueNative = quoted ? row.valueUsd / nativePrice : 0
          const costNative = ledger.remainingCost(row.mint)
          const seenQty = ledger.remainingQty(row.mint)
          // A token received without a priced buy has no cost basis; value that part as unknown
          // instead of claiming the whole holding as profit.
          const coverage = row.amount > 0 ? Math.min(1, Math.max(0, seenQty / row.amount)) : 0
          const unrealizedNative = quoted && coverage > 0 ? valueNative * coverage - costNative : 0
          const basisIncomplete = coverage < 0.999
          return {
            mint: row.mint,
            symbol: row.symbol,
            icon: row.icon,
            valueUsd: row.valueUsd,
            costBasisUsd: costNative * nativePrice,
            realizedUsd: stat.realizedSol * nativePrice,
            unrealizedUsd: unrealizedNative * nativePrice,
            trades: stat.trades,
            basisIncomplete,
            basisKnown: coverage > 0.999,
            unpriced: !quoted,
          }
        })
        // Realised PnL counts every mint the ledger saw, including tokens already sold out.
        let realizedNative = 0
        for (const stat of ledger.stats.values()) realizedNative += stat.realizedSol
        const realizedUsd = realizedNative * nativePrice
        const unrealizedUsd = rows.reduce((sum, row) => sum + row.unrealizedUsd, 0)
        next.result = {
          rows,
          realizedUsd,
          unrealizedUsd,
          totalUsd: realizedUsd + unrealizedUsd,
          scanned: history.length,
          failed: history.failed ?? 0,
          skipped: ledger.skipped,
          truncated: (history.total ?? 0) >= cfg.scanSignatures,
          at: new Date().toISOString(),
        }
        next.state = 'ready'
      } catch (error) {
        next.state = 'failed'
        next.error = String(error?.message ?? error)
      }
    })()
    return next.snapshot()
  }

  async function tokenDetail(chain, mint, tf) {
    const key = `${chain.id}:${mint}:${tf}`
    const cached = detailCache.get(key)
    if (cached && Date.now() - cached.at < 60_000) return cached.value
    const value = await loadTokenDetail(cfg, chain, mint, tf)
    detailCache.set(key, { at: Date.now(), value })
    return value
  }

  const readAddress = request => {
    const params = new URL(request.url).searchParams
    const base = chainOf(params.get('chain'))
    // cfg.explorers lets a chain point at any Blockscout-compatible instance.
    const chain = { ...base, explorer: cfg.explorers?.[base.id] ?? base.explorer }
    const address = params.get('address') ?? ''
    return { params, chain, address, valid: chain.address.test(address) }
  }

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: '/sol-wallet/portfolio',
        async resource(request) {
          const { chain, address, valid } = readAddress(request)
          if (!valid) return json({ error: 'invalid-address' }, 400)
          try {
            return json(await portfolio(chain, address))
          } catch (error) {
            return json({ error: String(error?.message ?? error) }, 502)
          }
        },
      }),
    'sol-wallet: portfolio route',
  )
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: '/sol-wallet/pnl',
        async resource(request) {
          const { chain, address, valid, params } = readAddress(request)
          if (!valid) return json({ error: 'invalid-address' }, 400)
          try {
            return json(await pnl(chain, address, params.get('refresh') === '1'))
          } catch (error) {
            return json({ error: String(error?.message ?? error) }, 502)
          }
        },
      }),
    'sol-wallet: pnl route',
  )
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: '/sol-wallet/token',
        async resource(request) {
          const { chain, params } = readAddress(request)
          const mint = params.get('mint') ?? ''
          if (!chain.address.test(mint)) return json({ error: 'invalid-mint' }, 400)
          const raw = params.get('tf')
          const tf = raw === '1h' || raw === '1d' ? raw : '15m'
          try {
            return json(await tokenDetail(chain, mint, tf))
          } catch (error) {
            return json({ error: String(error?.message ?? error) }, 502)
          }
        },
      }),
    'sol-wallet: token route',
  )
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: '/sol-wallet/holders',
        async resource(request) {
          const { chain, params } = readAddress(request)
          const mint = params.get('mint') ?? ''
          if (!chain.address.test(mint)) return json({ error: 'invalid-mint' }, 400)
          try {
            return json({ mint, holders: await holdersWithin(cfg, chain, mint, 6000) })
          } catch (error) {
            return json({ mint, holders: [], error: String(error?.message ?? error) }, 502)
          }
        },
      }),
    'sol-wallet: holders route',
  )
  ctx.logger?.info?.('sol-wallet: routes ready for %s', Object.keys(CHAINS).join(', '))
}
