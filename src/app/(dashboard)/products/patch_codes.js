const fs = require('fs');
const files = [
    'c:\\projects\\pos 43\\pos all in one\\kaideeder\\src\\app\\(dashboard)\\products\\page.tsx',
    'c:\\projects\\pos 43\\pos all in one\\kaideeder\\src\\app\\(dashboard)\\menu\\page.tsx',
    'c:\\projects\\pos 43\\pos all in one\\kaideeder\\src\\components\\SidebarContext.tsx',
    'c:\\projects\\pos 43\\pos all in one\\kaideeder\\src\\components\\Sidebar.tsx' // If relevant
];

for (const p of files) {
    if (fs.existsSync(p)) {
        let content = fs.readFileSync(p, 'utf8');
        // Simple replace for known RAW_CODES declarations
        if (content.includes("'RAW_MEAT', 'RAW_PORK', 'RAW_SEA'")) {
            content = content.replace(/'RAW_MEAT',\s*'RAW_PORK',\s*'RAW_SEA'/g, "'RAW_MEAT', 'RAW_PORK', 'RAW_POULTRY', 'RAW_SEA'");
            fs.writeFileSync(p, content, 'utf8');
            console.log(`Updated RAW_CODES in ${p}`);
        } else {
             // Let's try matching broader pattern just in case
             const rx = /'RAW_MEAT',\s*'RAW_PORK',\s*'RAW_SEA'/g;
             if (content.match(rx)) {
                 content = content.replace(rx, "'RAW_MEAT', 'RAW_PORK', 'RAW_POULTRY', 'RAW_SEA'");
                 fs.writeFileSync(p, content, 'utf8');
                 console.log(`Regex Updated RAW_CODES in ${p}`);
             } else {
                 console.log(`No match for RAW_CODES found in ${p}`);
             }
        }
    }
}
