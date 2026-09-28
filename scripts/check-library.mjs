import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Readable} from 'node:stream';
const {default:worker}=await import('../dist/server/index.js');
import {testEnvironment,request} from './check-studies.mjs';
const env=testEnvironment();
async function get(path){const r=await worker.fetch(request(path),env);assert.equal(r.status,200,path);return r.json()}
const catalog=await get('/api/publications');assert.equal(catalog.publications.length,231);
const books=await get('/api/bible');assert.equal(books.books.length,66);assert.equal(books.books[38].name,'MALACHI');assert.equal(books.books[39].name,'MATTHEW');
const john=await get('/api/bible?book=JOHN&chapter=3');assert.match(john.verses['16'].text,/God loved the world/);
const article=await get('/api/publications/w_E_202607?read=1&page=14');assert.equal(article.pages[0].number,14);assert(article.pages.every(p=>p.number<20));assert.equal(article.nextPage,20);assert(article.pages[0].blocks.some(b=>b.type==='h2'&&b.text.includes('Know Jehovah Better')));assert(article.pages[0].blocks.filter(b=>b.type==='p').length>2);
const old=await get('/api/publications/es26_E?page=97');assert(old.page.text.includes('Wednesday, September 23'));
assert(!article.pages[0].blocks.some(b=>b.text.includes('\n')));
console.log('Library verified: 231 sources, Bible book boundaries, verse text, section navigation, paragraph blocks, and legacy citations.');
