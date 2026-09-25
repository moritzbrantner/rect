import { transformAsync } from "@babel/core";
import solidPreset from "babel-preset-solid";

export async function compileSolidJsx(source, filename) {
  const transformed = await transformAsync(source, {
    filename,
    sourceType: "module",
    babelrc: false,
    configFile: false,
    sourceMaps: false,
    presets: [[solidPreset, { generate: "dom", hydratable: false }]],
  });
  if (!transformed?.code) {
    throw new Error("Solid compiler did not emit JavaScript.");
  }
  return transformed.code;
}
