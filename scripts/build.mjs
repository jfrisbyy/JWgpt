// Builds the Cloudflare Worker at dist/server/index.js.
// Default: a single self-contained Worker (assets and the semantic index are inlined), used by the tests.
// `--external-assets` (npm run build:cloudflare): assets are copied to dist/public for Workers Static Assets
// and the semantic index is read from R2 (key semantic.json.gz), which keeps the Worker bundle small.
import fs from 'node:fs';
import {buildCalendar} from './calendar-library.mjs';
const external=process.argv.includes('--external-assets');
const read=file=>fs.readFileSync(file,'utf8');
const publicationCatalog=JSON.parse(read('data/catalog.json'));
const calendarParserSource=read('scripts/calendar-library.mjs').replace(/^import .*;\n/gm,'').replace(/^const load=.*;\n/m,'').replace("export function buildCalendar(){const catalog=JSON.parse(fs.readFileSync('data/catalog.json'));","return async function(catalog,documents){const load=id=>documents[id];").replace("crypto.createHash('sha256').update(text).digest('hex').slice(0,16)","(await digestText(text)).slice(0,16)");
const calendarParser='const calendarFromImportedDocuments=(()=>{'+calendarParserSource+'})();';
const refGroups=read('public/scriptures.js').match(/const groups=(\[[^\n]+\]);/)[1];
const librarySource=[
 read('server/accounts.mjs'),read('server/auth.mjs'),
 'const libraryCalendar='+JSON.stringify(buildCalendar())+';',read('server/studies.mjs'),
 'const bibleReferenceGroups='+refGroups+';','const publicationCatalog='+JSON.stringify(publicationCatalog)+';',read('server/reader.mjs'),
 'const packedSemantic='+(external?'null':JSON.stringify(fs.readFileSync('data/semantic.json.gz').toString('base64')))+';',read('server/search.mjs'),
 read('server/publications.mjs'),read('server/calendar.mjs'),read('server/personal.mjs'),read('server/learning.mjs'),read('server/family-sessions.mjs'),
 calendarParser,read('server/reliability.mjs')
].join('\n');
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',png:'image/png',webp:'image/webp',jpg:'image/jpeg'};
const assets={};if(!external)for(const name of fs.readdirSync('public')){const bytes=fs.readFileSync('public/'+name);assets['/'+name]={type:types[name.split('.').at(-1)]||'application/octet-stream',data:bytes.toString('base64')}}
const corpus=read('server/sources/finn_persona_and_voice.md');
const retrieval=read('server/source-test.mjs').replaceAll('export ','');
const source='const testSourceText='+JSON.stringify(corpus)+';\n'+retrieval+'\n'+read('server/guided.mjs')+'\n'+read('server/api.mjs').replace('export async function handleAPI','async function handleAPI');

// Security headers for every page and file. Inline scripts are not allowed; images may come from https sources used by publications.
const securityHeaders={
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self'; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
};
const entry=`
const assets=${JSON.stringify(assets)};
const securityHeaders=${JSON.stringify(securityHeaders)};
function secured(response){const r=new Response(response.body,response);for(const [k,v] of Object.entries(securityHeaders))if(!r.headers.has(k))r.headers.set(k,v);return r}
async function route(request,env,url){
 if(url.pathname.startsWith('/api/auth/'))return await authAPI(request,env);
 if(url.pathname.startsWith('/api/account')||url.pathname.startsWith('/api/family/'))return await familyAPI(request,env);
 if(url.pathname.startsWith('/api/')&&url.pathname!=='/api/library-import'){const denied=await familyGate(request,env);if(denied)return denied;await ensureLibraryOverrides(env);}
 if(url.pathname.startsWith('/api/personal/'))return await personalAPI(request,env);
 if(url.pathname==='/api/learning')return await learningAPI(request,env);
 if(url.pathname.startsWith('/api/family-sessions'))return await familySessionAPI(request,env);
 if(url.pathname.startsWith('/api/reliability/'))return await reliabilityAPI(request,env);
 if(url.pathname==='/api/records')return await recordsAPI(request,env);
 if(url.pathname==='/api/reference')return await referenceAPI(request,env);
 if(url.pathname==='/api/search')return await searchEverything(request,env);
 if(url.pathname.startsWith('/api/shares'))return await sharingAPI(request,env);
 if(url.pathname.startsWith('/api/studies'))return await studiesAPI(request,env);
 if(url.pathname.startsWith('/api/calendar/'))return await calendarAPI(request,env);
 if(url.pathname==='/api/study-answers')return await studyAnswers(request,env);
 if(url.pathname.startsWith('/api/library-image/'))return libraryImage(request,env);
 if(url.pathname==='/api/library-import')return importLibrary(request,env);
 if(url.pathname.startsWith('/api/library-file/'))return libraryFile(request,env);
 if(url.pathname.startsWith('/api/publications')||url.pathname==='/api/bible')return await publicationAPI(request,env);
 if(url.pathname==='/api/test-source')return handleTestSource(request);
 if(url.pathname==='/api/guided-study')return await guidedAPI(request,env);
 if(url.pathname==='/api/chat')return await handleAPI(request,env);
 if(url.pathname.startsWith('/api/'))return json({error:'Not found.'},404);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 if(env.ASSETS)return env.ASSETS.fetch(request);
 const asset=assets[url.pathname==='/'?'/index.html':url.pathname];if(!asset)return new Response('Not found',{status:404});
 return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0)),{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache'}});
}
export default {async fetch(request,env){
 try{
  const url=new URL(request.url);
  // Identity only ever comes from a verified session cookie; client-sent identity headers are discarded.
  request=withIdentity(request,url.pathname.startsWith('/api/')?await authenticate(request,env):null);
  return secured(await route(request,env,url));
 }catch(error){
  if(error instanceof RequestError)return secured(json({error:error.message},error.status));
  console.error('Request failed',error.stack||error.message);
  return secured(json({error:'Something went wrong on the server. Please try again.'},500));
 }
}};`;
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist/server',{recursive:true});fs.mkdirSync('dist/.openai',{recursive:true});
fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');fs.cpSync('drizzle','dist/drizzle',{recursive:true});
if(external)fs.cpSync('public','dist/public',{recursive:true});
fs.writeFileSync('dist/server/index.js',librarySource+'\n'+source+'\n'+entry);
