export const comparisonDependencyVersions = {
  preact: "10.29.8",
  react: "19.3.1",
  "react-dom": "19.3.1",
  "solid-js": "1.9.17",
} as const;

export const comparisonCompilerVersions = {
  "@babel/core": "7.29.7",
  "babel-preset-solid": "1.9.16",
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
  bunVersion: "1.4.3",
  target: "browser",
  format: "esm",
  minify: true,
  packages: "bundle",
} as const;

export const comparisonBrowserContract = {
  playwrightVersion: "1.64.1",
  browser: "chromium",
  fanout: {
    nodes: 10,
    updates: 5,
    mountSamples: 15,
    warmupUpdates: 5,
  },
  batched: {
    values: 10,
    updates: 5,
    warmupUpdates: 5,
  },
  keyed: {
    items: 10,
    samples: 5,
    warmupSamples: 5,
  },
} as const;
