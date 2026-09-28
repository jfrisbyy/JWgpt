// Restores the collapsed sidebar before first paint (kept out of index.html so the Content-Security-Policy can forbid inline scripts).
try{document.documentElement.classList.toggle("nav-collapsed",localStorage.getItem("petey_nav_collapsed")==="true")}catch{}
