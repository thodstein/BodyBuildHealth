const http = require("http");
const fs = require("fs");

// Check if vite dev server is running
http.get("http://localhost:5173/", (res) => {
  let data = "";
  res.on("data", (chunk) => data += chunk);
  res.on("end", () => {
    console.log("Server status:", res.statusCode);
    console.log("Page length:", data.length);
    console.log("Has script:", data.includes("script"));
    
    // Try to fetch the main JS module
    const scriptMatch = data.match(/src="([^"]+\.js)"/);
    if (scriptMatch) {
      console.log("Main script:", scriptMatch[1]);
    }
    
    // Check for error indicators
    console.log("Has error:", data.includes("error") || data.includes("Error"));
    console.log("Has 404:", data.includes("404"));
  });
}).on("error", (e) => {
  console.log("Server not running:", e.message);
});

// Also check the built files
const distFiles = fs.readdirSync("dist/assets").filter(f => f.endsWith(".js"));
console.log("\nBuilt JS files:", distFiles.length);
const mainBundle = distFiles.find(f => f.startsWith("index") && fs.statSync("dist/assets/" + f).size > 100000);
if (mainBundle) {
  const content = fs.readFileSync("dist/assets/" + mainBundle, "utf-8");
  console.log("Main bundle:", mainBundle, Math.round(content.length/1024) + "KB");
  console.log("SUPPORT_CATALOG_DATA:", content.includes("SUPPORT_CATALOG"));
  console.log("__SUPPORT_CATALOG__:", content.includes("__SUPPORT_CATALOG__"));
  console.log("CANONICAL_ID_MAP:", content.includes("CANONICAL_ID_MAP"));
}