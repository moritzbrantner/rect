export { Fragment, jsx, jsxDEV, jsxs } from "./dom.ts";

import type { Child } from "./dom.ts";

type IntrinsicProps = Record<string, unknown> & {
  children?: Child;
};

export namespace JSX {
  export type Element = Node;
  export type ElementChildrenAttribute = { children: unknown };
  export type IntrinsicElements = Record<string, IntrinsicProps>;
}
