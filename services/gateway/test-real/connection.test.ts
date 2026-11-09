import { execFile, execFileSync, execSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { pathToFileURL } from 'url';
import { promisify } from 'util';
import { createApp } from '../src/app';

const execFileAsync = promisify(execFile);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const HARNESS_SCRIPT = path.resolve(ROOT_DIR, 'scripts/test-hardening.mjs');

describe('Gateway Real Configuration and Health Check', () => {
  it('responds with 200 and healthy status on /health via supertest', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.services.gateway).toBe('ok');
  });

  if (process.env.GATEWAY_URL) {
    it('responds with 200 on running gateway instance', async () => {
      const response = await fetch(`${process.env.GATEWAY_URL}/health`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('ok');
    });
  }
});

describe('Harness Hardening (U0-R7)', () => {
  it('waitForHttp rejects 404, 500, and 200 without status:"ok", and accepts 200 with {"status":"ok"}', async () => {
    let mode: '404' | '500' | 'bad-body' | 'ok' = '404';
    const server = http.createServer((_req, res) => {
      if (mode === '404') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
      } else if (mode === '500') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error' }));
      } else if (mode === 'bad-body') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      }
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;
    const url = `http://127.0.0.1:${port}/health`;
    const harnessUrl = pathToFileURL(HARNESS_SCRIPT).href;

    const runWaitForHttp = async (timeoutMs: number): Promise<boolean> => {
      try {
        await execFileAsync(
          process.execPath,
          [
            '--input-type=module',
            '-e',
            `import { waitForHttp } from ${JSON.stringify(harnessUrl)}; await waitForHttp(${JSON.stringify(url)}, ${timeoutMs});`,
          ],
          { cwd: ROOT_DIR }
        );
        return true;
      } catch {
        return false;
      }
    };

    try {
      mode = '404';
      expect(await runWaitForHttp(600)).toBe(false);

      mode = 'bad-body';
      expect(await runWaitForHttp(600)).toBe(false);

      mode = '500';
      expect(await runWaitForHttp(600)).toBe(false);

      mode = 'ok';
      expect(await runWaitForHttp(2000)).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('ignores external HARNESS_PROJECT_NAME and HARNESS_COMPOSE_FILE environment variables and protects non-resto-test projects', () => {
    const decoyProject = `proyecto-ajeno-senuelo-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const decoyCompose = path.join(os.tmpdir(), `${decoyProject}-compose.yml`);
    const fakeBinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resto-fake-docker-'));
    const dockerLogFile = path.join(fakeBinDir, 'docker-calls.log');
    const fakeDockerBin = path.join(fakeBinDir, 'docker');

    fs.writeFileSync(
      fakeDockerBin,
      [
        '#!/bin/sh',
        `echo "$@" >> "${dockerLogFile}"`,
        'case "$*" in',
        '  *"up -d --wait"*) exit 1 ;;',
        '  *) exit 0 ;;',
        'esac',
      ].join('\n'),
      { encoding: 'utf8', mode: 0o755 }
    );

    try {
      let cliExitedNonZero = false;
      let stdout = '';
      try {
        stdout = execFileSync(process.execPath, [HARNESS_SCRIPT, '--only-infra'], {
          cwd: ROOT_DIR,
          env: {
            ...process.env,
            PATH: `${fakeBinDir}:${process.env.PATH || ''}`,
            HARNESS_PROJECT_NAME: decoyProject,
            HARNESS_COMPOSE_FILE: decoyCompose,
          },
          encoding: 'utf8',
          stdio: 'pipe',
        });
      } catch (err: any) {
        cliExitedNonZero = true;
        stdout = String(err?.stdout || '');
      }

      expect(cliExitedNonZero).toBe(true);
      expect(stdout).not.toContain(decoyProject);
      expect(stdout).toMatch(/Starting isolated test harness with project name: resto-test-\d+-\d+/);

      const dockerCalls = fs.existsSync(dockerLogFile)
        ? fs.readFileSync(dockerLogFile, 'utf8').trim().split('\n')
        : [];
      expect(dockerCalls.length).toBeGreaterThanOrEqual(2);
      for (const call of dockerCalls) {
        expect(call).not.toContain(decoyProject);
        expect(call).not.toContain(decoyCompose);
        expect(call).toMatch(/-p resto-test-\d+-\d+/);
        expect(call).toContain(path.resolve(ROOT_DIR, 'infra/test/docker-compose.yml'));
      }

      // Also verify createHarnessController explicitly refuses project names not starting with resto-test-
      const harnessUrl = pathToFileURL(HARNESS_SCRIPT).href;
      let rejectedForeignProject = false;
      try {
        execFileSync(
          process.execPath,
          [
            '--input-type=module',
            '-e',
            [
              `import * as harness from ${JSON.stringify(harnessUrl)};`,
              `if (typeof harness.createHarnessController !== 'function') process.exit(0);`,
              `try { harness.createHarnessController({ projectName: ${JSON.stringify(decoyProject)} }); process.exit(0); } catch { process.exit(1); }`,
            ].join(' '),
          ],
          { cwd: ROOT_DIR, stdio: 'pipe' }
        );
      } catch {
        rejectedForeignProject = true;
      }
      expect(rejectedForeignProject).toBe(true);
    } finally {
      fs.rmSync(fakeBinDir, { recursive: true, force: true });
    }
  });

  it('tears down docker compose project and volumes when compose up --wait fails partially via createHarnessController', () => {
    const partialProject = `resto-test-partial-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const tempComposeFile = path.join(os.tmpdir(), `${partialProject}-compose.yml`);
    fs.writeFileSync(
      tempComposeFile,
      [
        'services:',
        '  broken:',
        '    image: redis:7-alpine',
        '    command: ["sh", "-c", "exit 1"]',
        '    volumes:',
        '      - partial_vol:/data',
        'volumes:',
        '  partial_vol:',
      ].join('\n'),
      'utf8'
    );

    const harnessUrl = pathToFileURL(HARNESS_SCRIPT).href;

    try {
      const output = execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          [
            `import * as harness from ${JSON.stringify(harnessUrl)};`,
            `if (typeof harness.createHarnessController !== 'function') { console.log('MISSING_CONTROLLER'); process.exit(0); }`,
            `const ctrl = harness.createHarnessController({ rootDir: ${JSON.stringify(ROOT_DIR)}, projectName: ${JSON.stringify(partialProject)}, composeFile: ${JSON.stringify(tempComposeFile)} });`,
            `let failed = false;`,
            `try { ctrl.startInfra(); } catch { failed = true; } finally { await ctrl.cleanup(); }`,
            `if (!failed) process.exit(2);`,
            `console.log('PARTIAL_CLEANUP_VERIFIED');`,
          ].join(' '),
        ],
        { cwd: ROOT_DIR, encoding: 'utf8', stdio: 'pipe' }
      );

      expect(output).toContain('PARTIAL_CLEANUP_VERIFIED');

      const leftoverContainers = execSync(
        `docker ps -a --filter label=com.docker.compose.project=${partialProject} -q`,
        { encoding: 'utf8' }
      ).trim();
      const leftoverVolumes = execSync(
        `docker volume ls --filter label=com.docker.compose.project=${partialProject} -q`,
        { encoding: 'utf8' }
      ).trim();

      expect(leftoverContainers).toBe('');
      expect(leftoverVolumes).toBe('');
    } finally {
      try {
        execSync(`docker compose -p ${partialProject} -f "${tempComposeFile}" down -v`, {
          stdio: 'pipe',
        });
      } catch {}
      try {
        fs.unlinkSync(tempComposeFile);
      } catch {}
    }
  });

  it('cleanup preserves pre-existing dist/generated directories and removes only those created by the run in an isolated temp tree', () => {
    const tmpRootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resto-marker-test-'));
    const uniqueMarkerName = `.preexisting-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const tmpIdentitySrcGen = path.join(tmpRootDir, 'services/identity/src/generated');
    const tmpIdentityDistGen = path.join(tmpRootDir, 'services/identity/dist/generated');
    const tmpCatalogSrcGen = path.join(tmpRootDir, 'services/catalog/src/generated');
    const tmpCatalogDistGen = path.join(tmpRootDir, 'services/catalog/dist/generated');
    const preExistingMarkerPath = path.join(tmpIdentityDistGen, uniqueMarkerName);

    fs.mkdirSync(tmpIdentitySrcGen, { recursive: true });
    fs.writeFileSync(path.join(tmpIdentitySrcGen, 'client.js'), 'module.exports = {};', 'utf8');
    fs.mkdirSync(tmpIdentityDistGen, { recursive: true });
    fs.writeFileSync(preExistingMarkerPath, 'keep-me-intact', 'utf8');

    fs.mkdirSync(tmpCatalogSrcGen, { recursive: true });
    fs.writeFileSync(path.join(tmpCatalogSrcGen, 'client.js'), 'module.exports = {};', 'utf8');

    const realIdentityDistGen = path.resolve(ROOT_DIR, 'services/identity/dist/generated');
    const realCatalogDistGen = path.resolve(ROOT_DIR, 'services/catalog/dist/generated');
    const realIdentityExistedBefore = fs.existsSync(realIdentityDistGen);
    const realCatalogExistedBefore = fs.existsSync(realCatalogDistGen);

    const harnessUrl = pathToFileURL(HARNESS_SCRIPT).href;
    const isolatedProject = `resto-test-marker-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    try {
      const output = execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          [
            `import fs from 'fs';`,
            `import * as harness from ${JSON.stringify(harnessUrl)};`,
            `if (typeof harness.createHarnessController !== 'function') { console.log('MISSING_CONTROLLER'); process.exit(0); }`,
            `const ctrl = harness.createHarnessController({ rootDir: ${JSON.stringify(tmpRootDir)}, projectName: ${JSON.stringify(isolatedProject)} });`,
            `ctrl.prepareDistGenerated();`,
            `if (!fs.existsSync(${JSON.stringify(path.join(tmpCatalogDistGen, 'client.js'))})) { throw new Error('catalog dist/generated was not copied'); }`,
            `await ctrl.cleanup();`,
            `console.log('MARKER_CLEANUP_VERIFIED');`,
          ].join(' '),
        ],
        { cwd: ROOT_DIR, encoding: 'utf8', stdio: 'pipe' }
      );

      expect(output).toContain('MARKER_CLEANUP_VERIFIED');

      // Pre-existing identity/dist/generated and its unique file must remain intact
      expect(fs.existsSync(preExistingMarkerPath)).toBe(true);
      expect(fs.readFileSync(preExistingMarkerPath, 'utf8')).toBe('keep-me-intact');

      // Catalog dist/generated did not exist before prepareDistGenerated(), so cleanup() must remove it
      expect(fs.existsSync(tmpCatalogDistGen)).toBe(false);

      // Checkout real directories must not have been altered
      expect(fs.existsSync(realIdentityDistGen)).toBe(realIdentityExistedBefore);
      expect(fs.existsSync(realCatalogDistGen)).toBe(realCatalogExistedBefore);
    } finally {
      fs.rmSync(tmpRootDir, { recursive: true, force: true });
    }
  });
});
