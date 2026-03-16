# Recanon

**Deterministic Execution & Verification Engine**

Recanon is an open-source verification layer for deterministic computations. It enables cryptographic verification that a given output was produced by a specific program, seed, and parameters—without requiring trust in the party presenting the result.

---

## Execution Verification

Recanon uses the [NexArt deterministic execution runtime](https://nexart.io/protocol) to produce **Certified Execution Records (CERs)**—portable JSON artifacts that can be independently replayed and verified without trusting the presenter. For protocol details, see the [NexArt documentation](https://docs.nexart.io).

---

## What This Is

Recanon connects to a **Canonical Renderer**—an authoritative, deterministic execution environment. When you submit a program (code + seed + parameters), the renderer produces:

1. A deterministic output (PNG image or MP4 animation)
2. A SHA-256 hash of the output bytes
3. Metadata (renderer version, protocol version, timestamp)

Anyone with the same inputs can re-execute and verify the hash matches. **No trust required.**

This is useful for:

- **Quantitative Finance**: Backtest results that auditors can independently replay
- **Scientific Computing**: Reproducible experiment outputs with cryptographic receipts
- **Gaming/NFTs**: Provably fair procedural generation
- **AI/ML**: Deterministic model outputs for audit trails
- **Any domain** where "I computed X" needs to be verifiable

---

## What Problem It Solves

### The Reproducibility Gap

Screenshots lie. Logs can be forged. Even blockchain explorers only show *that* a transaction happened—not *what* computation produced it.

When someone claims "my trading strategy returned 40% in backtesting," you have no way to verify:

- Was the backtest actually run?
- Were the parameters cherry-picked after the fact?
- Is this the same version they'll use in production?

### Canonical Execution

Recanon solves this by requiring all certified executions to run on a **canonical renderer**—a single, authoritative environment with:

- Deterministic PRNG (seeded)
- Frozen dependencies
- Byte-identical output for identical inputs
- Cryptographic hashing of outputs

The result: **Portable, verifiable artifacts** that anyone can replay.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Recanon UI                          │
│  • Configure renderer URL                                   │
│  • Generate certified bundles                               │
│  • Verify existing bundles                                  │
│  • Export portable JSON artifacts                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Canonical Renderer                        │
│  • POST /render  → Execute program, return output + hash    │
│  • POST /verify  → Re-execute and compare hashes            │
│  • GET  /health  → Check availability                       │
│                                                             │
│  Deterministic environment:                                 │
│  • Seeded PRNG (randomSeed)                                │
│  • Fixed library versions                                   │
│  • SHA-256 of raw output bytes                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Artifact Bundle (JSON)                   │
│  {                                                          │
│    "snapshot": { code, seed, vars, execution },            │
│    "expectedImageHash": "sha256...",                       │
│    "canonical": { url, rendererVersion, protocolVersion }, │
│    "output": { base64, mimeType }                          │
│  }                                                          │
│                                                             │
│  → Portable, self-describing, independently verifiable     │
└─────────────────────────────────────────────────────────────┘
```

---

## 5-Minute Quickstart

### 1. Clone and Install

```bash
git clone https://github.com/your-org/recanon.git
cd recanon
npm install
```

### 2. Configure Canonical Renderer

Set the renderer URL (defaults to public Railway instance):

```bash
# Option A: Environment variable
export VITE_CANONICAL_RENDERER_URL=https://nexart-canonical-renderer-production.up.railway.app

# Option B: Use the UI to set via localStorage (Edit button in header)
```

### 3. Start the App

```bash
npm run dev
```

Open http://localhost:5173

### 4. Generate a Verified Bundle

1. Navigate to **Verify & Test**
2. Check the health badge (should be green)
3. Click **"Generate VERIFIED Static"**
4. The bundle JSON appears in the editor

### 5. Verify the Bundle

1. With bundle JSON in the editor, click **"Verify Bundle"**
2. Result: **VERIFIED** ✓

### 6. Test Tampering Detection

1. Click **"Generate FAILED Proof"** (tampers the hash)
2. Click **"Verify Bundle"**
3. Result: **FAILED** ✗

The system correctly detected that the claimed hash doesn't match the recomputed output.

---

## What This Is NOT

| ❌ Not This | ✓ What It Actually Is |
|-------------|----------------------|
| A trading platform | A verification layer for backtests |
| An oracle network | A deterministic execution environment |
| Investment advice | A technical tool for reproducibility |
| Client-side verification | Server-side canonical execution |
| A blockchain | Complementary infrastructure (works alongside chains) |

Recanon doesn't replace blockchains—it produces artifacts that *can* be anchored to blockchains for timestamping, but verification is independent of any chain.

---

## Bundle Format

### Static Mode (single image)

```json
{
  "runtime": "nexart-canonical-renderer",
  "snapshot": {
    "code": "function setup() {...}",
    "seed": 42,
    "vars": [50, 55, 30, 20, 10, 15, 5, 25, 40, 60],
    "execution": { "frames": 1, "loop": false }
  },
  "expectedImageHash": "a1b2c3...",
  "verificationRequirements": "static-single-hash",
  "canonical": {
    "url": "https://...",
    "rendererVersion": "1.0.0",
    "protocolVersion": "1.0"
  }
}
```

### Loop Mode (animation)

```json
{
  "snapshot": {
    "execution": { "frames": 60, "loop": true }
  },
  "expectedImageHash": "poster-hash...",
  "expectedAnimationHash": "animation-hash...",
  "verificationRequirements": "loop-requires-both-hashes"
}
```

Loop mode requires **both** hashes to verify successfully.

---

## Verification Paths

Verification can happen through three equivalent paths:

| Path | Use Case |
|------|----------|
| **Browser UI** | Interactive verification |
| **CLI Script** | `npx ts-node scripts/replay-artifact.ts bundle.json` |
| **Direct API** | `POST /verify` to canonical renderer |

All paths produce identical results.

---

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Running Your Own Canonical Renderer

The canonical renderer is a separate service. See the [NexArt Canonical Renderer](https://github.com/nexart-protocol/canonical-renderer) repository for deployment instructions.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

**Key rule**: All certified execution logic must go through the canonical renderer. No client-side PRNG, no browser-based hashing for certified results.

---

## License

Code: [MIT License](./LICENSE)

**Note**: The "Recanon" name and branding are not granted by this license. You may fork and modify the code, but derivative works should use a different name.

---

## Links

- [Quick Guide](./docs/quick-guide.md) — Step-by-step usage instructions
- [Examples](./examples/) — Sample artifact bundles for testing
- [NexArt Protocol](https://nexart.dev) — Underlying verification protocol
