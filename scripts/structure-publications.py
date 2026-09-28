"""Add native PDF paragraphs and section headings without changing source text/index offsets."""
import fitz,json,gzip,re,unicodedata,collections,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
catalog=json.loads((root/'data/catalog.json').read_text())
def clean(text):
 text=unicodedata.normalize('NFKC',text)
 text=re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]','',text)
 text=re.sub(r'_{5,}','',text)
 text=re.sub(r'(\w)-\n(?=[a-z])',r'\1',text)
 return re.sub(r'\s+',' ',text).strip()
count=0
for meta in catalog:
 path=root/'data/publications'/f"{meta['id']}.json.gz"
 doc=json.loads(gzip.decompress(path.read_bytes()));pdfpath=root.parent/'publication-pdfs'/meta['filename']
 if meta['category']=='bible':pdfpath=root.parent/'upload'/('01-'+meta['filename'])
 pdf=fitz.open(pdfpath);contents=[]
 for i,page in enumerate(pdf):
  blocks=[b for b in page.get_text('dict')['blocks'] if 'lines' in b]
  fonts=collections.Counter()
  for b in blocks:
   for line in b['lines']:
    for s in line['spans']:fonts[round(s['size'],1)]+=len(s['text'])
  body=fonts.most_common(1)[0][0] if fonts else 10
  out=[]
  for b in blocks:
   spans=[s for l in b['lines'] for s in l['spans']];text=clean('\n'.join(''.join(s['text'] for s in l['spans']) for l in b['lines']))
   if not text:continue
   weights=collections.Counter()
   for span in spans:weights[round(span['size'],1)]+=len(span['text'].strip())
   size=weights.most_common(1)[0][0] if weights else body
   x,y,x2,y2=b['bbox'];h=page.rect.height
   # Exclude running furniture only at the physical page edge, not footnotes.
   if re.fullmatch(r'\d{1,4}',text) and (y<h*.09 or y>h*.91):continue
   if (y<h*.075 or y>h*.94) and size<body*.95 and len(text)<160:continue
   heading=size>=body*1.28 and 3<len(text)<220
   kind='h2' if heading else 'aside' if size<body*.86 else 'p'
   out.append({'type':kind,'text':text,'y':y,'size':size})
  # PDF drawing order sometimes places the title after the article body.
  leading=[b for b in out if b['type']=='h2' and b['y']<page.rect.height*.4]
  if leading:
   for b in leading:
    out.remove(b)
   out=leading+out
   best=max(leading,key=lambda b:b['size'])
   title=best['text']
   skip=re.search(r'TABLE OF CONTENTS|IN THIS ISSUE',doc['pages'][i]['text'],re.I) or re.search(r'D I G D E E P E R|SUMMARY|E X P L O R E',title)
   if i>0 and 5<len(title)<160 and not skip and not re.fullmatch(r'[\d\W]+',title):contents.append({'level':1,'title':title,'page':i+1})
  doc['pages'][i]['blocks']=[{'type':b['type'],'text':b['text']} for b in out]
 # Original bookmarks take precedence; detected headings are an explicitly labeled reading index.
 doc['contents']=[{'level':x[0],'title':x[1],'page':x[2]} for x in pdf.get_toc()] or contents
 doc['contentsType']='bookmarks' if pdf.get_toc() else 'headings'
 path.write_bytes(gzip.compress(json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
 count+=1
 if count%25==0:print(f'Structured {count} publications',flush=True)
print('Done',count,flush=True)
