# Sightline — a public window on Tacit

A single, read-only web page that shows live mainnet activity on **Tacit** across both of its chains: Bitcoin envelopes, the header-relay bridge, and the confidential / pay pools on Ethereum, Base and Robinhood Chain.

Built for [poidh bounty #1519](https://poidh.xyz/base/bounty/1519) (*Vibecode a Tacit Explorer*).

**This page never asks for a seed phrase or private key, never connects a wallet, and never moves funds.**

## Use it

Open `index.html` from any static host, or locally:

```bash
python3 -m http.server 8765
# then visit http://127.0.0.1:8765/
```

No build step, no API keys, no backend of our own.

## What it shows

- **Bitcoin:** tip height (mempool.space and blockstream.info, compared), fees, etched assets, recent etches / mints / burns, holders and confidential-transfer counts, the Bitcoin-native tETH/TAC AMM, and public secondary-market listings.
- **Bridge:** attested height, relay tip, lag, confirmations, bridge burns and mints, burns in flight, burns awaiting bundle, live notes, folded cross-outs, and the relay process status. Lag is recomputed from the API's own heights and compared with the live Bitcoin tip.
- **Ethereum / Base / Robinhood:** `cbtcBackingSats()`, `outstandingCusd()`, canonical ERC-20 supplies (TAC, tacBTC, tacUSD, wTAC) from the published contracts, launch-farm program data, and TacitEvmPool keeper heads (tree size, pending, public root) on Ethereum, Base and Robinhood Chain.
- **Privacy boundary:** a two-sided map of what an observer can see (timing, counts, fees, public addresses) versus what stays hidden (note amounts, links between notes), filled with the live counts from the panels above, plus this page's own blind spots.
- **Lookup:** a tacit1 ID (link to [tacitscan.io](https://tacitscan.io/)), a Bitcoin txid, an EVM address, or an XNS `name@namespace`. XNS is resolved on the official v2 registry. The lookup only ever shows public data.
- **Re-derive:** copy-paste `curl` / `cast` commands for the headline figures.

## Requirements checklist (from the official bounty text)

| Requirement | How Sightline meets it |
| --- | --- |
| Live public URL, no wallet or sign-in to browse | Static files; no wallet button or account gate |
| Real mainnet data (Tacit APIs, indexer, RPC, explorers); no mock data | Browser fetches official endpoints and public RPCs on load |
| Public source repo | This repository |
| Never ask for seed phrases or private keys, never move funds | No signing, no `eth_sendTransaction`, no key fields |
| Posted on X tagging @tacitfi, @z0r0zzz, @davidpereIsHIM | Draft tweet in `claim-tx.md` — the owner posts it |
| Claim with a screenshot, plus live URL, repo and X post in the description | Prepared once the page and screenshot are hosted |

## CORS note

Most official Tacit API routes, the evm-pool keepers, mempool.space, blockstream.info and the public RPCs already send `Access-Control-Allow-Origin: *`. Three official routes — `/assets`, `/amm/pools` and `/market` — send `Access-Control-Allow-Origin: https://tacit.finance` only. Sightline tries those URLs directly, then, if the browser blocks them, refetches the **same official URL** through [allorigins](https://allorigins.win) and labels the path as a relay. The official JSON link is always provided so a judge can open it without us.

## Addresses and sources

See [SOURCES.md](./SOURCES.md). Contract addresses are copied from the official [DEPLOYMENTS.md](https://github.com/src-company/tacit/blob/main/docs/DEPLOYMENTS.md).

## What this is not

It is not a wallet, a mixer, a decoder of private notes, or an official Tacit product. For envelope-level decode, use [tacitscan.io](https://tacitscan.io/).
