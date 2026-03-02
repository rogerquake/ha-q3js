import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { terser } from "rollup-plugin-terser";

export default {
  input: "src/q3js-card.ts",
  output: {
    file: "custom_components/q3js/www/q3js-card.js",
    format: "es",
    sourcemap: false,
  },
  plugins: [
    resolve(),
    typescript(),
    terser(),
  ],
};
