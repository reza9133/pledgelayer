# PledgeLayer

A dark-mode Web3 frontend for **PledgeLayer** — an on-chain crowdfunding
protocol on [GenLayer](https://genlayer.com) where each funding milestone is
evaluated by an AI adjudicator under validator consensus, rather than by the
creator or a centralized reviewer.

Built with Next.js 14 (App Router, TypeScript, Tailwind) and
[`genlayer-js`](https://docs.genlayer.com/api-references/genlayer-js), talking
to the `PledgeLayerPlatform` Intelligent Contract on **GenLayer Bradbury
Testnet**.

---

## ⚠️ Read this before you deploy

GenLayer Intelligent Contracts are **not** standard EVM/Solidity contracts —
they're Python classes running on GenVM, and the frontend talks to them via
`genlayer-js` (which wraps Viem), not raw `ethers`/`viem` ABI calls. This
project uses `genlayer-js` throughout for that reason. Three things worth
knowing before you treat this as final:

1. **`get_campaign` / `get_milestone` field shapes are inferred, not tested
   live.** `genlayer-js` decodes a contract's dataclass return into a plain JS
   object keyed by the Python field names (e.g. `campaign_id`,
   `funding_goal`). `lib/genlayerClient.ts` normalizes those into camelCase
   and is written defensively (it checks both snake_case and camelCase keys),
   but I couldn't execute a live call against Bradbury from this environment
   to confirm the exact wire shape. **Before you trust this in production,**
   run one read yourself:
   ```ts
   const raw = await readClient.readContract({
     address: CONTRACT_ADDRESS,
     functionName: 'get_campaign',
     args: [1],
   });
   console.log(raw);
   ```
   and adjust `normalizeCampaign` / `normalizeMilestone` in
   `lib/genlayerClient.ts` if the keys differ.

2. **The contract has no way to list campaigns.** There's no
   `get_campaign_count()` or similar — `next_campaign_id` and `campaign_ids`
   are private contract state, not exposed through a `@gl.public.view`. The
   dashboard works around this by probing `get_campaign(1)`,
   `get_campaign(2)`, ... until it hits two consecutive non-existent IDs
   (`lib/genlayerClient.ts` → `listCampaigns`). This works because campaign
   IDs are assigned sequentially with no gaps, but it's one RPC round-trip
   per campaign and doesn't scale well. **Recommended fix** — redeploy with:
   ```python
   @gl.public.view
   def get_campaign_count(self) -> u32:
       return u32(int(self.next_campaign_id) - 1)
   ```
   and swap `listCampaigns` to read the count and fetch in parallel.

3. **There's no way to preview a refund amount.** `campaign_contributions`
   (keyed by `f"{campaign_id}_{address}"`) has no public getter, so the
   frontend can't show "you contributed X, you're owed Y back" before the
   user calls `claim_refund`. The Refund panel is upfront about this. **Recommended
   fix** — add:
   ```python
   @gl.public.view
   def get_contribution(self, campaign_id: u32, backer: Address) -> u256:
       key = f"{int(campaign_id)}_{str(backer)}"
       return self.campaign_contributions.get(key, u256(0))
   ```

4. **`CampaignView` has no `description` field**, so the campaign detail page
   can't display the description passed into `create_campaign` — only the
   title. If you want it shown, add `description: str` to `CampaignView` and
   populate it in `get_campaign`.

None of this blocks using the app as-is (everything degrades gracefully), but
you should decide whether to patch the contract or live with the workarounds
before going further.

---

## Project structure

```
pledgelayer/
├── app/
│   ├── layout.tsx           Root layout, fonts, providers
│   ├── globals.css          Tailwind layers + ledger-themed base styles
│   ├── page.tsx             Dashboard / explore campaigns
│   ├── create/page.tsx      Create-campaign form
│   └── campaign/page.tsx    Campaign detail (?id=<n>) — funding, milestones,
│                             adjudication, cancel/refund
├── components/
│   ├── Navbar.tsx, WalletButton.tsx, Toast.tsx
│   ├── CampaignCard.tsx, StatusBadge.tsx, ProgressBar.tsx, EmptyState.tsx
│   ├── FundModal.tsx, CreateCampaignForm.tsx
│   ├── MilestoneItem.tsx    Evidence submission + adjudication trigger
│   └── VerdictStamp.tsx     Rubber-stamp APPROVED/REJECTED verdict badge
├── lib/
│   ├── contract.ts          Contract address, chain label, shared constants
│   ├── types.ts             CampaignView / MilestoneView TS types
│   ├── format.ts             bigint / token / bps / address formatting
│   ├── genlayerClient.ts     genlayer-js client + typed contract wrapper
│   ├── useWallet.tsx         Wallet connect/disconnect context
│   ├── useToast.tsx          Toast notification context
│   └── global.d.ts          window.ethereum typing
├── next.config.js           output: 'export' (static site, no server needed)
├── tailwind.config.ts        Design tokens (ink/paper/brass/verdict palette)
└── package.json
```

### Design notes

The visual language is a **ledger / adjudication** motif rather than a
generic crypto-dashboard look: near-black ink background, warm brass accent
(the "verdict" color), a serif display face (Fraunces) for headings paired
with Inter for body text and IBM Plex Mono for addresses/amounts/bps. The one
signature element is the rotated rubber-stamp `VerdictStamp` badge that marks
an AI-adjudicated milestone APPROVED or REJECTED — it's the one moment in the
app that visually says "this was ruled on," which is the whole point of the
product.

---

## Local development

**Prerequisites:** Node.js ≥ 18.17, npm ≥ 7.

```bash
npm install
cp .env.example .env.local   # edit if you redeploy the contract elsewhere
npm run dev
```

Open http://localhost:3000. You'll need a browser wallet (e.g. MetaMask)
holding testnet GEN and pointed at (or willing to switch to) GenLayer
Bradbury Testnet — the app calls `client.connect('testnetBradbury')` to
prompt the switch automatically on your first write transaction.

```bash
npm run build   # static export → ./out
```

---

## Push to GitHub

```bash
cd pledgelayer
git init
git add .
git commit -m "Initial PledgeLayer frontend"
git branch -M main
git remote add origin https://github.com/<your-username>/pledgelayer.git
git push -u origin main
```

---

## Deploy to Cloudflare Pages

This app builds to a fully static site (`output: 'export'` in
`next.config.js`) — no `@cloudflare/next-on-pages` adapter or Workers runtime
needed, since every contract interaction happens client-side in the
browser via the connected wallet.

1. **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to
   Git**, and select your `pledgelayer` repo.
2. **Build settings:**
   | Setting | Value |
   |---|---|
   | Framework preset | `Next.js (Static HTML Export)` |
   | Build command | `npm run build` |
   | Build output directory | `out` |
   | Root directory | `/` (or the repo subfolder, if nested) |
3. **Environment variables** (Settings → Environment variables, for both
   Production and Preview): add `NEXT_PUBLIC_CONTRACT_ADDRESS` if you ever
   redeploy the contract to a new address — otherwise the default baked into
   `lib/contract.ts` is used.
4. **Node version:** set `NODE_VERSION` to `18` or later if the build image
   defaults to something older (Settings → Environment variables).
5. Click **Save and Deploy**. Cloudflare will run the build and serve
   `out/` on your `*.pages.dev` subdomain; attach a custom domain from the
   same project page if you want one.

Every subsequent `git push` to `main` triggers a new deploy automatically.

---

## Contract reference

- **Address:** `0x16371c227712a16eB4bfC717dE31bBAB99A4fA2d`
- **Network:** GenLayer Bradbury Testnet (`testnetBradbury` in
  `genlayer-js/chains`)
- Write methods used: `create_campaign`, `fund_campaign` (payable),
  `cancel_campaign`, `submit_milestone`, `adjudicate_milestone`,
  `claim_refund`
- View methods used: `get_campaign`, `get_milestone`
