# Example Artifact Bundles

This folder contains example artifact bundles for testing verification.

## Files

| File | Description | Expected Result |
|------|-------------|-----------------|
| `verified-static.json` | Valid static (PNG) bundle | VERIFIED ✓ |
| `verified-loop.json` | Valid loop (MP4) bundle with poster + animation hashes | VERIFIED ✓ |
| `failed-tampered.json` | Intentionally tampered bundle with fake hash | FAILED ✗ |

## Usage

### In the UI

1. Open Recanon
2. Navigate to **Verify & Test**
3. Copy the contents of any example file into the bundle editor
4. Click **"Verify Bundle"**

### Via CLI

```bash
npx ts-node scripts/replay-artifact.ts examples/verified-static.json
```

### Via cURL

```bash
curl -X POST https://nexart-canonical-renderer-production.up.railway.app/verify \
  -H "Content-Type: application/json" \
  -d @examples/verified-static.json
```

## Generating Real Bundles

The example files contain placeholder hashes (`REPLACE_WITH_ACTUAL_HASH...`). To generate real, verifiable bundles:

1. Open Recanon
2. Click **"Generate VERIFIED Static"** or **"Generate VERIFIED Loop"**
3. Download the generated bundle
4. Replace the example files with the downloaded bundles

Real bundles will verify against the canonical renderer that created them.

## Notes

- Bundles are specific to the canonical renderer version that created them
- Different renderer versions may produce different hashes for the same input
- The `canonical.url` field in the bundle indicates which renderer to use for verification
- Each bundle is a Certified Execution Record (CER) as defined by the [NexArt protocol](https://nexart.io/protocol). See the [glossary](https://nexart.io/glossary) for terminology
