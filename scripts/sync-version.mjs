// Copies the version from package.json (the single source of the app version)
// into the Python backend's metadata. Runs from the npm "version" hook, so
// `npm version patch` updates these files and commits them with package.json.
import { execFileSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";

const root = new URL("../", import.meta.url);
const { version } = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));

const update = (path, pattern) => {
    const url = new URL(path, root);
    if (!existsSync(url)) return;
    const text = readFileSync(url, "utf8");
    if (!pattern.test(text)) throw new Error(`No version entry found in ${path}`);
    writeFileSync(url, text.replace(pattern, `$1"${version}"`));
    stage(path);
};

// Stage the file for the `npm version` commit, if git tracks it.
const stage = (path) => {
    const git = (...args) => execFileSync("git", args, { cwd: fileURLToPath(root), stdio: "ignore" });
    try {
        git("ls-files", "--error-unmatch", path);
    } catch {
        return; // untracked (or not a git checkout)
    }
    git("add", path);
};

// [project] version (the first top-level version key)
update("local-server/pyproject.toml", /^(version = )"[^"]*"/m);
// The local-server entry in the lockfile. \r?: Windows checkouts use CRLF.
update("local-server/uv.lock", /(\r?\nname = "local-server"\r?\nversion = )"[^"]*"/);

console.log(`Synced backend version to ${version}`);
