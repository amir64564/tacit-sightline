# Sources used by Sightline

All of these are public. None require a key. Checked on 15 Nov 2026 (IST).

## Official Tacit documentation

- Repo and spec: https://github.com/src-company/tacit
- Deployments and contract addresses: https://github.com/src-company/tacit/blob/main/docs/DEPLOYMENTS.md
- Build a Tacit dapp / public API: https://tacit.finance/build/
- API origin: https://api.tacit.finance
- Existing Bitcoin-side explorer (reference, not copied): https://tacitscan.io/
- XNS: https://xns.name and https://xns.name/blog/xnsv2-is-live
- XNS v2 registry (Ethereum): `0x6e797ba2d3103aF167918e71a7E01DE40D45f74b` (`getName(address)`, `getAddress(string)`)

## Live data this page reads

| Data | Official endpoint or contract | Browser CORS (from a third-party origin) |
| --- | --- | --- |
| Bridge / reflection | `GET https://api.tacit.finance/reflection/status?network=mainnet` | `*` |
| Relay process | `GET https://api.tacit.finance/confidential/relay` | `*` |
| Open relay jobs | `GET https://api.tacit.finance/confidential/open?limit=10` | `*` |
| Launch farms | `GET https://api.tacit.finance/farm/program?network=mainnet` | `*` |
| Assets, etches, mints, burns | `GET https://api.tacit.finance/assets?network=mainnet` | origin-locked to `https://tacit.finance` (direct then labelled allorigins fallback) |
| Bitcoin AMM pools | `GET https://api.tacit.finance/amm/pools?network=mainnet` | origin-locked (same fallback) |
| Secondary market | `GET https://api.tacit.finance/market?network=mainnet` | origin-locked (same fallback) |
| Bitcoin tip + fees | `https://mempool.space/api/blocks/tip/height`, `/api/v1/fees/recommended` | `*` |
| Bitcoin tip (cross-check) | `https://blockstream.info/api/blocks/tip/height` | `*` |
| Bitcoin tx lookup | `https://mempool.space/api/tx/{txid}` | `*` |
| cBTC backing | `cbtcBackingSats()` on ConfidentialPool `0x000000000Ed1eabD231Be41d93b719056F7febFC` | public Ethereum RPC, `*` |
| Outstanding cUSD | `outstandingCusd()` on CollateralEngine `0x000000003f608BDdF0ca45934003ffb9DbDF70DB` | public Ethereum RPC, `*` |
| TAC / tacBTC / tacUSD / wTAC supplies | `totalSupply()` / `decimals()` / `balanceOf` on the published ERC-20s | public Ethereum RPC, `*` |
| Pay-pool heads | `https://tacit-evm-pool-keepers.onrender.com/{1,8453,4663}/evm-pool/keeper/head` | `*` |
| XNS | registry above, Ethereum `eth_call` | public Ethereum RPC, `*` |

Public RPCs used: `https://ethereum-rpc.publicnode.com` (fallback `cloudflare-eth.com`, `rpc.ankr.com/eth`); `https://base-rpc.publicnode.com` (fallback `https://mainnet.base.org`).

## Canonical addresses (from official DEPLOYMENTS.md)

- ConfidentialPool: `0x000000000Ed1eabD231Be41d93b719056F7febFC`
- CollateralEngine: `0x000000003f608BDdF0ca45934003ffb9DbDF70DB`
- TAC: `0xA1313eb9f3A445606D9583bcAc3ebeB56a858279`
- tacBTC (cBTC): `0xdf1d99148bEb7a9AFf1d95C49B3d22b7ed90D696`
- tacUSD (cUSD): `0x23cACFFAc2674514A6d4F6cD420B4cc2aC921564`
- WrappedTac (wTAC): `0x2018139a8FDd3666855BE3315C7683b4D6aB7AEf`
- TacitEvmPool (Ethereum, Base, Robinhood Chain, MegaETH): `0x000000c2A20657CE25f2Ba99737933D031AFBEE9`
- Bitcoin AMM pool id (tETH/TAC): `aa3eab26215844c32ba27ed51413c48f881b4c605a233a5ccd169517bf33eb79`
