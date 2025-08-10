import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));

function jobs() {
  const names = [];
  for (const match of workflow.matchAll(/^ {2}([a-z-]+):\n {4}name:/gm)) {
    names.push(match[1]);
  }
  return names;
}

describe('the workflow', () => {
  it('is the only one there is', () => {
    expect(readdirSync('.github/workflows')).toEqual(['ci.yml']);
  });

  it('runs on a push to main and on every pull request', () => {
    expect(workflow).toContain('branches: [main]');
    expect(workflow).toContain('pull_request:');
  });

  it('can be started by hand', () => {
    expect(workflow).toContain('workflow_dispatch:');
  });

  it('asks for no more permission than reading the code', () => {
    expect(workflow).toContain('permissions:\n  contents: read');
  });

  it('cancels a run that a later push has overtaken', () => {
    expect(workflow).toContain('cancel-in-progress: true');
  });

  it('has a job for every kind of check the project makes', () => {
    for (const job of ['lint', 'test', 'coverage', 'smoke', 'docs', 'release', 'audit', 'image']) {
      expect(`${job}: ${jobs().includes(job)}`).toBe(`${job}: true`);
    }
  });

  it('runs the tests on two versions of node', () => {
    expect(workflow).toContain("node: ['20.18.2', '22.13.1']");
  });

  it('runs a node the manifest allows', () => {
    const floor = Number(manifest.engines.node.match(/>=(\d+)\./)[1]);
    for (const match of workflow.matchAll(/'(\d+)\.\d+\.\d+'/g)) {
      expect(Number(match[1])).toBeGreaterThanOrEqual(floor);
    }
  });

  it('names only npm scripts that exist', () => {
    for (const match of workflow.matchAll(/npm run ([a-z:]+)/g)) {
      expect(Object.keys(manifest.scripts)).toContain(match[1]);
    }
  });

  it('names only test files that exist', () => {
    for (const match of workflow.matchAll(/(tests\/[a-z-]+\.test\.js)/g)) {
      expect(`${match[1]}: ${existsSync(match[1])}`).toBe(`${match[1]}: true`);
    }
  });

  it('holds the suite to a floor the suite actually clears', () => {
    const floor = Number(workflow.match(/floor of (\d+) tests/)[1]);
    expect(floor).toBeGreaterThanOrEqual(2000);
    expect(workflow).toContain(`-lt ${floor}`);
  });

  it('pins every action it uses to a major version', () => {
    for (const match of workflow.matchAll(/uses: ([a-z-]+\/[a-z-]+)@(.+)/g)) {
      expect(`${match[1]}@${match[2]}`).toMatch(/@v\d+$/);
    }
  });
});
