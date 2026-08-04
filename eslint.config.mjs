import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
    // local-server is the Python backend — its only .js files are vendored
    // (werkzeug debugger inside .venv) or frozen PyInstaller output.
    globalIgnores(["dist", "release", "gridappsd-viz", "local-server"]),
    {
        files: ["electron/**/*.js"],
        extends: [js.configs.recommended],
        languageOptions: {
            globals: globals.node,
            sourceType: "commonjs",
        },
    },
    {
        files: ["**/*.{js,jsx}"],
        ignores: ["electron/**"],
        extends: [
            js.configs.recommended,
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
        ],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
            parserOptions: {
                ecmaVersion: "latest",
                ecmaFeatures: { jsx: true },
                sourceType: "module",
            },
        },
        rules: {
            "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
        },
    },
]);
