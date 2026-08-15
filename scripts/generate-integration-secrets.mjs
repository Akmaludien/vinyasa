import { randomBytes } from "node:crypto";

const integrationToken = randomBytes(32).toString("base64url");
const proxyKey = randomBytes(32).toString("base64url");

console.log("Generated integration secrets. Store them in a secret manager; do not commit this output.");
console.log(`NEXORA_INTEGRATION_TOKEN=${integrationToken}`);
console.log(`VINYASA_PROXY_KEY=${proxyKey}`);
console.log("");
console.log("Set NEXORA_INTEGRATION_TOKEN to the same value in Nexora and Vinyasa.");
console.log("Set VINYASA_PROXY_KEY only in Vinyasa server/runtime and GitHub Actions.");
console.log("The browser must never receive either value.");
