import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["jsdoc", "typescript"],
  categories: {
    correctness: "warn"
  },
  rules: {
    "eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }
    ]
  },
  ignorePatterns: [".agents/**"]
});
