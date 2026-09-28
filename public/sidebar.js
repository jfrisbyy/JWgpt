(()=>{
const toggle=document.getElementById('sidebar-toggle');
function apply(collapsed){document.documentElement.classList.toggle('nav-collapsed',collapsed);toggle.setAttribute('aria-expanded',String(!collapsed));const label=collapsed?'Expand navigation':'Collapse navigation';toggle.setAttribute('aria-label',label);toggle.title=label;try{localStorage.setItem('petey_nav_collapsed',String(collapsed))}catch{}}
toggle.addEventListener('click',()=>apply(!document.documentElement.classList.contains('nav-collapsed')));
apply(document.documentElement.classList.contains('nav-collapsed'));
function current(){document.querySelectorAll('#nav a').forEach(a=>a.classList.contains('active')?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'))}
window.addEventListener('hashchange',current);current();
})();
