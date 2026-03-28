const fs = require('fs');
const targetPath = './src/environments/environment.ts';
const envConfigFile = `export const environment = {
  production: true,
  encryptionKey: '${process.env.ENCRYPTION_KEY || 'AQUI_TU_CLAVE_SECRETA_PRODUCCION'}'
};
`;

fs.mkdirSync('./src/environments', { recursive: true });
fs.writeFileSync(targetPath, envConfigFile);
console.log(`Output generated at ${targetPath}`);
