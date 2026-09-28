// This corpus is opt-in test data, never included in ordinary study requests.
export const testSource = {id:'finn-persona-test', title:'Finn: Core Persona & Voice Architecture', filename:'finn_persona_and_voice.md', url:'https://docs.google.com/document/d/1tLZPhDnb_TNtuggES-CmPzh4lQcVvIUU/edit', label:'Test material · Not an official JW publication'};
export function sectionsFrom(text){
 const sections=[];let current;
 for(const line of text.split('\n')){
  if(/^#{1,3} /.test(line)){current={id:'S'+(sections.length+1),heading:line.replace(/^#+ /,'').replace(/\\\./g,'.'),text:''};sections.push(current)}
  else if(current)current.text+=line+'\n';
 }
 return sections.map(s=>({...s,text:s.text.trim()})).filter(s=>s.text);
}
const stop=new Set('what are is the a an of in to and does how me about tell please finn his this it for from'.split(' '));
export function retrieveSource(text,query){
 const terms=[...new Set(query.toLowerCase().match(/[a-z0-9]+/g)||[])].filter(t=>t.length>2&&!stop.has(t));
 if(!terms.length)return [];
 return sectionsFrom(text).map(s=>({...s,score:terms.reduce((n,t)=>n+(s.heading.toLowerCase().includes(t)?5:0)+(s.text.toLowerCase().includes(t)?1:0),0)})).filter(s=>s.score>0).sort((a,b)=>b.score-a.score).slice(0,4);
}
