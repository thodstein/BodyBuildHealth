const fs = require('fs');
const path = require('path');

function deduplicateObject(content, objectName) {
    const regex = new RegExp('const\\\\\\\\s+' + objectName + '\\\\\\\\s*:\\\\\\\\s*Record<string,\\\\\\\\s*string>\\\\\\\\s*=\\\\\\\\s*\\\\\\\\{([^}]+)\\\\\\\\};', 's');
    const match = content.match(regex);
    if (!match) {
        console.log('Could not find ' + objectName);
        return content;
    }
    const inner = match[1];
    const parts = inner.split(',').map(p => p.trim()).filter(p => p.length > 0);
    const seen = new Set();
    const uniqueParts = [];
    for (const part of parts) {
        if (part.includes(': ')) {
            const key = part.split(':')[0].trim().replace(/^['"]|['"]$/g, '');
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
        }
        uniqueParts.push(part);
    }
    const newInner = uniqueParts.join(', ');
    const newObject = 'const ' + objectName + ': Record<string, string> = {' + newInner + '};';
    return content.replace(match[0], newObject);
}

function main() {
    const filePath = path.join(__dirname, 'src', 'core', 'lab-auto-parser.ts');
    let content = fs.readFileSync(filePath, 'utf8');
    content = deduplicateObject(content, 'MARKER_ALIASES');
    content = deduplicateObject(content, 'UNIT_ALIASES');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Deduplication done.');
}

main();
