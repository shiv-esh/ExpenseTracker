const fs = require('fs');

// Grab API_URL from Vercel environment variables (fallback to empty string if not set)
const apiUrl = process.env.API_URL || '';

const targetPath = './src/environments/environment.prod.ts';

const envConfigFile = `export const environment = {
  production: true,
  apiUrl: '${apiUrl}'
};
`;

console.log(`🔄 Generating environment.prod.ts with API_URL: "${apiUrl}"`);
fs.writeFileSync(targetPath, envConfigFile, { encoding: 'utf8' });
console.log(`✅ environment.prod.ts successfully generated.`);
