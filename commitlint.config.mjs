import conventional from "@commitlint/config-conventional";

/** @type {import("@commitlint/types").UserConfig} */
const commitlintConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    ...conventional.rules,
    // The integration branch uses `merge:` commits when landing tickets.
    "type-enum": [
      2,
      "always",
      [...conventional.rules["type-enum"][2], "merge"],
    ],
  },
};

export default commitlintConfig;
