# dsh-wallet-tracker

Multi-chain wallet watcher for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): keep a named book of wallets, see balances and estimated PnL per wallet or combined, and open any token for a chart, its latest trades and its top holders.

Read-only. No API key needed for any of the default data sources.

```
Solana · Ethereum · Optimism · Base · Arbitrum · Bitcoin
```

## Install

Install the bundle through Plugin Manager (Settings → Plugins → add from registry) or with the Plugin Manager tool's `install_bundle` and the package name:

```
dsh-wallet-tracker
```

The panel shows up in the left sidebar as **Wallets** / **Dompet**. Refresh the page once after installing.

## What you get

| | |
|---|---|
| Portfolio | Native balance plus every SPL / ERC-20 token, priced in USD, per wallet or summed across the whole book |
| PnL | FIFO cost basis from on-chain swap history, realised + unrealised, per token and in total |
| Token detail | Candles (15m / 1h / 1d), liquidity, FDV, 24h volume, top holders, latest trades, and links to DexScreener / explorer |
| Wallet book | Any number of wallets, custom names, per-chain address validation, filter by wallet or switch to "all wallets" |
| Big numbers | Compact (`$15.43M`) with the exact figure on hover, or click to pin it |

## Data sources

| Chain | Balances | History (PnL) | Detail |
|---|---|---|---|
| Solana | Solana RPC (`api.mainnet-beta`) | `solana-rpc.publicnode.com` | GeckoTerminal + RugCheck + Jupiter |
| Ethereum, Optimism | Blockscout API | Blockscout API | GeckoTerminal + Blockscout |
| Base, Arbitrum | Blockscout API — the public instances answer `403` from Cloudflare, point `explorers` at your own | same | same |
| Bitcoin | Blockstream API | — (PnL not computed) | — |

Prices come from DexScreener and Jupiter; both are keyless with generous limits.

## How PnL is estimated

* The last `scanSignatures` transactions (default 150) are read per wallet.
* A transaction counts as a trade when exactly one token mint changes **and** there is a native leg (SOL/ETH) with it. Fee-only transfers are ignored, so a received token never becomes a "buy".
* Lots are consumed FIFO. Cost basis is held in the native coin and converted at the current native price, so the figure tracks the coin, not the dollar at trade time.
* When part of a holding has no priced trade behind it (airdrops, transfers in), that part is excluded from unrealised PnL and shown as *no cost basis* instead of being counted as profit.
* EVM trades that swap one ERC-20 for another without a native leg are skipped, not counted as zero.

## Configuration

Edit the row in your profile's `cordis.patch.yml`:

```yaml
- insert:
    - id: sol-wallet
      name: dsh-wallet-tracker
      config:
        rpcUrl: https://api.mainnet-beta.solana.com
        historyRpcUrl: https://solana-rpc.publicnode.com
        historyConcurrency: 6
        scanSignatures: 150
        # heliusKey: ''            # free key from helius.dev: overrides both RPC URLs
        # explorers:               # any Blockscout-compatible instance per chain
        #   base: https://blockscout.example
```

| Key | Default | Meaning |
|---|---|---|
| `rpcUrl` | `api.mainnet-beta.solana.com` | Balances, prices' mint list, signature list |
| `historyRpcUrl` | `solana-rpc.publicnode.com` | Swap history; takes concurrent single calls |
| `historyConcurrency` | `6` | Parallel history requests |
| `scanSignatures` | `150` | Transactions scanned for PnL |
| `heliusKey` | — | Free Helius key; replaces both RPC URLs |
| `explorers` | — | Per-chain Blockscout base URL override |

## Screenshots

Coming in a follow-up commit — the panel is a live Harness surface, so the images are captured from a running profile rather than mocked.

## Development

The bundle is plain JavaScript with no build step and no dependencies.

```
node check.mjs      # ledger maths, fee handling, client registration
```

| File | Role |
|---|---|
| `index.js` | Host half: chain registry, balances, prices, history, PnL ledger, JSON routes |
| `client.js` | Client half: the sidebar entry, panel, wallet book, token drawer |
| `check.mjs` | Assert-based self-check for the ledger and the client wiring |

Host routes (loopback only, same origin as the GUI): `GET /sol-wallet/portfolio`, `/sol-wallet/pnl`, `/sol-wallet/token`, `/sol-wallet/holders`, each taking `chain` and `address` or `mint`.

## Privacy

The wallet book lives in your browser's `localStorage`. The host half only reads public chain data — no credentials, no keys, no signing, nothing leaves your machine except the public API and RPC calls listed above.

## License

MIT © Muhammad Adi
