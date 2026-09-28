"""Join questions split into adjacent native PDF text blocks without rewriting words."""
import pathlib,json,gzip,re,hashlib
root=pathlib.Path(__file__).resolve().parents[1]/'data';changed=[];count=0
for meta in json.load(open(root/'catalog.json')):
 path=root/'publications'/(meta['id']+'.json.gz');doc=json.load(gzip.open(path));updates=0
 for page in doc['pages']:
  blocks=page['blocks'];out=[];i=0
  while i<len(blocks):
   b=blocks[i]
   if b['type'] in ['p','aside'] and re.match(r'^(?:\d+(?:[-–]\d+)?\.\s*)?(?:How|What|Why|Who|When|Where|Which|In what|Can you|Do you)\b',b.get('text','')) and '?' not in b['text'] and not re.search(r'[.!:]$',b['text']) and len(b['text'])<250:
    following=[]
    for n in blocks[i+1:i+4]:
     if n['type'] not in ['p','aside'] or len(n.get('text',''))>200:break
     following.append(n)
     if '?' in n['text']:break
    if following and '?' in following[-1]['text']:
     text=' '.join(x['text'] for x in [b]+following);b={'type':'question','text':text,'questionId':f"q{page['number']}-"+hashlib.sha256(text.encode()).hexdigest()[:16]};i+=len(following);updates+=1
   out.append(b);i+=1
  page['blocks']=out
 if updates:
  path.write_bytes(gzip.compress(json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode(),mtime=0));changed.append(meta['id']);count+=updates
(root/'joined-prompts.json').write_text(json.dumps({'publications':changed,'prompts':count}));print(json.dumps({'publications':len(changed),'prompts':count}))
