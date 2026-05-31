import { resolve } from "node:path";
import { validateContentRepo } from "./content-validate.js";

const repoRoot = resolve(process.cwd(), "..");

const docs = await validateContentRepo(repoRoot);
console.log(`Validated ${docs.length} problem(s).`);
