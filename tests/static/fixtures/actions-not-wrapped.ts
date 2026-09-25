/**
 * Negative fixture for the SA-07 scanner (`tests/static/actions-use-define-action.test.ts`):
 * every value export here bypasses `defineAction` / `definePublicAction` and must be flagged.
 * Never imported by `src/**`.
 */

export async function rawAction(): Promise<string> {
  return "raw";
}

export const arrowAction = async (): Promise<string> => "raw";

export const objectOfHandlers = { run: async () => "raw" };

const notAnActionFactory = (n: number) => n;
export const wrongFactory = notAnActionFactory(1);

async function raw(): Promise<string> {
  return "raw";
}
export { raw as renamedRaw };

export { ping as reExported } from "./actions-wrapped";

export default rawAction;
