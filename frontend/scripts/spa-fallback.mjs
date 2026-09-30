// GitHub Pages has no SPA routing: serve index.html for unknown paths so
// deep links like /entity/<wallet> survive a refresh. Also disable Jekyll.
import { copyFileSync, writeFileSync } from "node:fs";
copyFileSync("dist/index.html", "dist/404.html");
writeFileSync("dist/.nojekyll", "");
console.log("Added dist/404.html and dist/.nojekyll");
