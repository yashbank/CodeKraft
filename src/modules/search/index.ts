/** `modules/search` public surface (PHASE-03 P3.6, P3.13). */
export * from "./contracts";
export * from "./types";
export * from "./service";
export * from "./actions";
export * from "./queries";
export * from "./parser";
export * from "./indexer";
export type { RetrievedChunk as RetrieverChunk } from "./retriever";
export { retrieveKnowledge } from "./retriever";
