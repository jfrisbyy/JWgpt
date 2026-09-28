import json,re,unicodedata,hashlib,gzip,pathlib,fitz,collections
ROOT=pathlib.Path(__file__).resolve().parents[1]
import os
# Source PDFs live outside the repository; override with PETEY_PDF_DIR / PETEY_UPLOAD_DIR.
RAW=pathlib.Path(os.environ.get('PETEY_PDF_DIR',ROOT.parent/'publication-pdfs'))
UPLOAD=pathlib.Path(os.environ.get('PETEY_UPLOAD_DIR',ROOT.parent/'upload'))
OUT=ROOT/'data/publications';OUT.mkdir(parents=True,exist_ok=True)
manifest=json.loads((ROOT/'data/import-manifest.json').read_text())
manifest += [{'id':'nwt','filename':'nwt_E.pdf','category':'bible','path':str(UPLOAD/'01-nwt_E.pdf'),'url':None},{'id':'nwt-study','filename':'nwtsty1_E.pdf','category':'bible','path':str(UPLOAD/'01-nwtsty1_E.pdf'),'url':None}]
def clean(s):
 s=unicodedata.normalize('NFKC',s).replace('\x03','ʹ').replace('\x02','ʹ')
 s=re.sub(r'[\x00-\x1f&&[^\n]]','',s) if False else re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]','',s)
 s=re.sub(r'[_]{5,}','',s)
 s=re.sub(r'(\w)-\n(?=[a-z])',r'\1',s)
 return s.strip()
def writegz(path,obj):path.write_bytes(gzip.compress(json.dumps(obj,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
def title_for(f,p):
 name=f['filename'];m=re.search(r'_(20\d{2})(\d{2})\.pdf$',name)
 if m:
  prefix='Meeting Workbook References' if name.startswith('mwbr') else 'Meeting Workbook' if name.startswith('mwb') else 'Our Kingdom Ministry' if name.startswith('km') else 'The Watchtower — Public Edition' if name.startswith('wp') else 'Awake!' if name.startswith('g_') else 'The Watchtower — Study Edition'
  return f'{prefix} · {m[1]}-{m[2]}'
 if re.match(r'es(?:lp)?\d',name):return 'Examining the Scriptures Daily · 20'+re.search(r'\d+',name)[0]
 if name=='wcgr_E.pdf':return 'Walk Courageously With God · References'
 if name.startswith('it-'):return 'Insight on the Scriptures · Volume '+name[3]
 if name.startswith('dx'):return 'Watch Tower Publications Index · '+name.split('_')[0][2:]
 if name.startswith('syr'):return 'Service Year Report · 20'+re.search(r'\d+',name)[0]
 if name.startswith('yb'):return 'Yearbook of Jehovah’s Witnesses · 20'+re.search(r'\d+',name)[0]
 title=(p.metadata.get('title') or '').strip()
 return title if len(title)>12 and not re.search(r'\.indd|\.qxd',title,re.I) else clean(p[0].get_text()).replace('\n',' ')[:150] or name
offset=0
catalog=[];index=collections.defaultdict(list);missing=[]
for f in manifest:
 path=pathlib.Path(f.get('path','')) if f.get('path') else RAW/f['filename']
 if not path.exists():missing.append(f['filename']);continue
 doc=fitz.open(path);key=f['filename'].removesuffix('.pdf');pages=[]
 for i,page in enumerate(doc):
  # Native PDF block order preserves most two-column text flow better than global y-sorting.
  text=clean(page.get_text())
  pages.append({'number':i+1,'label':page.get_label() or str(i+1),'text':text})
  for word in set(re.findall(r'[a-z]{3,}',text.lower())):index[word].append(offset+i)
 item={'offset':offset,'id':key,'title':title_for(f,doc),'filename':f['filename'],'category':f['category'],'pageCount':len(doc),'largePrint':bool(re.search(r'lp',f['filename'])),'year':int(re.search(r'20\d\d',f['filename'])[0]) if re.search(r'20\d\d',f['filename']) else None,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'emptyPages':sum(len(p['text'])<20 for p in pages)}
 toc=[{'level':x[0],'title':x[1],'page':x[2]} for x in doc.get_toc() if 1<=x[2]<=len(doc)]
 writegz(OUT/(key+'.json.gz'),{'publication':item,'pages':pages,'contents':toc});catalog.append(item);offset+=len(doc)
writegz(ROOT/'data/search-index.json.gz',dict(index));(ROOT/'data/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2))
print(json.dumps({'publications':len(catalog),'pages':sum(x['pageCount'] for x in catalog),'compressedMB':round(sum(p.stat().st_size for p in OUT.glob('*'))/1e6,2),'indexMB':round((ROOT/'data/search-index.json.gz').stat().st_size/1e6,2),'missing':missing}))

(ROOT/'data/search').mkdir(exist_ok=True)
for letter in 'abcdefghijklmnopqrstuvwxyz':writegz(ROOT/'data/search'/(letter+'.json.gz'),{k:v for k,v in index.items() if k.startswith(letter)})
