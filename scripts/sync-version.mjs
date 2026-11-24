// Copies the version from package.json (the single source of the app version)
// into the Python backend's metadata. Runs from the npm "version" hook, so
// `npm version patch` updates and commits these files along with package.json.
import { existsSync, readFileSync, writeFileSync } from "fs";

const root = new URL("../", import.meta.url);
const { version } = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));

const update = (path, pattern) => {
    const url = new URL(path, root);
    const text = readFileSync(url, "utf8");
    if (!pattern.test(text)) throw new Error(`No version entry found in ${path}`);
    writeFileSync(url, text.replace(pattern, `$1"${version}"`));
};

// [project] version (the first top-level version key)
update("local-server/pyproject.toml", /^(version = )"[^"]*"/m);

// uv.lock is git-ignored (*.lock), so it only exists in checkouts that ran
// `uv sync`; keep its local-server entry in step there.
if (existsSync(new URL("local-server/uv.lock", root))) {
    update("local-server/uv.lock", /(\nname = "local-server"\nversion = )"[^"]*"/);
}

console.log(`Synced backend version to ${version}`);
