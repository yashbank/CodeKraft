import { describe, expect, it } from "vitest";
import {
  isTempId,
  mergeOptimistic,
  optimisticReducer,
  type OptimisticAction,
} from "@/lib/admin/optimistic-rows";

type Row = { id: string; name: string };
const run = (rows: Row[], ...actions: OptimisticAction<Row>[]) =>
  actions.reduce((acc, a) => optimisticReducer(acc, a), rows);

describe("optimistic rows", () => {
  it("adds newest first, settles to the server id, rolls back on failure", () => {
    const a = { id: "optimistic-1", name: "A" };
    const b = { id: "optimistic-2", name: "B" };
    expect(run([], { type: "add", row: a }, { type: "add", row: b }).map((r) => r.id)).toEqual([
      "optimistic-2",
      "optimistic-1",
    ]);
    expect(
      run([a], { type: "settle", tempId: "optimistic-1", id: "srv-1", patch: { name: "A2" } }),
    ).toEqual([{ id: "srv-1", name: "A2" }]);
    expect(run([a, b], { type: "rollback", tempId: "optimistic-1" })).toEqual([b]);
  });

  it("shows pending rows above the server rows until the server list has them", () => {
    const server = [{ id: "s1", name: "S" }];
    const pending = [{ id: "optimistic-1", name: "New" }];
    expect(mergeOptimistic(server, pending).map((r) => r.name)).toEqual(["New", "S"]);
    // settled to a server id the refreshed list now contains -> no duplicate
    const settled = [{ id: "s2", name: "New" }];
    expect(mergeOptimistic([...server, { id: "s2", name: "New" }], settled)).toHaveLength(2);
    expect(mergeOptimistic(server, settled).map((r) => r.id)).toEqual(["s2", "s1"]);
  });

  it("recognises temp ids", () => {
    expect(isTempId("optimistic-x")).toBe(true);
    expect(isTempId("0b9f")).toBe(false);
  });
});
