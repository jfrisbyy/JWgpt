// Parses every browser and server source file so syntax errors fail fast, before the slower functional suite.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const files=[...fs.readdirSync('public').filter(f=>f.endsWith('.js')).map(f=>'public/'+f),...fs.readdirSync('server').filter(f=>f.endsWith('.mjs')).map(f=>'server/'+f),...fs.readdirSync('scripts').filter(f=>f.endsWith('.mjs')).map(f=>'scripts/'+f)];
for(const file of files)execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
console.log('Syntax verified: '+files.length+' files.');
