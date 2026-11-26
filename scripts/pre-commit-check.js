// =====================================================================
// Digital Piggy - pre-commit safety check (SCM additional feature)
//
// Runs automatically before every commit (see .githooks/pre-commit).
// It looks at the files being committed and BLOCKS the commit if:
//   1. A .js file has a syntax error (it would crash the app)
//   2. A .json file is not valid JSON (e.g. a broken transactions.json)
//   3. A file still has merge-conflict markers (<<<<<<< ======= >>>>>>>)
//   4. Browser code ended up in a server file, or server code in a
//      browser file (this once crashed our server: front-end code was
//      pasted into utils/ViewTransactionUtil.js)
//
// Run it by hand on every file with:   npm run check
// =====================================================================

const { execSync } = require('child_process');
const vm = require('vm');

const checkAll = process.argv.includes('--all');

// ---------- Which files to check ----------
function git(cmd) {
    return execSync('git ' + cmd, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

// Staged files (what is about to be committed), or every tracked file with --all
const files = (checkAll
    ? git('ls-files')
    : git('diff --cached --name-only --diff-filter=ACMR'))
    .split('\n').map(f => f.trim()).filter(Boolean)
    .filter(f => !f.startsWith('node_modules/'));

// Read the STAGED version of a file (the exact content being committed)
function readFile(file) {
    return checkAll ? git('show HEAD:"' + file + '"') : git('show :"' + file + '"');
}

// Remove comments so words inside comments don't trigger rule 4
function stripComments(code) {
    return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
}

const problems = [];
const textFile = /\.(js|json|html|css|md)$/i;
const isServerFile = f => f === 'index.js' || /^utils\/.*\.js$/.test(f);
const isBrowserFile = f => /^public\/js\/.*\.js$/.test(f);

for (const file of files) {
    if (!textFile.test(file)) continue;

    let content;
    try {
        content = readFile(file);
    } catch (e) {
        continue; // file not in the snapshot (e.g. untracked) - skip
    }

    // Rule 3: leftover merge-conflict markers
    if (/^(<{7}|>{7}) /m.test(content) || /^={7}$/m.test(content)) {
        problems.push(file + ': still has merge-conflict markers (<<<<<<< / ======= / >>>>>>>).');
    }

    // Rule 2: JSON must be valid
    if (/\.json$/i.test(file)) {
        try {
            JSON.parse(content);
        } catch (e) {
            problems.push(file + ': is not valid JSON (' + e.message + ').');
        }
    }

    if (/\.js$/i.test(file)) {
        // Rule 1: syntax check (wrapped the same way Node wraps a CommonJS file)
        try {
            new vm.Script('(function (exports, require, module, __filename, __dirname) {' + content + '\n})', { filename: file });
        } catch (e) {
            problems.push(file + ': syntax error - ' + e.message);
        }

        // Rule 4: code in the wrong place
        const code = stripComments(content);
        if (isServerFile(file) && /\b(document|window)\.|XMLHttpRequest/.test(code)) {
            problems.push(file + ': server file uses browser-only code (document / window / XMLHttpRequest). Did front-end code get pasted here?');
        }
        if (isBrowserFile(file) && /\brequire\(|module\.exports/.test(code)) {
            problems.push(file + ': browser file uses server-only code (require / module.exports). Did back-end code get pasted here?');
        }
    }
}

// ---------- Result ----------
if (problems.length > 0) {
    console.error('\n[pre-commit] Commit BLOCKED - please fix these first:\n');
    problems.forEach(p => console.error('  x ' + p));
    console.error('\n(Checked ' + files.length + ' file(s).)\n');
    process.exit(1);
}

console.log('[pre-commit] All checks passed (' + files.length + ' file(s) checked).');
