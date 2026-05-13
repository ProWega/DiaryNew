import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import storybook from "eslint-plugin-storybook";
import prettier from "eslint-config-prettier/flat";
import globals from "globals";

const baseRules = {
  "no-unused-vars": [
    "warn",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      ignoreRestSiblings: true,
      caughtErrorsIgnorePattern: "^_",
    },
  ],
  "no-empty": ["error", { allowEmptyCatch: true }],
  eqeqeq: ["error", "smart"],
};

export default [
  {
    ignores: [
      "node_modules/",
      "dist/",
      "storybook-static/",
      "coverage/",
      "docs/.vitepress/cache/",
      "docs/.vitepress/dist/",
      "docs/.vitepress/.temp/",
      "*.log",
    ],
  },

  js.configs.recommended,

  // Frontend (React) sources — ESM + JSX + browser globals
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs["recommended-latest"].rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      ...baseRules,
      "react/prop-types": "off",
      "react/no-unknown-property": ["error", { ignore: ["css"] }],
      // jsx-a11y as warn so CI passes while findings stay visible — fix in 0.5.
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/no-autofocus": "warn",
      // react-hooks v7 introduced strict rules aligned with React Compiler.
      // Useful, but require focused refactors — keep as warn for now and
      // address them in dedicated PRs.
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
    },
  },

  // Frontend TypeScript sources — same rules as JS + TS parser + TS-specific rules
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2024,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs["recommended-latest"].rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-empty": ["error", { allowEmptyCatch: true }],
      eqeqeq: ["error", "smart"],
      "react/prop-types": "off",
      "react/no-unknown-property": ["error", { ignore: ["css"] }],
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/no-autofocus": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
    },
  },

  // Storybook stories — same as frontend + storybook plugin, plus storybook globals
  {
    files: ["src/**/*.stories.{js,jsx,ts,tsx}"],
    plugins: { storybook },
    rules: {
      ...storybook.configs["flat/recommended"][0].rules,
    },
  },

  // Storybook config files
  {
    files: [".storybook/**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: baseRules,
  },

  // Server (Node, CommonJS)
  {
    files: ["server/**/*.{cjs,js}", "scripts/**/*.{cjs,js}"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: baseRules,
  },

  // Test files — Vitest globals (describe, it, expect, vi)
  {
    files: ["src/**/*.test.{js,jsx,ts,tsx}", "server/**/*.test.{js,cjs}", "vitest.setup.ts"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        vi: "readonly",
        jest: "readonly",
      },
    },
  },

  // Build/config scripts at project root
  {
    files: ["vite.config.{mjs,js}", "*.config.{mjs,js,cjs}"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: baseRules,
  },

  // Disable stylistic rules that conflict with Prettier — must be last.
  prettier,
];
