// Installs a packaged .vsix into the VS Code-compatible editors found on PATH.
//
// Detects known editor CLIs, shows an interactive numbered picker (all or a
// subset), installs the selected targets, and verifies each one.
//
// Usage:
//   node scripts/install-vsix.mjs [<vsix>] [--all] [--editors cli1,cli2]
//                                  [--list] [--yes] [--help]
//   EXTRA_VSCODE_CLIS="cli-a,cli-b" node scripts/install-vsix.mjs --list
//
// With no <vsix> argument the newest markdown-diff-preview-*.vsix in the
// repo root is used. `--all` / `--yes` skips the prompt (non-interactive).

import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

export const KNOWN_VSCODE_CLIS = [
    { cli: 'code', label: 'VS Code' },
    { cli: 'code-insiders', label: 'VS Code Insiders' },
    { cli: 'code-oss', label: 'Code - OSS' },
    { cli: 'codium', label: 'VSCodium (codium)' },
    { cli: 'vscodium', label: 'VSCodium (vscodium)' },
    { cli: 'cursor', label: 'Cursor' },
    { cli: 'windsurf', label: 'Windsurf' },
    { cli: 'trae', label: 'Trae' },
    { cli: 'antigravity', label: 'Antigravity' },
    { cli: 'kiro', label: 'Kiro' },
    { cli: 'positron', label: 'Positron' },
    { cli: 'void', label: 'Void' },
];

export function getExtraClis() {
    const raw = process.env.EXTRA_VSCODE_CLIS ?? '';
    return raw
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
}

export function getCandidateClis() {
    const seen = new Set();
    const candidates = [];
    for (const entry of [...KNOWN_VSCODE_CLIS.map((item) => item.cli), ...getExtraClis()]) {
        if (!seen.has(entry)) {
            seen.add(entry);
            candidates.push(entry);
        }
    }
    return candidates;
}

export function getLabel(cli) {
    const known = KNOWN_VSCODE_CLIS.find((entry) => entry.cli === cli);
    return known ? known.label : cli;
}

export function isCliAvailable(cli) {
    const probe = spawnSync('command', ['-v', cli], { encoding: 'utf-8', shell: true });
    return probe.status === 0 && (probe.stdout ?? '').trim().length > 0;
}

export function detectEditors() {
    return getCandidateClis().filter((cli) => isCliAvailable(cli));
}

/**
 * Parse free-form user input into a subset of `detected`, kept in detected
 * order and de-duplicated. Accepts "all", 1-based numbers, CLI names, and any
 * mix separated by commas, spaces, or both. Unknown tokens are ignored.
 */
export function parseEditorSelection(rawInput, detected) {
    const input = (rawInput ?? '').trim().toLowerCase();
    if (input === '' || input === 'all' || input === '*') {
        return [...detected];
    }
    const picked = new Set();
    for (const token of input.split(/[\s,;]+/).filter(Boolean)) {
        if (/^\d+$/.test(token)) {
            const index = Number.parseInt(token, 10) - 1;
            if (index >= 0 && index < detected.length) {
                picked.add(detected[index]);
            }
            continue;
        }
        const match = detected.find((cli) => cli.toLowerCase() === token);
        if (match) {
            picked.add(match);
        }
    }
    return detected.filter((cli) => picked.has(cli));
}

export function buildInstallArgs(vsixPath) {
    return ['--install-extension', vsixPath];
}

export function buildListArgs() {
    return ['--list-extensions', '--show-versions'];
}

function parseVsixVersion(fileName) {
    const match = /(\d+)\.(\d+)\.(\d+)/.exec(fileName);
    if (!match) {
        return null;
    }
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersions(left, right) {
    for (let index = 0; index < 3; index += 1) {
        if (left[index] !== right[index]) {
            return left[index] - right[index];
        }
    }
    return 0;
}

export function findLatestVsix(candidates) {
    let best = null;
    let bestVersion = null;
    for (const name of candidates) {
        const version = parseVsixVersion(name);
        if (!version) {
            continue;
        }
        if (best === null || (bestVersion !== null && compareVersions(version, bestVersion) > 0)) {
            best = name;
            bestVersion = version;
        }
    }
    return best;
}

export function resolveVsixPath(explicitArg, repoRoot) {
    if (explicitArg && existsSync(explicitArg)) {
        return explicitArg;
    }
    const sibling = readdirSync(repoRoot).filter((name) => name.endsWith('.vsix'));
    const latest = findLatestVsix(sibling);
    return latest ? join(repoRoot, latest) : null;
}

function printUsage() {
    console.log(`Usage: node scripts/install-vsix.mjs [<vsix>] [options]

Options:
  --list              List detected editor CLIs and exit
  --all               Install to all detected editors (no prompt)
  --editors a,b       Install to a comma-separated subset of CLIs (no prompt)
  --yes               With no --editors: install to all without prompting
  -h, --help          Show this help

Environment:
  EXTRA_VSCODE_CLIS   Comma-separated extra CLI names to probe (e.g. "code-next,my-ide")

Examples:
  node scripts/install-vsix.mjs --list
  node scripts/install-vsix.mjs
  node scripts/install-vsix.mjs markdown-diff-preview-1.5.1.vsix --editors code,cursor`);
}

function promptSelection(detected) {
    console.log('Detected VS Code-compatible editors:');
    detected.forEach((cli, index) => {
        console.log(`  ${index + 1}) ${getLabel(cli)} (${cli})`);
    });
    console.log('');
    console.log('Enter numbers or CLI names (e.g. "1,3" or "code cursor"), "all" for all.');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question('Select editors to install to [all]: ', (answer) => {
            rl.close();
            resolve(parseEditorSelection(answer, detected));
        });
    });
}

function runCli(cli, args) {
    return spawnSync(cli, args, { encoding: 'utf-8', shell: false });
}

function verifyInstalled(cli, verify) {
    const marker = 'markdown-diff';
    if (verify.status !== 0 || !(verify.stdout ?? '').toLowerCase().includes(marker)) {
        return null;
    }
    return (verify.stdout ?? '')
        .split('\n')
        .filter((line) => line.toLowerCase().includes(marker))
        .join('\n');
}

function installAndVerify(cli, vsixPath) {
    console.log(`\n== ${getLabel(cli)} (${cli}) ==`);
    const install = runCli(cli, buildInstallArgs(vsixPath));
    if (install.status !== 0) {
        console.error(`Install failed for ${cli}:\n${install.stderr || install.stdout}`);
        return false;
    }
    console.log(install.stdout.trim());
    const matched = verifyInstalled(cli, runCli(cli, buildListArgs()));
    if (matched === null) {
        console.error(`Verification failed for ${cli}: extension not listed after install.`);
        return false;
    }
    console.log(`Verified: ${matched}`);
    return true;
}

function handleListCommand() {
    const detected = detectEditors();
    if (detected.length === 0) {
        console.log('No VS Code-compatible editor CLIs found on PATH.');
        console.log(`Probed: ${getCandidateClis().join(', ')}`);
        return true;
    }
    console.log('Detected editors:');
    for (const cli of detected) {
        console.log(`- ${getLabel(cli)} (${cli})`);
    }
    return true;
}

function readEditorsFlagValue(args) {
    const flag = args.find((arg) => arg.startsWith('--editors'));
    if (!flag) {
        return null;
    }
    if (flag.includes('=')) {
        return flag.split('=').slice(1).join('=');
    }
    return args[args.indexOf(flag) + 1] ?? '';
}

async function resolveInstallTargets(args, detected) {
    const flagValue = readEditorsFlagValue(args);
    if (flagValue !== null) {
        return parseEditorSelection(flagValue.replace(/,/g, ' '), detected);
    }
    if (args.includes('--all') || args.includes('--yes') || !process.stdin.isTTY) {
        return [...detected];
    }
    return await promptSelection(detected);
}

function reportNoEditors() {
    console.error('No VS Code-compatible editor CLIs found on PATH.');
    console.error(`Probed: ${getCandidateClis().join(', ')}`);
    console.error('Hint: add more CLIs via EXTRA_VSCODE_CLIS="cli-a,cli-b".');
}

async function main() {
    const args = process.argv.slice(2);
    if (args.includes('-h') || args.includes('--help')) {
        printUsage();
        return;
    }
    if (args.includes('--list')) {
        handleListCommand();
        return;
    }

    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const positional = args.find((arg) => !arg.startsWith('-'));
    const vsixPath = resolveVsixPath(positional, root);
    if (!vsixPath) {
        console.error(
            positional
                ? `VSIX not found: ${positional}`
                : 'No .vsix found in repo root. Package one first (npx vsce package).',
        );
        process.exitCode = 1;
        return;
    }
    console.log(`VSIX: ${basename(vsixPath)}`);

    const detected = detectEditors();
    if (detected.length === 0) {
        reportNoEditors();
        process.exitCode = 1;
        return;
    }

    const targets = await resolveInstallTargets(args, detected);

    if (targets.length === 0) {
        console.error('No editors selected. Nothing to install.');
        process.exitCode = 1;
        return;
    }
    console.log(`Targets: ${targets.join(', ')}`);

    let failed = 0;
    for (const cli of targets) {
        if (!installAndVerify(cli, vsixPath)) {
            failed += 1;
        }
    }
    if (failed > 0) {
        process.exitCode = 1;
        return;
    }
    console.log('\nAll selected editors installed and verified.');
}

const invokedDirectly =
    process.argv[1] !== undefined && basename(process.argv[1]) === 'install-vsix.mjs';
if (invokedDirectly) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
