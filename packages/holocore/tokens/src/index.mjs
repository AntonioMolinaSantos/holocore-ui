import { TOKENS } from "./tokens.mjs";
export { TOKENS } from "./tokens.mjs";
export { contrast } from "./contrast.mjs";

export function brand(name) {
  if (!Object.hasOwn(TOKENS, name)) throw new Error(`unknown brand "${name}": ${Object.keys(TOKENS).join(", ")}`);
  return TOKENS[name];
}
