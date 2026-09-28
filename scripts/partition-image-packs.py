import pathlib,gzip,json,hashlib
root=pathlib.Path(__file__).resolve().parents[1]/'data'
for meta in json.load(open(root/'catalog.json')):
 path=root/'publications'/(meta['id']+'.json.gz');doc=json.load(gzip.open(path))
 if doc.get('readerVersion')==4 or meta['id']=='gt_E':continue
 old=(root/'images'/(meta['id']+'.pack')).read_bytes();chunks=[bytearray()]
 for pg in doc['pages']:
  for fig in pg['blocks']:
   if fig['type']!='image':continue
   payload=old[fig['offset']:fig['offset']+fig['length']]
   assert len(payload)==fig['length'] and hashlib.sha256(payload).hexdigest()[:12]==fig['digest'],meta['id']
   if len(chunks[-1])+len(payload)>16*1024*1024:chunks.append(bytearray())
   fig['pack']=len(chunks)-1;fig['offset']=len(chunks[-1]);chunks[-1].extend(payload)
 for part,chunk in enumerate(chunks):(root/'images'/(meta['id']+'-'+str(part)+'.pack')).write_bytes(chunk)
 doc['readerVersion']=4;path.write_bytes(gzip.compress(json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
print('Partitioned all completed image collections')
