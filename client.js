/** Client half: the "Solana wallet" global panel and its sidebar entry. */

window.__ModuleLoader__.load({
  id: 'dsh-wallet-tracker',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useState } = React

    const NS = 'sol-wallet'
    const PANEL_ID = 'sol-wallet'
    const STORAGE_KEY = 'sol-wallet.address'
    const CHAINS = [
      { id: 'solana', label: 'Solana', symbol: 'SOL', re: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/ },
      { id: 'ethereum', label: 'Ethereum', symbol: 'ETH', re: /^0x[0-9a-fA-F]{40}$/ },
      { id: 'optimism', label: 'Optimism', symbol: 'ETH', re: /^0x[0-9a-fA-F]{40}$/ },
      { id: 'base', label: 'Base', symbol: 'ETH', re: /^0x[0-9a-fA-F]{40}$/ },
      { id: 'arbitrum', label: 'Arbitrum', symbol: 'ETH', re: /^0x[0-9a-fA-F]{40}$/ },
      { id: 'bitcoin', label: 'Bitcoin', symbol: 'BTC', re: /^(bc1[a-zA-HJ-NP-Z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/ },
    ]
    const chainById = id => CHAINS.find(chain => chain.id === id) ?? CHAINS[0]
    const storageKey = chain => `sol-wallet.address.${chain}`

    const DICT = {
      en: {
        panel: 'Wallets',
        title: 'Wallets',
        subtitle: 'Balances, prices and estimated PnL straight from the chain.',
        addressLabel: 'Address',
        nameOptional: 'optional',
        placeholder: 'Wallet address (base58)',
        track: 'Track',
        refresh: 'Refresh',
        loading: 'Reading chain…',
        total: 'Total value',
        change: '24h change',
        realized: 'Realised PnL',
        unrealized: 'Unrealised PnL',
        assets: 'Assets',
        asset: 'Asset',
        amount: 'Amount',
        price: 'Price',
        value: 'Value',
        pnl: 'PnL',
        sol: 'SOL',
        empty: 'This wallet holds no priced tokens.',
        idle: 'Paste a Solana wallet address to start watching it.',
        invalid: 'That does not look like a base58 Solana address.',
        failed: 'Could not read the wallet.',
        scanning: 'Rebuilding PnL from swap history…',
        progress: '{done} of {total} transactions',
        noBasis: 'no cost basis',
        note: 'PnL is FIFO from the last {count} transactions, priced in SOL and converted with the current SOL price — an estimate, not tax reporting.',
        truncated: 'Older history was not scanned.',
        failedRows: '{count} transactions could not be read from the RPC.',
        pnlFailed: 'PnL could not be computed right now — balances above are still live.',
        unpriced: '{count} token(s) have no market price yet, so they show without a value.',
        detail: 'Token detail',
        close: 'Close',
        chart: 'Chart',
        liquidity: 'Liquidity',
        fdv: 'FDV',
        volume24h: '24h volume',
        holders: 'Holders',
        holder: 'Holder',
        topHolders: 'Top holders',
        holdersUnavailable: 'The free holder source is not answering right now — try reopening this token.',
        trades: 'Latest transactions',
        noTrades: 'No trades indexed for this pool yet.',
        noChart: 'No candles for this pool yet.',
        buy: 'Buy',
        sell: 'Sell',
        share: 'Your share of supply',
        openDex: 'DexScreener',
        openExplorer: 'Explorer',
        poolAge: 'Pool age',
        yours: 'you',
        chain: 'Chain',
        allWallets: 'All wallets',
        addWallet: 'Add',
        removeWallet: 'Remove wallet',
        namePlaceholder: 'Name',
        renameHint: 'Click to rename',
        wallets: '{count} wallets',
        walletsTitle: 'Wallets',
        counting: 'counting PnL…',
        pnlUnsupportedShort: 'not available here',
        invalidForChain: 'That is not a valid {chain} address.',
        multiNote: 'Balances refresh every 20s; PnL is cached for 5 minutes. Click a wallet name to rename it.',
        placeholderEthereum: 'Wallet address (0x…)',
        placeholderBitcoin: 'Bitcoin address',
        pnlUnsupported: 'PnL is computed for Solana and EVM chains only; the balance above is live.',
        updated: 'Updated {time}',
      },
      id: {
        panel: 'Dompet',
        title: 'Dompet',
        subtitle: 'Saldo, harga, dan estimasi PnL langsung dari chain.',
        addressLabel: 'Alamat',
        nameOptional: 'opsional',
        placeholder: 'Alamat wallet (base58)',
        track: 'Pantau',
        refresh: 'Muat ulang',
        loading: 'Membaca chain…',
        total: 'Total nilai',
        change: 'Perubahan 24 jam',
        realized: 'PnL terealisasi',
        unrealized: 'PnL belum terealisasi',
        assets: 'Aset',
        asset: 'Aset',
        amount: 'Jumlah',
        price: 'Harga',
        value: 'Nilai',
        pnl: 'PnL',
        sol: 'SOL',
        empty: 'Wallet ini tidak menyimpan token yang punya harga.',
        idle: 'Tempel alamat wallet Solana buat mulai pantau.',
        invalid: 'Itu sepertinya bukan alamat Solana base58.',
        failed: 'Gagal membaca wallet.',
        scanning: 'Menyusun ulang PnL dari riwayat swap…',
        progress: '{done} dari {total} transaksi',
        noBasis: 'tanpa harga beli',
        note: 'PnL dihitung FIFO dari {count} transaksi terakhir, dalam SOL lalu dikonversi pakai harga SOL sekarang — estimasi, bukan laporan pajak.',
        truncated: 'Riwayat lebih lama tidak dipindai.',
        failedRows: '{count} transaksi gagal dibaca dari RPC.',
        pnlFailed: 'PnL belum bisa dihitung sekarang — saldo di atas tetap realtime.',
        unpriced: '{count} token belum punya harga pasar, jadi tampil tanpa nilai.',
        detail: 'Detail token',
        close: 'Tutup',
        chart: 'Grafik',
        liquidity: 'Likuiditas',
        fdv: 'FDV',
        volume24h: 'Volume 24j',
        holders: 'Holder',
        holder: 'Holder',
        topHolders: 'Holder teratas',
        holdersUnavailable: 'Sumber holder gratisnya lagi nggak jawab — coba buka token ini lagi nanti.',
        trades: 'Transaksi terakhir',
        noTrades: 'Belum ada transaksi yang terindex di pool ini.',
        noChart: 'Belum ada candle buat pool ini.',
        buy: 'Beli',
        sell: 'Jual',
        share: 'Porsi supply kamu',
        openDex: 'DexScreener',
        openExplorer: 'Explorer',
        poolAge: 'Umur pool',
        yours: 'kamu',
        chain: 'Chain',
        allWallets: 'Semua wallet',
        addWallet: 'Tambah',
        removeWallet: 'Hapus wallet',
        namePlaceholder: 'Nama',
        renameHint: 'Klik buat ganti nama',
        wallets: '{count} wallet',
        walletsTitle: 'Daftar wallet',
        counting: 'menghitung PnL…',
        pnlUnsupportedShort: 'belum tersedia',
        invalidForChain: 'Itu bukan alamat {chain} yang valid.',
        multiNote: 'Saldo disegarkan tiap 20 detik; PnL di-cache 5 menit. Klik nama wallet buat ganti namanya.',
        placeholderEthereum: 'Alamat wallet (0x…)',
        placeholderBitcoin: 'Alamat Bitcoin',
        pnlUnsupported: 'PnL baru dihitung untuk Solana dan EVM; saldo di atas tetap realtime.',
        updated: 'Diperbarui {time}',
      },
    }

    const CSS = `
.sw-root{position:relative;display:flex;flex:1;min-width:0;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
.sw-root,.sw-root *,.sw-root *::before,.sw-root *::after{box-sizing:border-box}
.sw-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable}
.sw-content{max-width:960px;margin:0 auto;padding:0 clamp(24px,4vw,48px) 48px}
.sw-head{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:16px;padding-top:28px;margin-bottom:20px}
[data-platform=darwin] .sw-head{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}
.sw-head h1{margin:0;font-size:20px;font-weight:500;line-height:28px}
.sw-head p{margin:4px 0 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.sw-head-actions{display:flex;align-items:center;gap:12px}
.sw-updated{font-size:12px;color:var(--dsw-alias-label-secondary)}
.sw-btn{height:34px;padding:0 14px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer}
.sw-btn:hover{border-color:var(--dsw-alias-border-l2)}
.sw-btn:disabled{opacity:.5;cursor:default}
.sw-btn--primary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff}
.sw-form{display:grid;grid-template-columns:auto minmax(0,1fr) 160px auto;align-items:end;gap:8px;margin-bottom:20px;padding:14px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1)}
.sw-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.sw-field > span{font-size:11px;line-height:14px;color:var(--dsw-alias-label-secondary)}
.sw-input{width:100%;max-width:100%;min-width:0;height:34px;padding:0 10px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}
.sw-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.sw-select{width:auto;min-width:118px;cursor:pointer;font-family:inherit}
.sw-input--name{min-width:0}
.sw-input--inline{height:28px;font-size:12px;padding:0 8px;background:transparent;border-color:transparent}
.sw-input--inline:hover{border-color:var(--dsw-alias-border-l1)}
.sw-chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 4px}
.sw-chip-btn{height:28px;padding:0 12px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sw-chip-btn:hover{border-color:var(--dsw-alias-border-l2)}
.sw-chip-btn--on{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff}
.sw-wallets{margin-bottom:20px}
.sw-wallet-row{grid-template-columns:minmax(80px,1fr) minmax(0,1.2fr) auto 28px;column-gap:10px;padding:6px 10px;cursor:pointer;align-items:center}
.sw-wallet-row > *{min-width:0}
.sw-wallet-row:hover{background:var(--dsw-alias-bg-layer-2)}
.sw-wallet-row--on{background:var(--dsw-alias-bg-layer-2);box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary)}
.sw-wallet-row .sw-drawer-close{opacity:0;transition:opacity .12s ease}
.sw-wallet-row:hover .sw-drawer-close,.sw-wallet-row:focus-within .sw-drawer-close{opacity:1}
@media (hover:none){.sw-wallet-row .sw-drawer-close{opacity:1}}
.sw-wallet-tag{display:inline-flex;align-items:center;gap:6px;min-width:0;font-size:11px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sw-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-brand-primary);flex:none}
.sw-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:28px}
.sw-stat{padding:14px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1)}
.sw-stat-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);margin-bottom:4px}
.sw-stat-value{font-size:20px;font-weight:500;line-height:28px;font-variant-numeric:tabular-nums}
.sw-stat-value small{display:block;font-size:12px;font-weight:400;line-height:18px;color:var(--dsw-alias-label-secondary)}
.sw-section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px;font-size:13px;font-weight:500;color:var(--dsw-alias-label-secondary)}
.sw-table{border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.sw-row--click:focus-visible,.sw-chip-btn:focus-visible,.sw-btn:focus-visible,.sw-pill:focus-visible,.sw-drawer-close:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.sw-skeleton{height:11px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);animation:sw-pulse 1.5s ease-in-out infinite}
.sw-skeleton--wide{width:70%}
@keyframes sw-pulse{0%,100%{opacity:.5}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.sw-spin,.sw-skeleton{animation:none}}
.sw-row{display:grid;grid-template-columns:minmax(120px,1.6fr) 1fr .9fr .9fr .8fr 1fr;align-items:center;gap:12px;padding:10px 16px;font-size:13px;border-top:1px solid var(--dsw-alias-border-l1)}
.sw-row:first-child{border-top:0}
.sw-row--head{font-size:12px;color:var(--dsw-alias-label-secondary);padding:12px 16px 8px}
.sw-asset{display:flex;align-items:center;gap:10px;min-width:0}
.sw-ico{width:24px;height:24px;flex:none;border-radius:50%;object-fit:cover;background:var(--dsw-alias-bg-layer-2)}
.sw-ico--text{display:grid;place-items:center;font-size:10px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.sw-asset-text{min-width:0}
.sw-symbol{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sw-mint{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-secondary)}
.sw-num{text-align:right;font-variant-numeric:tabular-nums}
.sw-amount{font-variant-numeric:tabular-nums}
.sw-amount--click{cursor:pointer;border-bottom:1px dotted transparent}
.sw-amount--click:hover{border-bottom-color:var(--dsw-alias-border-l2)}
.sw-up{color:var(--dsw-alias-state-success-primary)}
.sw-down{color:var(--dsw-alias-state-error-primary)}
.sw-flat{color:var(--dsw-alias-label-secondary)}
.sw-empty{padding:32px 20px;border:1px dashed var(--dsw-alias-border-l1);border-radius:14px;text-align:center;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.sw-error{margin-bottom:20px;padding:12px 16px;border-radius:12px;font-size:13px;color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1)}
.sw-note{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.sw-note--block{display:block;margin-top:16px}
.sw-spin{width:12px;height:12px;flex:none;border-radius:50%;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);animation:sw-spin .8s linear infinite}
@keyframes sw-spin{to{transform:rotate(360deg)}}
.sw-row--click{cursor:pointer}
.sw-row--click:hover{background:var(--dsw-alias-bg-layer-2)}
.sw-drawer{position:absolute;top:0;right:0;bottom:0;width:min(520px,100%);display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);border-left:1px solid var(--dsw-alias-border-l1);box-shadow:-24px 0 48px rgba(0,0,0,.18)}
.sw-drawer-head{display:flex;align-items:flex-start;gap:12px;padding:16px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.sw-drawer-title{flex:1;min-width:0}
.sw-drawer-title .sw-symbol{font-size:15px;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;white-space:normal}
.sw-drawer-price{font-size:18px;font-weight:500;font-variant-numeric:tabular-nums}
.sw-drawer-body{flex:1;min-height:0;overflow:auto;padding:16px;scrollbar-gutter:stable}
.sw-pills{display:flex;gap:6px;margin-bottom:12px}
.sw-pill{height:26px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
.sw-pill--on{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.sw-chart{width:100%;height:150px;display:block;margin-bottom:4px}
.sw-chart-range{display:flex;justify-content:space-between;font-size:11px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.sw-kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin:16px 0}
.sw-kv-item{padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base)}
.sw-kv-label{font-size:11px;color:var(--dsw-alias-label-secondary);margin-bottom:2px}
.sw-kv-value{font-size:13px;font-variant-numeric:tabular-nums}
.sw-list{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden}
.sw-list-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:8px 12px;font-size:12px;border-top:1px solid var(--dsw-alias-border-l1)}
.sw-list-row:first-child{border-top:0}
.sw-chip{display:inline-block;padding:1px 6px;border-radius:6px;font-size:11px;margin-right:6px}
.sw-chip--buy{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 12%,transparent)}
.sw-chip--sell{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent)}
.sw-link{color:var(--dsw-alias-brand-primary);text-decoration:none}
.sw-link:hover{text-decoration:underline}
.sw-drawer-links{display:flex;flex-wrap:wrap;gap:12px;margin-top:16px;font-size:12px}
.sw-drawer-close{width:28px;height:28px;flex:none;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;line-height:1}
.sw-drawer-close:hover{color:var(--dsw-alias-label-primary)}
@media (width<=860px){.sw-col-price{display:none}.sw-row{grid-template-columns:minmax(110px,1.6fr) 1fr .9fr .8fr 1fr}}
@media (width<=680px){.sw-col-amount,.sw-col-change{display:none}.sw-row{grid-template-columns:minmax(100px,1.6fr) 1fr 1fr}}
@media (width<=900px){.sw-form{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.sw-field--chain{grid-column:1/2}.sw-field--name{grid-column:2/3}.sw-field--address{grid-column:1/-1}.sw-form .sw-btn{grid-column:1/-1;justify-content:center}}
@media (width<=680px){.sw-wallet-row{grid-template-columns:minmax(0,1fr) auto 28px}.sw-wallet-tag{display:none}.sw-chips{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}}
`

    const usd = value => {
      const abs = Math.abs(value ?? 0)
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: abs > 0 && abs < 1 ? 4 : 2,
        maximumFractionDigits: abs > 0 && abs < 1 ? 4 : 2,
      }).format(value ?? 0)
    }
    const amount = value =>
      new Intl.NumberFormat(undefined, { maximumFractionDigits: value >= 1000 ? 2 : 6 }).format(value ?? 0)
    const signed = value => `${value > 0 ? '+' : ''}${usd(value)}`
    const compactUsd = value => {
      if (!(Math.abs(value ?? 0) >= 1000)) return usd(value)
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 2,
      }).format(value)
    }
    const compactNum = value => {
      if (!(Math.abs(value ?? 0) >= 1000)) return amount(value)
      return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 2 }).format(value)
    }
    const signedPct = value => `${value > 0 ? '+' : ''}${(Number(value) || 0).toFixed(2)}%`
    const tone = value => (value > 0 ? 'sw-up' : value < 0 ? 'sw-down' : 'sw-flat')
    const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    const store = {
      get(chain = 'solana') {
        try {
          return window.localStorage.getItem(storageKey(chain)) ?? ''
        } catch {
          return ''
        }
      },
      set(value, chain = 'solana') {
        try {
          if (value) window.localStorage.setItem(storageKey(chain), value)
          else window.localStorage.removeItem(storageKey(chain))
        } catch {
          // A sandboxed document has no storage; the address then lives only in this view.
        }
      },
      lastChain() {
        try {
          return window.localStorage.getItem(`${STORAGE_KEY}.chain`) ?? 'solana'
        } catch {
          return 'solana'
        }
      },
      setLastChain(chain) {
        try {
          window.localStorage.setItem(`${STORAGE_KEY}.chain`, chain)
        } catch {
          // Same storage limitation as above.
        }
      },
    }

    async function read(path) {
      const response = await fetch(path, { headers: { accept: 'application/json' } })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      return body
    }

    /** Big numbers stay readable; the exact figure is one hover (or click) away. */
    function Amount({ value, kind = 'usd', signed: withSign = false, interactive = true }) {
      const [expanded, setExpanded] = useState(false)
      const exact = kind === 'usd' ? usd(value) : amount(value)
      const text = expanded ? exact : kind === 'usd' ? compactUsd(value) : compactNum(value)
      return h(
        'span',
        {
          className: `sw-amount ${interactive ? 'sw-amount--click' : ''}`,
          title: exact,
          'aria-label': exact,
          onClick: interactive
            ? event => {
                event.stopPropagation()
                setExpanded(current => !current)
              }
            : undefined,
        },
        withSign && (value ?? 0) > 0 ? `+${text}` : text,
      )
    }

    function TokenIcon({ icon, symbol }) {
      if (icon) return h('img', { className: 'sw-ico', src: icon, alt: '', loading: 'lazy' })
      return h('span', { className: 'sw-ico sw-ico--text' }, (symbol || '?').slice(0, 3).toUpperCase())
    }

    function Stat({ label, value, hint, tone: color }) {
      return h(
        'div',
        { className: 'sw-stat' },
        h('div', { className: 'sw-stat-label' }, label),
        h('div', { className: `sw-stat-value ${color ?? ''}` }, value, hint ? h('small', null, hint) : null),
      )
    }

    const BOOK_KEY = 'sol-wallet.book.v1'

    const loadBook = () => {
      try {
        const raw = window.localStorage.getItem(BOOK_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) return parsed.filter(entry => entry?.address && entry?.chain)
        }
      } catch {
        // Fall through to migration.
      }
      // First run on the multi-wallet version: adopt the single addresses saved per chain.
      return CHAINS.map(option => ({ chain: option.id, address: store.get(option.id) }))
        .filter(entry => entry.address)
        .map(entry => ({ id: `${entry.chain}:${entry.address.toLowerCase()}`, ...entry, name: shortAddr(entry.address) }))
    }

    const saveBook = list => {
      try {
        window.localStorage.setItem(BOOK_KEY, JSON.stringify(list))
      } catch {
        // A sandboxed document keeps the book in memory only.
      }
    }

    function WalletPage({ t }) {
      const [book, setBook] = useState(loadBook)
      const [selected, setSelected] = useState('all')
      const [form, setForm] = useState(() => ({ chain: store.lastChain(), address: '', name: '' }))
      const [portfolios, setPortfolios] = useState([])
      const [pnlByWallet, setPnlByWallet] = useState({})
      const [error, setError] = useState('')
      const [loading, setLoading] = useState(false)
      const [nonce, setNonce] = useState(0)
      const [stamp, setStamp] = useState('')
      const [open, setOpen] = useState(null)
      const [tf, setTf] = useState('15m')
      const [detail, setDetail] = useState(null)
      const [detailState, setDetailState] = useState('idle')
      const [holders, setHolders] = useState([])
      const [holdersState, setHoldersState] = useState('idle')

      const active = selected === 'all' ? book : book.filter(wallet => wallet.id === selected)
      const activeKey = active.map(wallet => wallet.id).join('|')

      useEffect(() => {
        if (!active.length) {
          setPortfolios([])
          setPnlByWallet({})
          setLoading(false)
          return undefined
        }
        let alive = true
        let timer = 0
        setLoading(true)

        const loadPnl = async refresh => {
          let scanning = false
          const entries = await Promise.all(
            active.map(async wallet => {
              try {
                const body = await read(
                  `/sol-wallet/pnl?chain=${wallet.chain}&address=${wallet.address}${refresh ? '&refresh=1' : ''}`,
                )
                return [wallet.id, body]
              } catch {
                return [wallet.id, { status: 'failed' }]
              }
            }),
          )
          if (!alive) return
          setPnlByWallet(previous => ({ ...previous, ...Object.fromEntries(entries) }))
          for (const [, body] of entries) if (body.status === 'scanning') scanning = true
          if (scanning) timer = window.setTimeout(() => void loadPnl(false), 1500)
        }

        const loadAll = async refresh => {
          const results = await Promise.all(
            active.map(async wallet => {
              try {
                return {
                  wallet,
                  body: await read(`/sol-wallet/portfolio?chain=${wallet.chain}&address=${wallet.address}`),
                }
              } catch (failure) {
                return { wallet, error: String(failure?.message ?? failure) }
              }
            }),
          )
          if (!alive) return
          setPortfolios(results)
          setStamp(clock())
          setLoading(false)
          const failed = results.filter(entry => entry.error)
          setError(failed.length ? `${failed[0].wallet.name}: ${failed[0].error}` : '')
          await loadPnl(refresh)
        }

        void loadAll(nonce > 0)
        const id = window.setInterval(() => void loadAll(false), 20_000)
        return () => {
          alive = false
          window.clearTimeout(timer)
          window.clearInterval(id)
        }
      }, [activeKey, nonce])

      useEffect(() => {
        if (!open) return undefined
        let alive = true
        setDetailState('loading')
        setDetail(null)
        void read(`/sol-wallet/token?chain=${open.chain}&mint=${open.mint}&tf=${tf}`)
          .then(body => {
            if (!alive) return
            setDetail(body)
            setDetailState('ready')
          })
          .catch(() => alive && setDetailState('failed'))
        return () => {
          alive = false
        }
      }, [open, tf])

      useEffect(() => {
        if (!open) return undefined
        let alive = true
        setHolders([])
        setHoldersState('loading')
        void read(`/sol-wallet/holders?chain=${open.chain}&mint=${open.mint}`)
          .then(body => {
            if (!alive) return
            setHolders(body.holders ?? [])
            setHoldersState('ready')
          })
          .catch(() => alive && setHoldersState('failed'))
        return () => {
          alive = false
        }
      }, [open])

      useEffect(() => {
        if (!open) return undefined
        const onKey = event => {
          if (event.key === 'Escape') setOpen(null)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [open])

      const addWallet = event => {
        event.preventDefault()
        const address = form.address.trim()
        if (!chainById(form.chain).re.test(address)) {
          setError(t('invalidForChain', { chain: chainById(form.chain).label }))
          return
        }
        const id = `${form.chain}:${address.toLowerCase()}`
        if (book.some(wallet => wallet.id === id)) {
          setSelected(id)
          setError('')
          return
        }
        const next = [...book, { id, chain: form.chain, address, name: form.name.trim() || shortAddr(address) }]
        saveBook(next)
        setBook(next)
        setSelected(id)
        setForm(current => ({ ...current, address: '', name: '' }))
        setError('')
        setNonce(value => value + 1)
      }

      const renameWallet = (id, name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        const next = book.map(wallet => (wallet.id === id ? { ...wallet, name: trimmed } : wallet))
        saveBook(next)
        setBook(next)
      }

      const removeWallet = id => {
        const next = book.filter(wallet => wallet.id !== id)
        saveBook(next)
        setBook(next)
        if (selected === id) setSelected('all')
      }

      const headline = book.length
        ? `${book.length} wallet · ${active.length === book.length ? t('allWallets') : active[0]?.name ?? ''}`
        : t('subtitle')

      const head = h(
        'header',
        { className: 'sw-head' },
        h('div', null, h('h1', null, t('title')), h('p', null, headline)),
        h(
          'div',
          { className: 'sw-head-actions' },
          stamp ? h('span', { className: 'sw-updated' }, t('updated', { time: stamp })) : null,
          h(
            'button',
            {
              type: 'button',
              className: 'sw-btn',
              disabled: !book.length || loading,
              onClick: () => setNonce(value => value + 1),
            },
            t('refresh'),
          ),
        ),
      )

      const formRow = h(
        'form',
        { className: 'sw-form', onSubmit: addWallet },
        h(
          'label',
          { className: 'sw-field sw-field--chain' },
          h('span', null, t('chain')),
          h(
            'select',
            {
              className: 'sw-input sw-select',
              value: form.chain,
              onChange: event => setForm(current => ({ ...current, chain: event.target.value })),
            },
            CHAINS.map(option => h('option', { key: option.id, value: option.id }, option.label)),
          ),
        ),
        h(
          'label',
          { className: 'sw-field sw-field--address' },
          h('span', null, t('addressLabel')),
          h('input', {
            className: 'sw-input',
            value: form.address,
            spellCheck: false,
            placeholder:
              form.chain === 'solana'
                ? t('placeholder')
                : form.chain === 'bitcoin'
                  ? t('placeholderBitcoin')
                  : t('placeholderEthereum'),
            onChange: event => setForm(current => ({ ...current, address: event.target.value })),
          }),
        ),
        h(
          'label',
          { className: 'sw-field sw-field--name' },
          h('span', null, t('namePlaceholder')),
          h('input', {
            className: 'sw-input sw-input--name',
            value: form.name,
            maxLength: 48,
            placeholder: t('nameOptional'),
            onChange: event => setForm(current => ({ ...current, name: event.target.value })),
          }),
        ),
        h(
          'button',
          { type: 'submit', className: 'sw-btn sw-btn--primary', disabled: !form.address.trim() },
          t('addWallet'),
        ),
      )

      const chips = book.length
        ? h(
            'div',
            { className: 'sw-chips' },
            h(
              'button',
              {
                type: 'button',
                className: `sw-chip-btn ${selected === 'all' ? 'sw-chip-btn--on' : ''}`,
                onClick: () => setSelected('all'),
              },
              `${t('allWallets')} (${book.length})`,
            ),
            book.map(wallet =>
              h(
                'button',
                {
                  key: wallet.id,
                  type: 'button',
                  className: `sw-chip-btn ${selected === wallet.id ? 'sw-chip-btn--on' : ''}`,
                  onClick: () => setSelected(wallet.id),
                },
                wallet.name,
              ),
            ),
          )
        : null

      const walletList = book.length
        ? h(
            'div',
            { className: 'sw-table sw-wallets' },
            book.map(entry => {
              const quoted = portfolios.find(item => item.wallet.id === entry.id)
              const total = quoted?.body?.totalUsd
              return h(
                'div',
                {
                  className: `sw-row sw-wallet-row ${selected === entry.id ? 'sw-wallet-row--on' : ''}`,
                  key: entry.id,
                  onClick: () => setSelected(entry.id),
                },
                h('input', {
                  className: 'sw-input sw-input--inline',
                  key: `${entry.id}:${entry.name}`,
                  defaultValue: entry.name,
                  maxLength: 48,
                  title: t('renameHint'),
                  onClick: event => event.stopPropagation(),
                  onBlur: event => {
                    const next = event.target.value.trim()
                    if (next) renameWallet(entry.id, next)
                    else event.target.value = entry.name
                  },
                  onKeyDown: event => {
                    if (event.key === 'Enter') event.target.blur()
                    if (event.key === 'Escape') {
                      event.target.value = entry.name
                      event.target.blur()
                    }
                  },
                  'aria-label': t('namePlaceholder'),
                }),
                h(
                  'div',
                  { className: 'sw-wallet-tag' },
                  h('span', { className: 'sw-dot' }),
                  `${chainById(entry.chain).label} · ${shortAddr(entry.address)}`,
                ),
                h('div', { className: 'sw-num' }, total === undefined ? '—' : usd(total)),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'sw-drawer-close',
                    title: t('removeWallet'),
                    'aria-label': t('removeWallet'),
                    onClick: event => {
                      event.stopPropagation()
                      removeWallet(entry.id)
                    },
                  },
                  '✕',
                ),
              )
            }),
          )
        : null

      const rows = []
      let totalUsd = 0
      let changeUsd = 0
      let realizedUsd = 0
      let unrealizedUsd = 0
      let pnlPending = false
      let pnlUnsupported = false
      let pnlReady = false

      for (const entry of portfolios) {
        const body = entry.body
        if (!body) continue
        totalUsd += body.totalUsd ?? 0
        const contribute = row => {
          if (!row.priceUsd || !row.change24h) return
          changeUsd += row.valueUsd - row.valueUsd / (1 + row.change24h / 100)
        }
        const nativeRowFor = {
          mint: entry.wallet.chain === 'solana' ? SOL_MINT : '',
          symbol: body.nativeSymbol ?? '—',
          icon: '',
          amount: body.native ?? 0,
          priceUsd: body.nativePrice ?? 0,
          valueUsd: body.nativeValueUsd ?? 0,
          change24h: body.nativeChange24h ?? 0,
          native: true,
          chain: entry.wallet.chain,
        }
        contribute(nativeRowFor)
        rows.push({ ...nativeRowFor, wallet: entry.wallet })
        for (const token of body.tokens ?? []) {
          contribute(token)
          rows.push({ ...token, chain: entry.wallet.chain, wallet: entry.wallet })
        }

        const pnl = pnlByWallet[entry.wallet.id]
        if (pnl?.status === 'ready') {
          pnlReady = true
          realizedUsd += pnl.realizedUsd ?? 0
          unrealizedUsd += pnl.unrealizedUsd ?? 0
        } else if (pnl?.status === 'scanning') pnlPending = true
        else if (pnl?.status === 'unsupported') pnlUnsupported = true
      }

      rows.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0))

      const pnlForRow = row => {
        const pnl = pnlByWallet[row.wallet.id]
        if (pnl?.status !== 'ready') return null
        return (pnl.rows ?? []).find(item => item.mint === row.mint) ?? null
      }

      const stats = book.length
        ? h(
            'div',
            { className: 'sw-stats' },
            h(Stat, {
              label: t('total'),
              value: h(Amount, { value: totalUsd }),
              hint:
                active.length === 1
                  ? `${amount(portfolios[0]?.body?.native ?? 0)} ${portfolios[0]?.body?.nativeSymbol ?? ''}`
                  : t('wallets', { count: active.length }),
            }),
            h(Stat, {
              label: t('change'),
              value: h(Amount, { value: changeUsd, signed: true }),
              tone: tone(changeUsd),
              hint: totalUsd ? signedPct((changeUsd / Math.max(1, totalUsd - changeUsd)) * 100) : undefined,
            }),
            h(Stat, {
              label: t('realized'),
              value: pnlReady ? h(Amount, { value: realizedUsd, signed: true }) : pnlPending ? '…' : '—',
              tone: pnlReady ? tone(realizedUsd) : undefined,
              hint: pnlPending && !pnlReady ? t('counting') : undefined,
            }),
            h(Stat, {
              label: t('unrealized'),
              value: pnlReady ? h(Amount, { value: unrealizedUsd, signed: true }) : pnlPending ? '…' : '—',
              tone: pnlReady ? tone(unrealizedUsd) : undefined,
              hint: pnlUnsupported ? t('pnlUnsupportedShort') : undefined,
            }),
          )
        : null

      const assetRow = row => {
        const quote = pnlForRow(row)
        const unpriced = !row.priceUsd
        const known = Boolean(quote) && !quote.unpriced && quote.basisKnown !== false
        const unrealized = known ? quote.unrealizedUsd : null
        const basis = quote ? quote.valueUsd - quote.unrealizedUsd : 0
        // A dust cost basis turns the percentage into noise; show it only when the base is real.
        const ratio = known && basis >= 0.01 ? quote.unrealizedUsd / basis : null
        const pnlPct = ratio !== null && Math.abs(ratio) < 1e4 ? ratio * 100 : null
        const openable = row.chain !== 'bitcoin'
        return h(
          'div',
          {
            className: `sw-row ${openable ? 'sw-row--click' : ''}`,
            key: `${row.wallet.id}:${row.mint}`,
            role: openable ? 'button' : undefined,
            tabIndex: openable ? 0 : -1,
            onClick: openable ? () => setOpen({ chain: row.chain, mint: row.mint, row }) : undefined,
            onKeyDown: openable
              ? event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setOpen({ chain: row.chain, mint: row.mint, row })
                  }
                }
              : undefined,
          },
          h(
            'div',
            { className: 'sw-asset' },
            h(TokenIcon, { icon: row.icon, symbol: row.symbol }),
            h(
              'div',
              { className: 'sw-asset-text' },
              h('div', { className: 'sw-symbol' }, row.symbol),
              h('div', { className: 'sw-mint' }, selected === 'all' ? row.wallet.name : row.native ? chainById(row.chain).label : row.mint.slice(0, 6)),
            ),
          ),
          h('div', { className: 'sw-num sw-col-amount' }, amount(row.amount)),
          h('div', { className: 'sw-num sw-col-price' }, row.priceUsd ? usd(row.priceUsd) : '—'),
          h(
            'div',
            { className: 'sw-num' },
            unpriced ? '—' : h(Amount, { value: row.valueUsd, interactive: false }),
          ),
          h(
            'div',
            { className: `sw-num sw-col-change ${unpriced ? 'sw-flat' : tone(row.change24h)}` },
            unpriced || !row.change24h ? '—' : signedPct(row.change24h),
          ),
          h(
            'div',
            { className: `sw-num ${unrealized !== null ? tone(unrealized) : ''}` },
            unrealized === null
              ? '—'
              : h(Amount, { value: unrealized, signed: true, interactive: false }),
            pnlPct !== null ? h('div', { className: 'sw-mint' }, signedPct(pnlPct)) : null,
          ),
        )
      }

      const skeleton = h(
        'div',
        { className: 'sw-table', 'aria-hidden': true },
        Array.from({ length: 3 }, (_, index) =>
          h(
            'div',
            { className: 'sw-row', key: `skeleton-${index}` },
            h('div', null, h('div', { className: 'sw-skeleton sw-skeleton--wide' }), h('div', { className: 'sw-skeleton', style: { marginTop: 6, width: '40%' } })),
            h('div', { className: 'sw-num sw-col-amount' }, h('div', { className: 'sw-skeleton' })),
            h('div', { className: 'sw-num sw-col-price' }, h('div', { className: 'sw-skeleton' })),
            h('div', { className: 'sw-num' }, h('div', { className: 'sw-skeleton' })),
            h('div', { className: 'sw-num sw-col-change' }, h('div', { className: 'sw-skeleton' })),
            h('div', { className: 'sw-num' }, h('div', { className: 'sw-skeleton' })),
          ),
        ),
      )

      const table = rows.length
        ? h(
            'div',
            null,
            h('div', { className: 'sw-section-title' }, h('span', null, t('assets'))),
            h(
              'div',
              { className: 'sw-table' },
              h(
                'div',
                { className: 'sw-row sw-row--head' },
                h('div', null, t('asset')),
                h('div', { className: 'sw-num sw-col-amount' }, t('amount')),
                h('div', { className: 'sw-num sw-col-price' }, t('price')),
                h('div', { className: 'sw-num' }, t('value')),
                h('div', { className: 'sw-num sw-col-change' }, '24h'),
                h('div', { className: 'sw-num' }, t('pnl')),
              ),
              rows.map(assetRow),
            ),
          )
        : null

      const notes = []
      if (pnlPending) {
        notes.push(h('div', { className: 'sw-note', key: 'scan' }, h('span', { className: 'sw-spin' }), t('scanning')))
      }
      if (pnlUnsupported) notes.push(h('p', { className: 'sw-note', key: 'pnl-unsupported' }, t('pnlUnsupported')))
      if (loading)
        notes.push(
          h('div', { className: 'sw-note', key: 'load', role: 'status' }, h('span', { className: 'sw-spin' }), t('loading')),
        )

      const body = h(
        'div',
        null,
        error ? h('div', { className: 'sw-error' }, error) : null,
        !book.length
          ? h(
              'div',
              { className: 'sw-empty' },
              h('div', null, t('idle')),
              h('div', { className: 'sw-mint', style: { marginTop: 6 } }, CHAINS.map(chain => chain.label).join(' · ')),
            )
          : null,
        stats,
        chips,
        skeleton && loading && !rows.length ? skeleton : null,
        walletList
          ? h('div', { className: 'sw-section-title', style: { marginTop: 16 } }, h('span', null, t('walletsTitle')))
          : null,
        walletList,
        table,
        notes,
        book.length ? h('p', { className: 'sw-note sw-note--block' }, t('multiNote')) : null,
      )

      return h(
        'div',
        { className: 'sw-root' },
        h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
        h('div', { className: 'sw-scroll' }, h('div', { className: 'sw-content' }, head, formRow, body)),
        open
          ? h(Drawer, {
              t,
              row: open.row,
              chainLabel: chainById(open.chain).label,
              detail,
              state: detailState,
              tf,
              onTf: setTf,
              holders,
              holdersState,
              onClose: () => setOpen(null),
            })
          : null,
      )
    }

    const SOL_MINT = 'So11111111111111111111111111111111111111112'

    const shortAddr = value => (value && value.length > 10 ? `${value.slice(0, 4)}…${value.slice(-4)}` : value || '')
    const clockOf = value => {
      if (!value) return ''
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    const sinceLabel = value => {
      if (!value) return '—'
      const ms = Date.now() - new Date(value).getTime()
      if (!Number.isFinite(ms) || ms < 0) return '—'
      const hours = ms / 3_600_000
      if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))}m`
      if (hours < 48) return `${Math.round(hours)}h`
      return `${Math.round(hours / 24)}d`
    }

    function Chart({ candles }) {
      const closes = candles.map(candle => Number(candle[4])).filter(value => Number.isFinite(value))
      if (closes.length < 2) return null
      const width = 480
      const height = 150
      const pad = 6
      const min = Math.min(...closes)
      const max = Math.max(...closes)
      const span = max - min || max || 1
      const step = (width - pad * 2) / (closes.length - 1)
      const points = closes.map((value, index) => [
        pad + index * step,
        pad + (height - pad * 2) * (1 - (value - min) / span),
      ])
      const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
      const area = `${line} L${(width - pad).toFixed(1)},${height - pad} L${pad},${height - pad} Z`
      const up = closes[closes.length - 1] >= closes[0]
      const stroke = up ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)'
      return h(
        'svg',
        { className: 'sw-chart', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'none', role: 'img' },
        h(
          'defs',
          null,
          h(
            'linearGradient',
            { id: 'sw-price-fill', x1: 0, y1: 0, x2: 0, y2: 1 },
            h('stop', { offset: '0%', stopColor: stroke, stopOpacity: 0.3 }),
            h('stop', { offset: '100%', stopColor: stroke, stopOpacity: 0 }),
          ),
        ),
        h('path', { d: area, fill: 'url(#sw-price-fill)' }),
        h('path', {
          d: line,
          fill: 'none',
          stroke,
          strokeWidth: 1.6,
          strokeLinejoin: 'round',
          vectorEffect: 'non-scaling-stroke',
        }),
      )
    }

    function Drawer({ t, row, chainLabel, detail, state, tf, onTf, holders, holdersState, onClose }) {
      const closeRef = React.useRef(null)
      React.useEffect(() => closeRef.current?.focus(), [])
      const meta = detail?.market
      const pool = detail?.pool
      const symbol = meta?.symbol || row?.symbol || shortAddr('')
      const price = meta?.priceUsd || row?.priceUsd || 0
      const change = meta?.change24h ?? row?.change24h ?? 0
      const candles = detail?.candles ?? []
      const closes = candles.map(candle => Number(candle[4])).filter(value => Number.isFinite(value))
      const supply = meta?.supply || 0
      const share = supply > 0 && row ? (row.amount / supply) * 100 : null

      const axisTime = seconds => {
        if (!seconds) return ''
        const date = new Date(seconds * 1000)
        return tf === '1d'
          ? date.toLocaleDateString([], { month: 'short', day: 'numeric' })
          : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }

      const pill = label =>
        h(
          'button',
          { type: 'button', className: `sw-pill ${tf === label ? 'sw-pill--on' : ''}`, onClick: () => onTf(label) },
          label,
        )

      const kv = (label, value) =>
        h(
          'div',
          { className: 'sw-kv-item' },
          h('div', { className: 'sw-kv-label' }, label),
          h('div', { className: 'sw-kv-value' }, value),
        )

      const holderRows = holders.map((holder, index) =>
        h(
          'div',
          { className: 'sw-list-row', key: holder.account ?? index },
          h(
            'span',
            null,
            h('span', { className: 'sw-mint' }, `${index + 1}. `),
            holder.address
              ? h('a', {
                  className: 'sw-link',
                  href: `https://solscan.io/account/${holder.address}`,
                  target: '_blank',
                  rel: 'noreferrer',
                }, shortAddr(holder.address))
              : h('span', { className: 'sw-mint' }, shortAddr(holder.account)),
          ),
          h('span', { className: 'sw-num' }, holder.pct ? `${holder.pct.toFixed(2)}%` : amount(holder.amount)),
        ),
      )

      const tradeRows = (detail?.trades ?? []).map((trade, index) =>
        h(
          'div',
          { className: 'sw-list-row', key: `${trade.tx}-${index}` },
          h(
            'span',
            null,
            h('span', { className: `sw-chip sw-chip--${trade.side}` }, trade.side === 'buy' ? t('buy') : t('sell')),
            h(
              'a',
              { className: 'sw-link', href: `https://solscan.io/tx/${trade.tx}`, target: '_blank', rel: 'noreferrer' },
              shortAddr(trade.wallet),
            ),
            h('span', { className: 'sw-mint' }, ` · ${clockOf(trade.at)}`),
          ),
          h(
            'span',
            { className: 'sw-num' },
            usd(trade.valueUsd),
            h('div', { className: 'sw-mint' }, `${amount(trade.amount)} ${symbol}`),
          ),
        ),
      )

      return h(
        'aside',
        { className: 'sw-drawer', role: 'dialog', 'aria-label': t('detail') },
        h(
          'div',
          { className: 'sw-drawer-head' },
          h(TokenIcon, { icon: meta?.icon || row?.icon, symbol }),
          h(
            'div',
            { className: 'sw-drawer-title' },
            h('div', { className: 'sw-symbol' }, symbol),
            h(
              'div',
              { className: 'sw-wallet-tag', style: { marginTop: 2 } },
              h('span', { className: 'sw-dot' }),
              chainLabel,
            ),
            h('div', { className: 'sw-drawer-price' }, price ? usd(price) : '—'),
            h('div', { className: `sw-mint ${price ? tone(change) : ''}` }, price ? signedPct(change) : ''),
          ),
          h(
            'button',
            { type: 'button', className: 'sw-drawer-close', onClick: onClose, 'aria-label': t('close'), ref: closeRef },
            '✕',
          ),
        ),
        h(
          'div',
          { className: 'sw-drawer-body' },
          h('div', { className: 'sw-pills' }, pill('15m'), pill('1h'), pill('1d')),
          closes.length >= 2
            ? h(
                'div',
                null,
                h(Chart, { candles }),
                h(
                  'div',
                  { className: 'sw-chart-range' },
                  h('span', null, `${axisTime(candles[0]?.[0])} · ${usd(Math.min(...closes))}`),
                  h('span', null, `${axisTime(candles[candles.length - 1]?.[0])} · ${usd(Math.max(...closes))}`),
                ),
              )
            : state === 'loading'
              ? h('div', { style: { marginBottom: 12 } }, h('div', { className: 'sw-skeleton', style: { height: 120, borderRadius: 12 } }))
              : h('div', { className: 'sw-empty' }, t('noChart')),
          h(
            'div',
            { className: 'sw-kv' },
            kv(t('liquidity'), pool ? h(Amount, { value: pool.liquidityUsd }) : '—'),
            kv(t('fdv'), pool && pool.fdvUsd ? h(Amount, { value: pool.fdvUsd }) : '—'),
            kv(t('volume24h'), pool ? h(Amount, { value: pool.volume24h }) : '—'),
            kv(t('holders'), meta?.holders ? h(Amount, { value: meta.holders, kind: 'num' }) : '—'),
            kv(t('share'), share === null ? '—' : `${share.toFixed(share < 1 ? 3 : 2)}%`),
            kv(t('poolAge'), pool ? sinceLabel(pool.createdAt) : '—'),
          ),
          h('div', { className: 'sw-section-title' }, h('span', null, t('topHolders'))),
          holderRows.length
            ? h('div', { className: 'sw-list' }, holderRows)
            : h(
                'div',
                { className: 'sw-empty' },
                holdersState === 'loading' ? t('loading') : t('holdersUnavailable'),
              ),
          h('div', { className: 'sw-section-title', style: { marginTop: 20 } }, h('span', null, t('trades'))),
          tradeRows.length
            ? h('div', { className: 'sw-list' }, tradeRows)
            : h('div', { className: 'sw-empty' }, state === 'loading' ? t('loading') : t('noTrades')),
          h(
            'div',
            { className: 'sw-drawer-links' },
            detail?.links?.dexscreener
              ? h(
                  'a',
                  { className: 'sw-link', href: detail.links.dexscreener, target: '_blank', rel: 'noreferrer' },
                  t('openDex'),
                )
              : null,
            detail?.links?.explorer ?? detail?.links?.solscan
              ? h(
                  'a',
                  {
                    className: 'sw-link',
                    href: detail.links.explorer ?? detail.links.solscan,
                    target: '_blank',
                    rel: 'noreferrer',
                  },
                  t('openExplorer'),
                )
              : null,
            detail?.links?.geckoterminal
              ? h(
                  'a',
                  { className: 'sw-link', href: detail.links.geckoterminal, target: '_blank', rel: 'noreferrer' },
                  'GeckoTerminal',
                )
              : null,
          ),
        ),
      )
    }

    function PanelIcon({ size }) {
      const box = size ?? 16
      return h(
        'svg',
        {
          width: box,
          height: box,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('path', { d: 'M2 5.6c0-.9.7-1.6 1.6-1.6h2.2l1.3 1.6h6.3v6.8c0 .9-.7 1.6-1.6 1.6H3.6c-.9 0-1.6-.7-1.6-1.6z' }),
        h('path', { d: 'M2 5.6V4.3c0-.7.5-1.3 1.2-1.3h8.3' }),
        h('circle', { cx: 11.2, cy: 9.3, r: 1.1, fill: 'currentColor', stroke: 'none' }),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(
          () =>
            ctx.locale.register(NS, {
              en: DICT.en,
              id: DICT.id,
            }),
          'sol-wallet: dictionaries',
        )

        ctx.slots.inject('main', function* () {
          yield ctx.slots.register(
            {
              name: 'main',
              key: PANEL_ID,
              locale: NS,
            },
            WalletPage,
          )
        })

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 20,
              locale: NS,
              label: () => ctx.locale.bind(NS)('panel'),
            },
            PanelIcon,
          ),
        )
      },
    }
  },
})
