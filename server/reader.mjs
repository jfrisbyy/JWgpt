// Restore continuous article reading without changing stored source pages, image offsets,
// or the identifiers that own existing personal answers.
async function normalizeReader(doc){
 if(!/^w.*_E_\d{6}$/.test(doc.publication?.id||''))return doc;
 const pages=doc.pages.map(p=>({...p,blocks:(p.blocks||[]).map(b=>({...b,sourcePage:p.number}))}));
 const start=[];for(let i=0;i<pages.length;i++)if(pages[i].blocks.some(b=>b.text==='FOCUS'))start.push(i);
 for(const at of start){const next=(doc.contents||[]).find(c=>c.page>at+1)?.page||pages.length+1,end=Math.min(next-1,pages.length);let paragraph=null,heading=null,review=false;
  const first=pages[at].blocks,focus=first.findIndex(b=>b.text==='FOCUS');
  const title=first.find(b=>b.type==='h2');if(title)title.role='article-title';
  let date=false,song=false;
  for(let i=0;i<=focus+1&&i<first.length;i++){const b=first[i];if(b===title||b.type==='image')continue;if(/^\w+ \d{1,2}.*20\d{2}$/.test(b.text||'')){b.role='study-date';date=true}else if(/^SONG \d+/.test(b.text||'')){b.role='song';song=true}else if(b.text==='FOCUS'){b.role='focus-label';song=false}else if(i===focus+1)b.role='focus';else if(song)b.role='song-title';else if(!date)b.role='theme';}
  // A theme verse may be split into multiple PDF text blocks.
  for(let i=1;i<first.length;i++)if(first[i].role==='theme'&&first[i-1].role==='theme'){first[i-1].text+=' '+first[i].text;first.splice(i--,1)}
  const questions=[];let tail=null;
  for(let pi=at;pi<end;pi++){
   const out=[];for(const block of pages[pi].blocks){let b=block;
    if(b.type==='h2'&&/HOW WOULD YOU ANSWER|HOW WOULD YOU RESPOND|WHAT HAVE YOU LEARNED/.test(b.text||''))review=true;if(/^SONG \d+/.test(b.text||'')){b.role='song';review=false;}
    if(b.role){out.push(b);paragraph=null;heading=null;tail=b;continue;}
    // Numbered prompts such as “Illustrate why…” are questions even without “?”.
    if(['p','aside'].includes(b.type)&&(/^\d{1,2}(?:[-–]\d{1,2})?\.\s/.test(b.text||'')||(review&&/\?/.test(b.text||'')))&&b.text.length<1100){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(b.text));b={...b,type:'question',questionId:'q'+b.sourcePage+'-'+Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('').slice(0,16)};}
    if(b.type==='question'){const number=b.text.match(/^(\d+)(?:[-–](\d+))?\./);if(number)questions.push({block:b,number:+(number[2]||number[1]),originalPage:pi});else out.push(b);heading=null;continue;}
    const allCaps=['p','h2'].includes(b.type)&&b.text?.length<180&&/[A-Z]{3}/.test(b.text)&&!/[a-z]/.test(b.text)&&!/^SONG \d/.test(b.text);
    if(allCaps){b.type='h2';if(heading){heading.text+=' '+b.text;continue}heading=b;paragraph=null;out.push(b);tail=b;continue;}
    if(b.type==='h2'){paragraph=null;heading=null;out.push(b);tail=b;continue;}
    if(b.type==='p'){
     heading=null;const n=b.text.match(/^(\d{1,2})\s+[A-Z“‘]/);if(n){b.paragraph=+n[1];paragraph=b;}
     else if(paragraph){const join=/-$/.test(paragraph.text)&&/^[a-z]/.test(b.text)?'':' ';paragraph.text=(join?paragraph.text:paragraph.text.replace(/-$/,''))+join+b.text;paragraph.endPage=b.sourcePage;continue;}
     else if(pi===at&&out.some(x=>x.role==='focus')){b.paragraph=1;paragraph=b;}
    }
    out.push(b);tail=b;
   }pages[pi].blocks=out;
  }
  // Questions follow the complete paragraph, including any continuation across a column/page.
  for(const {block,number,originalPage} of questions){let target;for(let pi=at;pi<end;pi++){const i=pages[pi].blocks.findIndex(b=>b.paragraph===number);if(i>=0){target={pi,i};break}}if(target){const blocks=pages[target.pi].blocks;let pos=target.i+1;while(blocks[pos]?.type==='question')pos++;blocks.splice(pos,0,block)}else pages[originalPage].blocks.push(block);}
  // Attach detached picture captions, including captions split into short lines.
  for(let pi=at;pi<end;pi++){const blocks=pages[pi].blocks;for(let i=0;i<blocks.length;i++){if(blocks[i].type!=='aside')continue;let j=i;while(blocks[j+1]?.type==='aside'&&blocks.slice(i,j+2).map(x=>x.text).join(' ').length<450&&!/See paragraphs?/.test(blocks[j].text||''))j++;const caption=blocks.slice(i,j+1).map(x=>x.text).join(' ');if(!/\(See paragraphs? [\d, -]+\)/.test(caption)||caption.length>450)continue;const image=blocks.find(b=>b.type==='image'&&!b.caption);if(image){image.caption=caption;blocks.splice(i,j-i+1);i--;}}}
 }
 return {...doc,pages,readerVersion:5};
}

function readerStartPage(doc,page){const p=doc.pages[page-1];if(doc.readerVersion!==5)return p;const carry=[];for(const previous of doc.pages.slice(0,page-1))for(let i=0;i<previous.blocks.length;i++){const b=previous.blocks[i];if(b.endPage>=page){carry.push(b);if(previous.blocks[i+1]?.type==='question')carry.push(previous.blocks[i+1]);}}return carry.length?{...p,blocks:[...carry,...p.blocks]}:p}

// Stable addresses derive from source page + normalized text, independent of display order.
async function anchorReader(doc){for(const page of doc.pages){const seen=new Map();for(const block of page.blocks||[]){block.sourcePage=block.sourcePage||page.number;const value=(block.text||block.imageId||'').replace(/\s+/g,' ').trim();let hash=2166136261;for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);const key=block.questionId||'p'+block.sourcePage+'-'+(hash>>>0).toString(16);const n=seen.get(key)||0;seen.set(key,n+1);block.anchor=key+(n?'-'+n:'')}}return doc}
function closestPassage(page,intent,model,vector){const candidates=(page.blocks||[]).filter(b=>b.type==='p'&&b.text?.length>80);return candidates.map(b=>{const text=searchNormalize(b.text);let score=0;for(const [term,w] of intent.weights)if((' '+text+' ').includes(' '+term+' '))score+=w;if(model){const v=semanticVector(searchIntent(b.text),model);score=score*2+Math.max(0,vector.reduce((sum,x,i)=>sum+x*v[i],0))*4}return {b,score}}).sort((a,b)=>b.score-a.score)[0]?.b||null}
