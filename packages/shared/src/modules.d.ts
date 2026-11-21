declare module "write-good" {
  interface Suggestion { index: number; offset: number; reason: string }
  function writeGood(text: string, opts?: Record<string, boolean>): Suggestion[];
  export default writeGood;
}
