const documentCache=new Map();let biblePromise;
async function unpackObject(key,env){const object=await env.BUCKET?.get(key);if(!object)throw Error('Publication import is not ready. Please try again shortly.');return JSON.parse(await new Response(object.body.pipeThrough(new DecompressionStream('gzip'))).text())}
async function publication(id,env){if(!publicationCatalog.some(p=>p.id===id))return null;if(!documentCache.has(id)){if(documentCache.size>=6)documentCache.delete(documentCache.keys().next().value);documentCache.set(id,unpackObject(libraryOverrides.find(r=>r.meta.id===id)?.key||'publications/'+id+'.json.gz',env).then(normalizeReader).then(anchorReader).catch(error=>{documentCache.delete(id);throw error}));}return documentCache.get(id)}
function referenceURL(id,page,origin,anchor){return origin+'/#publication/'+encodeURIComponent(id)+'/'+page+(anchor?'?anchor='+encodeURIComponent(anchor):'')}
const ignoredTerms=new Set('the and that this with from have your what when where which does about explain help please could would should more into their they them were will why how can you are for not but his her our all has was had its who scripture scriptures bible jehovah'.split(' '));
async function publicationAPI(request,env){
 const u=new URL(request.url);if(request.method!=='GET')return json({error:'Use GET.'},405);
 if(u.pathname==='/api/publications'){if(u.searchParams.has('q'))return json({results:await retrievePublications(u.searchParams.get('q').slice(0,2000),u.origin,env,12)});return json({publications:publicationCatalog})}
 if(u.pathname==='/api/bible'){const bible=await(biblePromise??=unpackObject('bible.json.gz',env).catch(error=>{biblePromise=null;throw error}));const book=u.searchParams.get('book'),chapter=u.searchParams.get('chapter');if(!book)return json({books:Object.entries(bible).map(([name,chapters])=>({name,chapters:Object.keys(chapters).map(Number)}))});const verses=bible[book]?.[chapter];return verses?json({book,chapter,verses,source:'New World Translation of the Holy Scriptures',publicationId:'nwt_E'}):json({error:'This chapter could not be extracted reliably. Open the Bible publication to read its original page.'},404)}
 const id=decodeURIComponent(u.pathname.split('/').at(-1));const doc=await publication(id,env);if(!doc)return json({error:'Publication not found.'},404);const page=+(u.searchParams.get('page')||1);if(!Number.isInteger(page)||page<1||page>doc.pages.length)return json({error:'Page not found.'},404);if(u.searchParams.has('read')){const sections=doc.contents||[];const next=sections.find(s=>s.page>page);const end=Math.min(next?next.page-1:doc.pages.length,page+19);return json({publication:publicationCatalog.find(p=>p.id===id),contents:sections,contentsType:doc.contentsType,pages:[readerStartPage(doc,page),...doc.pages.slice(page,end)],nextPage:end<doc.pages.length?end+1:null});}return json({publication:doc.publication,contents:doc.contents,page:readerStartPage(doc,page)});
}

async function importLibrary(request,env){
 if(request.method!=='PUT'||!env.LIBRARY_IMPORT_KEY||request.headers.get('X-Import-Key')!==env.LIBRARY_IMPORT_KEY)return json({error:'Not authorized.'},403);
 const key=new URL(request.url).searchParams.get('key')||'';
 if(!/^(?:publications\/[a-zA-Z0-9_-]+\.json\.gz|pdf\/[a-zA-Z0-9_-]+\.pdf|search-index\.json\.gz|search\/[a-z]\.json\.gz|bible\.json\.gz|images\/[a-zA-Z0-9_-]+\.pack)$/.test(key))return json({error:'Invalid import target.'},400);
 if(key.startsWith('publications/'))return json({error:'Use the validated library import in Settings → Library health so questions, images, and search indexes remain consistent.'},409);await env.BUCKET.put(key,request.body);documentCache.clear();biblePromise=null;bibleLexPromise=null;return json({saved:key});
}
async function libraryFile(request,env){
 if(!['GET','HEAD'].includes(request.method))return json({error:'Use GET.'},405);
 const name=decodeURIComponent(new URL(request.url).pathname.split('/').at(-1));if(!publicationCatalog.some(p=>p.filename===name))return json({error:'Not found.'},404);
 const obj=await env.BUCKET.get('pdf/'+name,{range:request.headers});if(!obj)return json({error:'Original PDF is not available yet.'},404);
 const headers={'Content-Type':'application/pdf','Content-Disposition':'inline','Accept-Ranges':'bytes','Cache-Control':'private, max-age=3600'};
 if(obj.range){headers['Content-Range']=`bytes ${obj.range.offset}-${obj.range.offset+obj.range.length-1}/${obj.size}`;headers['Content-Length']=String(obj.range.length)}else headers['Content-Length']=String(obj.size);
 return new Response(request.method==='HEAD'?null:obj.body,{status:obj.range?206:200,headers});
}

async function retrieveScriptures(query,origin,env){
 const aliases=new Map();for(const group of bibleReferenceGroups){const names=group.split('|');for(const n of names)aliases.set(n.toLowerCase().replace(/\s/g,''),names[0].toUpperCase())}
 const patterns=[...aliases.keys()].sort((a,b)=>b.length-a.length).map(n=>n.replace(/([1-3])(?=[a-z])/,'$1\\s*').replace('songofsolomon','song\\s+of\\s+solomon'));
 const re=new RegExp('\\b('+patterns.join('|')+')\\.?\\s+(\\d{1,3}):\\s*(\\d{1,3})(?:[-–](\\d{1,3}))?','gi');
 const matches=[...query.matchAll(re)].slice(0,3);if(!matches.length)return [];
 const bible=await(biblePromise??=unpackObject('bible.json.gz',env).catch(error=>{biblePromise=null;throw error}));const results=[];
 for(const m of matches){const book=aliases.get(m[1].toLowerCase().replace(/\s/g,''));const chapter=bible[book]?.[m[2]];if(!chapter)continue;let text='';for(let v=+m[3];v<=Math.min(+(m[4]||m[3]),+m[3]+19);v++)if(chapter[v]?.text)text+=v+' '+chapter[v].text+'\n';if(text)results.push({marker:'B'+(results.length+1),title:'New World Translation · '+book+' '+m[2]+':'+m[3],text,url:origin+'/#bible/'+encodeURIComponent(book)+'/'+m[2]+'/'+m[3]})}
 return results;
}

async function libraryImage(request,env){
 if(!['GET','HEAD'].includes(request.method))return json({error:'Use GET.'},405);
 const match=new URL(request.url).pathname.match(/^\/api\/library-image\/([\w-]+)\/(\d+)-(\d+)\.webp$/);if(!match)return json({error:'Image not found.'},404);
 const doc=await publication(match[1],env);const figure=doc?.pages[+match[2]-1]?.blocks?.find(b=>b.type==='image'&&b.imageId===match[2]+'-'+match[3]);if(!figure)return json({error:'Image not found.'},404);
 const object=await env.BUCKET.get('images/'+match[1]+(Number.isInteger(figure.pack)?'-'+figure.pack:'')+'.pack',{range:{offset:figure.offset,length:figure.length}});if(!object)return json({error:'Image is not available yet.'},404);
 return new Response(request.method==='HEAD'?null:object.body,{headers:{'Content-Type':'image/webp','Content-Length':String(figure.length),'Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff'}});
}
async function indexStudyAnswers(user,id,answers,env){const meta=publicationCatalog.find(p=>p.id===id),items=Object.entries(answers);if(!items.length)return;const doc=meta?await publication(id,env):null;await studyDB(env).batch(items.map(([qid,a])=>{const page=doc?.pages.find(p=>p.blocks.some(b=>b.questionId===qid))?.number||+(qid.match(/^q(\d+)/)?.[1]||1),record={title:(meta?.title||'Study answer')+' · my answer',text:a.text,url:meta?'#publication/'+id+'/'+page+'?anchor='+qid:'https://wol.jw.org/en/wol/d/r1/lp-e/'+id.slice(4)};return studyDB(env).prepare("INSERT INTO personal_records(owner,kind,id,document,version,updated_at) VALUES (?,'answer',?,?,1,?) ON CONFLICT(owner,kind,id) DO UPDATE SET document=excluded.document,version=personal_records.version+1,updated_at=excluded.updated_at WHERE personal_records.document!=excluded.document").bind(user,id+'/'+qid,JSON.stringify(record),a.updatedAt||new Date().toISOString())}))}
async function studyAnswers(request,env){
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return json({error:'Sign in to save private study answers.'},401);
 const u=new URL(request.url),id=u.searchParams.get('publication');if(!publicationCatalog.some(p=>p.id===id)&&!/^wol-\d{9}$/.test(id||''))return json({error:'Publication not found.'},404);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user));const owner=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 const prefix='answers/'+owner+'/'+id+'/';const valid=q=>/^q\d+-[a-f0-9]{16}$/.test(q);
 if(request.method==='GET'){
  const ids=(u.searchParams.get('questions')||'').split(',').filter(Boolean);if(ids.length>100||!ids.every(valid))return json({error:'Invalid questions.'},400);
  const answers={};await Promise.all(ids.map(async q=>{const obj=await env.BUCKET.get(prefix+q+'.json');if(obj)answers[q]=await obj.json()}));await indexStudyAnswers(user,id,answers,env);return json({answers});
 }
 if(request.method!=='PUT')return json({error:'Use GET or PUT.'},405);
 if(request.headers.get('Origin')!==u.origin)return json({error:'Invalid origin.'},403);
 const raw=await request.text();if(raw.length>25000)return json({error:'Please keep answers under 20,000 characters.'},413);
 let data;try{data=JSON.parse(raw)}catch{return json({error:'Invalid answer.'},400)}
 if(!valid(data.questionId)||typeof data.text!=='string'||data.text.length>20000)return json({error:'Invalid answer.'},400);
 if(id.startsWith('wol-')){const doc=await calendarWorkbookDocument(id.slice(4),env);if(!doc.questions.includes(data.questionId))return json({error:'Question not found.'},404)}else{const doc=await publication(id,env);const page=+data.questionId.match(/^q(\d+)/)[1];if(!doc.pages.some(p=>p.blocks?.some(b=>b.questionId===data.questionId))&&!Object.values(libraryCalendar.meetings).some(w=>w.id===id&&w.questions.includes(data.questionId)))return json({error:'Question not found.'},404);}
 const answer={text:data.text,updatedAt:new Date().toISOString()};await env.BUCKET.put(prefix+data.questionId+'.json',JSON.stringify(answer),{httpMetadata:{contentType:'application/json'}});await indexStudyAnswers(user,id,{[data.questionId]:answer},env);return json({saved:true,...answer});
}
