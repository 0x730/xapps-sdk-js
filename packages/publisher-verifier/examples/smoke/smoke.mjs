import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const examplesDir = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(examplesDir, "..", "..");
const entryFile = path.resolve(pkgDir, "src", "index.js");

const mod = await import(pathToFileURL(entryFile).href);

for (const exportName of [
  "parseSubjectActionPayload",
  "computeWebauthnChallengeFromSubjectActionBytes",
  "verifyJwsSubjectProof",
  "verifyWebauthnSubjectProof",
  "verifySubjectProofEnvelope",
]) {
  if (!(exportName in mod)) {
    throw new Error(`Missing export ${exportName} from publisher-verifier`);
  }
}

console.log("[publisher-verifier smoke] exports look publishable");
