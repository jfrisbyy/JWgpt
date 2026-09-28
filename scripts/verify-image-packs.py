import gzip,json,pathlib,hashlib
root=pathlib.Path(__file__).resolve().parents[1]/'data';manifest=[]
for meta in json.load(open(root/'catalog.json')):
 doc=json.load(gzip.open(root/'publications'/(meta['id']+'.json.gz')));assert doc.get('readerVersion')==4,meta['id'];cache={};seen=set();count=questions=0
 for pg in doc['pages']:
  for b in pg['blocks']:
   if b['type']=='image':
    part=b['pack']
    if part not in cache:cache[part]=(root/'images'/(meta['id']+'-'+str(part)+'.pack')).read_bytes()
    payload=cache[part][b['offset']:b['offset']+b['length']]
    assert payload[:4]==b'RIFF' and len(payload)==b['length'] and hashlib.sha256(payload).hexdigest()[:12]==b['digest'],(meta['id'],b['imageId']);count+=1
   elif b['type']=='question':assert b['questionId'] not in seen,(meta['id'],b['questionId']);seen.add(b['questionId']);questions+=1
 manifest.append({'id':meta['id'],'pages':len(doc['pages']),'images':count,'questions':questions,'bytes':sum(len(b) for b in cache.values())})
(root/'immersive-manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps({'publications':len(manifest),'images':sum(m['images'] for m in manifest),'questions':sum(m['questions'] for m in manifest)}))
