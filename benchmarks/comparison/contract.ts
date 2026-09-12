export const comparisonDependencyVersions = {
  preact: "10.29.8",
  react: "19.2.8",
  "react-dom": "19.2.8",
  "solid-js": "1.9.15",
} as const;

export const comparisonFixtureIds = [
  "rect",
  "rect-keyed",
  "vanilla",
  "react",
  "preact",
  "solid",
] as const;

export const comparisonBuildContract = {
  schemaVersion: 1,
  bunVersion: "1.4.0",
  target: "browser",
  format: "esm",
  minify: true,
  packages: "bundle",
} as const;
