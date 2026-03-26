const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

console.log('Generating 2048-bit RSA key pair...');
const keys = forge.pki.rsa.generateKeyPair(2048);

console.log('Creating self-signed certificate...');
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10); // 10 years

const attrs = [
  { name: 'commonName', value: 'servio-pos' },
  { name: 'countryName', value: 'AZ' },
  { shortName: 'ST', value: 'Baku' },
  { name: 'localityName', value: 'Baku' },
  { name: 'organizationName', value: 'Servio POS' },
  { shortName: 'OU', value: 'Local Dev' }
];
cert.setSubject(attrs);
cert.setIssuer(attrs);

// Self-sign certificate
cert.sign(keys.privateKey, forge.md.sha256.create());

// Export keys in PEM format
const pemCert = forge.pki.certificateToPem(cert);
const pemKey = forge.pki.privateKeyToPem(keys.privateKey);

// Write files
const keyPath = path.join(__dirname, 'qz-key.pem');
const certPath = path.join(__dirname, '..', 'frontend', 'public', 'qz-cert.pem');

fs.writeFileSync(keyPath, pemKey);
console.log('Private key written to:', keyPath);

fs.writeFileSync(certPath, pemCert);
console.log('Public certificate written to:', certPath);

console.log('Done.');
