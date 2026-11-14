#!/usr/bin/env node
// `expo prebuild` sonrası çalışır: ana uygulama hedefini (PRODUCT_BUNDLE_IDENTIFIER = BUNDLE_ID olan
// yapılandırmalar) manuel imzalamaya çevirir ve ExportOptions.plist üretir. Pod hedeflerine dokunmaz.
// Ortam: TEAM_ID, BUNDLE_ID, PROFILE_NAME, PROFILE_UUID.
const fs = require('fs');
const path = require('path');

const need = (k) => {
  const v = (process.env[k] || '').trim();
  if (!v) throw new Error(`${k} boş`);
  return v;
};
const TEAM_ID = need('TEAM_ID');
const BUNDLE_ID = need('BUNDLE_ID');
const PROFILE_NAME = need('PROFILE_NAME');
const PROFILE_UUID = need('PROFILE_UUID');

const iosDir = path.join(__dirname, '..', 'ios');
const proj = fs.readdirSync(iosDir).find((f) => f.endsWith('.xcodeproj'));
if (!proj) throw new Error('ios/*.xcodeproj bulunamadı (önce expo prebuild çalışmalı)');
const pbxPath = path.join(iosDir, proj, 'project.pbxproj');
let pbx = fs.readFileSync(pbxPath, 'utf8');

let patched = 0;
pbx = pbx.replace(/(buildSettings = \{)([\s\S]*?)(\n\t+\};)/g, (m, open, body, close) => {
  if (!body.includes(`PRODUCT_BUNDLE_IDENTIFIER = ${BUNDLE_ID};`) && !body.includes(`PRODUCT_BUNDLE_IDENTIFIER = "${BUNDLE_ID}";`)) {
    return m;
  }
  let s = body
    .replace(/\n\s*DEVELOPMENT_TEAM = [^;]*;/g, '')
    .replace(/\n\s*CODE_SIGN_STYLE = [^;]*;/g, '')
    .replace(/\n\s*"?CODE_SIGN_IDENTITY(\[sdk=[^\]]+\])?"? = [^;]*;/g, '')
    .replace(/\n\s*PROVISIONING_PROFILE(_SPECIFIER)? = [^;]*;/g, '');
  s += `\n\t\t\t\tDEVELOPMENT_TEAM = ${TEAM_ID};`;
  s += `\n\t\t\t\tCODE_SIGN_STYLE = Manual;`;
  s += `\n\t\t\t\tCODE_SIGN_IDENTITY = "Apple Distribution";`;
  s += `\n\t\t\t\t"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "Apple Distribution";`;
  s += `\n\t\t\t\tPROVISIONING_PROFILE = "${PROFILE_UUID}";`;
  s += `\n\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "${PROFILE_NAME}";`;
  patched++;
  return open + s + close;
});
pbx = pbx.replace(/ProvisioningStyle = Automatic;/g, 'ProvisioningStyle = Manual;');
if (patched === 0) throw new Error(`${BUNDLE_ID} kullanan yapılandırma bulunamadı`);
fs.writeFileSync(pbxPath, pbx);
console.log(`✓ ${proj}: ${patched} yapılandırma manuel imzalamaya çevrildi (profil: ${PROFILE_NAME})`);

const exportOptions = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>teamID</key>
  <string>${TEAM_ID}</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>signingCertificate</key>
  <string>Apple Distribution</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>${BUNDLE_ID}</key>
    <string>${PROFILE_NAME}</string>
  </dict>
  <key>uploadSymbols</key>
  <true/>
</dict>
</plist>
`;
fs.mkdirSync(path.join(__dirname, '..', 'build'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'build', 'ExportOptions.plist'), exportOptions);
console.log('✓ build/ExportOptions.plist yazıldı');
