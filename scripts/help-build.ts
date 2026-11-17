/** Regenerates src/modules/help/knowledge.generated.json from the markdown guides. */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { buildKnowledge } from "../src/modules/help/knowledge-build";

const data = buildKnowledge();
const target = path.join(process.cwd(), "src/modules/help/knowledge.generated.json");
writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`);
console.log(`help:build wrote ${data.en.length} en + ${data.hi.length} hi guides`);
