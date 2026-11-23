import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL('../../../.github/workflows/anchor-root.yml', import.meta.url),
  'utf8',
);
const lines = workflow.split('\n');

describe('Anchor entries root workflow', () => {
  it('runs only by hand and only from main', () => {
    expect(workflow).toMatch(/^on:\n {2}workflow_dispatch:\n/m);
    expect(workflow).not.toMatch(/^ {2}(push|pull_request|schedule):/m);
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
  });

  it('passes the inputs through the environment, never into shell code', () => {
    const uses = lines.filter((line) => line.includes('${{ inputs.'));
    expect(uses).toEqual([
      '      CONTEST: ${{ inputs.contest }}',
      '      ROOT: ${{ inputs.root }}',
      '      COUNT: ${{ inputs.count }}',
    ]);
  });

  it('checks the inputs with a dry run before the key is written', () => {
    const dryRun = workflow.indexOf('--dry-run');
    const key = workflow.indexOf('name: Write the keypair');
    expect(dryRun).toBeGreaterThan(-1);
    expect(dryRun).toBeLessThan(key);
  });

  it('signs with the devnet deployer key and always removes it', () => {
    expect(workflow).toContain('${{ secrets.DEVNET_DEPLOYER_KEYPAIR }}');
    expect(workflow).not.toMatch(/secrets\.(?!DEVNET_DEPLOYER_KEYPAIR\b)/);
    expect(workflow).toMatch(
      /name: Remove the keypair\n\s+if: always\(\)\n\s+run: rm -rf "\$RUNNER_TEMP\/devnet-keys"/,
    );
    expect(workflow).toContain('SOLANA_RPC_URL: https://api.devnet.solana.com');
  });

  it('reads the root back with the verify CLI', () => {
    expect(workflow).toContain('node packages/verify/dist/cli.js onchain');
  });
});
