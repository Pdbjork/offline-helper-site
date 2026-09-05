import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../start/index.html', import.meta.url), 'utf8');

assert.match(html, /id="family-forward-title"/);
assert.match(html, /Helping a parent or loved one\? Send one calm note first\./);
assert.match(html, /id="copy-family-forward"/);
assert.match(html, /id="family-forward-copy"/);
assert.match(html, /utm_source=family_forward&utm_medium=share_copy/);
assert.match(html, /utm_source=start_router&utm_medium=family_forward_button/);
assert.match(html, /No passwords, recovery keys, private files, medical\/legal\/financial details, or crisis details go in chat\./);
assert.match(html, /Paste it into the family text thread/);

console.log('PASS start family-forward share card');
