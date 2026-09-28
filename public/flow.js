(()=>{
const fields=new WeakSet();
function sync(field){if(!field?.isConnected)return;const editing=document.activeElement===field;field.classList.toggle('flow-editing',editing);field.classList.toggle('flow-filled',!!field.value.trim());const previous=field.style.height;field.style.height='0px';const content=field.scrollHeight;field.style.height=previous;const heading=field.classList.contains('heading-input');const height=heading?Math.max(54,Math.min(150,content)):editing?Math.max(field.dataset.expanded==='true'?280:112,Math.min(380,content+6)):field.value.trim()?80:52;field.style.height=height+'px';field.style.overflowY=editing&&content>380?'auto':'hidden';if(!editing)field.scrollTop=0;}
function enhance(root){if(!root?.querySelectorAll)return;for(const f of root.querySelectorAll('textarea')){if(fields.has(f))continue;fields.add(f);f.classList.add('flow-field');f.rows=1;f.addEventListener('focus',()=>sync(f));f.addEventListener('input',()=>sync(f));f.addEventListener('blur',()=>{f.dataset.expanded='false';const toggle=f.closest('.study-question')?.querySelector('.answer-expand');if(toggle){toggle.textContent='Expand';toggle.setAttribute('aria-expanded','false')}sync(f)});sync(f)}
const companion=root.querySelector('.study-companion'),paper=root.querySelector('.study-paper');if(companion&&paper&&!paper.contains(companion))paper.insertBefore(companion,paper.querySelector('.study-takeaway'));
for(const el of root.querySelectorAll('.study-outline details,.book-contents>details:first-child')){if(!el.dataset.flowDetails){el.dataset.flowDetails='true';el.open=false}}
}
window.PeteyFields={sync,enhance};
const observer=new MutationObserver(records=>{for(const r of records)if(r.type==='attributes'&&r.target.tagName==='TEXTAREA')sync(r.target);enhance(document)});
observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});enhance(document);
window.addEventListener('resize',()=>document.querySelectorAll('textarea.flow-field').forEach(sync));
window.addEventListener('hashchange',()=>{const page=document.querySelector('#page');page?.classList.remove('flow-arrive');requestAnimationFrame(()=>page?.classList.add('flow-arrive'))});
})();
