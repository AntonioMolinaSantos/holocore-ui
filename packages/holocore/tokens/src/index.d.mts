export type BrandName = "antonio-molina" | "jarvis";
export interface Brand {
  readonly color: Readonly<Record<string, string>>;
  readonly font: Readonly<Record<string, readonly string[]>>;
  readonly weight: Readonly<Record<string, readonly number[]>>;
  readonly size: Readonly<Record<string, number>>;
  readonly space: readonly number[];
  readonly radius: Readonly<Record<string, number>>;
  readonly shadow: Readonly<Record<string, string>>;
  readonly text: readonly (readonly [string, string])[];
  readonly display: readonly (readonly [string, string])[];
}
export declare const TOKENS: Readonly<Record<BrandName, Brand>>;
export declare function brand(name: BrandName): Brand;
export declare function contrast(a: string, b: string): number;
