import vm from 'node:vm';import fs from 'node:fs';import assert from 'node:assert/strict';import {Readable} from 'node:stream';
import {testEnvironment,request} from './check-studies.mjs';
const {default:worker}=await import('../dist/server/index.js');const env=testEnvironment();
const elements=new Map();function el(k){if(!elements.has(k))elements.set(k,{innerHTML:'',value:k==='#publication-sort'?'title':'',textContent:'',addEventListener(){},scrollIntoView(){}});return elements.get(k)}
const context={console,URL,Date,Number,String,Map,Set,encodeURIComponent,decodeURIComponent,location:{hash:'#publications'},document:{querySelector:el,querySelectorAll:()=>[]},fetch:u=>worker.fetch(request(u),env),esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),source(){},route(){},closeSource(){},CSS:{escape:s=>s},toast(){},readJSON:r=>r.json()};context.window=context;context.scrollTo=()=>{};context.addEventListener=()=>{};vm.createContext(context);vm.runInContext(fs.readFileSync('public/publications.js','utf8'),context);
await context.renderPublications();assert(el('#page').innerHTML.includes('collection-grid'));assert(!el('#publication-catalog').innerHTML.includes('#publication/nwt'));
context.location.hash='#publications/watchtower';await context.renderPublications();assert(el('#page').innerHTML.includes('Study Edition'));assert(el('#publication-catalog').innerHTML.includes('The Watchtower'));
context.location.hash='#bible';await context.renderPublications();assert.equal((el('#page').innerHTML.match(/data-book=/g)||[]).length,66);assert(el('#page').innerHTML.includes('Christian Greek Scriptures'));
context.location.hash='#bible/JOHN';await context.renderPublications();assert.equal((el('#page').innerHTML.match(/href="#bible\/JOHN\//g)||[]).length,21);
context.location.hash='#bible/JOHN/3/16';await context.renderPublications();assert(el('#page').innerHTML.includes('id="verse-16" class="verse-selected"'));
context.location.hash='#publication/w_E_202607/14';await context.renderPublications();assert(el('#page').innerHTML.includes('continuous-reading'));assert(el('#page').innerHTML.includes('data-source-page="14"'));assert(el('#page').innerHTML.includes('id="read-more"'));
console.log('UI routes verified: collections, Bible separation, 66 books, chapter picker, verse links, continuous reader.');
