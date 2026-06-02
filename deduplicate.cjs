const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src", "core", "lab-auto-parser.ts");
let content = fs.readFileSync(filePath, "utf8");

function deduplicateObject(content, objectName) {
    const regex = new RegExp(`const\\s+${objectName}\\s*:\\s*Record<string,\\s*string>\\s*=\\s*\\{([^}]+)\\};`, "s");
    const match = content.match(regex);
    if (!match) {
        console.log("Could not find " + objectName);
        return content;
    }
    const inner = match[1];
    // Split by commas that are not inside quotes.
    const parts = [];
    let current = "";
    let inQuote = false;
    let quoteChar = null;
    for (const ch of inner) {
        if (!inQuote && (ch === '"' || ch === "'")) {
            inQuote = true;
            quoteChar = ch;
            current += ch;
        } else if (inQuote && ch === quoteChar) {
            inQuote = false;
            current += ch;
        } else if (!inQuote && ch === ",") {
            parts.push(current);
            current = "";
        } else {
            current += ch;
        }
    }
    if (current !== "") {
        parts.push(current);
    }
    const seen = new Set();
    const uniqueParts = [];
    for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed === "") continue;
        // Extract key: everything before the first colon that is outside quotes.
        const colonIndex = trimmed.indexOf(":");
        if (colonIndex === -1) {
            uniqueParts.push(trimmed);
            continue;
        }
        let keyPart = trimmed.substring(0, colonIndex).trim();
        // Remove surrounding quotes if present
        if (
            keyPart.length >= 2 &&
            ((keyPart.startsWith("'") && keyPart.endsWith("'")) ||
                (keyPart.startsWith('"') && keyPart.endsWith('"')))
        ) {
            keyPart = keyPart.substring(1, keyPart.length - 1);
        }
        const key = keyPart;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        uniqueParts.push(trimmed);
    }
    const newInner = uniqueParts.join(", ");
    const newObject = `const ${objectName}: Record<string, string> = {${newInner}};`;
    return content.replace(match[0], newObject);
}

content = deduplicateObject(content, "MARKER_ALIASES");
content = deduplicateObject(content, "UNIT_ALIASES");

fs.writeFileSync(filePath, content, "utf8");
console.log("Deduplication done.");
