"""Extract source illustrations, structured paragraphs, and answerable study prompts.
Original raw page text stays untouched for retrieval and existing citations.
"""
import fitz, gzip, json, pathlib, re, unicodedata, collections, hashlib, io, concurrent.futures, os
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
CAT=json.loads((ROOT/'data/catalog.json').read_text())
OUT=ROOT/'data/images';OUT.mkdir(exist_ok=True)
def clean(s):
 s=unicodedata.normalize('NFKC',s)
 s=re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]','',s)
 s=re.sub(r'_{5,}','',s)
 s=re.sub(r'(\w)-\n(?=[a-z])',r'\1',s)
 return re.sub(r'\s+',' ',s).strip()
def merge(rects):
 result=[]
 for rect in rects:
  rect=fitz.Rect(rect)
  for j,other in enumerate(result):
   expanded=fitz.Rect(other.x0-3,other.y0-3,other.x1+3,other.y1+3)
   if expanded.intersects(rect):
    result[j]=other|rect;break
  else:result.append(rect)
 return result

def process(meta):
 path=ROOT/'data/publications'/f"{meta['id']}.json.gz";doc=json.loads(gzip.decompress(path.read_bytes()))
 pdf=fitz.open(ROOT.parent/'publication-pdfs'/meta['filename']);reuse=os.environ.get('READER_REUSE_IMAGES') and doc.get('readerVersion')==3
 packed=bytearray((OUT/f"{meta['id']}.pack").read_bytes()) if reuse else bytearray();image_count=question_count=0
 for pi,page in enumerate(pdf):
  w,h=page.rect.width,page.rect.height
  raw=[b for b in page.get_text('dict',flags=fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES)['blocks'] if 'lines' in b]
  fonts=collections.Counter()
  for b in raw:
   for l in b['lines']:
    for s in l['spans']:fonts[round(s['size'],1)]+=len(s['text'])
  body=fonts.most_common(1)[0][0] if fonts else 10;blocks=[]
  for b in raw:
   spans=[s for l in b['lines'] for s in l['spans']];text=clean('\n'.join(''.join(s['text'] for s in l['spans']) for l in b['lines']))
   if not text:continue
   weights=collections.Counter()
   for s in spans:weights[round(s['size'],1)]+=len(s['text'])
   size=weights.most_common(1)[0][0] if weights else body
   bold=sum(len(s['text']) for s in spans if s['flags']&16)>sum(len(s['text']) for s in spans)*.6
   x,y,x2,y2=b['bbox']
   if re.fullmatch(r'\d{1,4}',text) and (y<h*.09 or y>h*.91):continue
   if (y<h*.075 or y>h*.94) and size<body*.95 and len(text)<160:continue
   isdate=bool(re.fullmatch(r'(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), [A-Z][a-z]+ \d{1,2}',text))
   kind='h2' if (size>=body*1.28 and len(text)<220) or isdate else 'aside' if size<body*.86 else 'p'
   numbered=bool(re.match(r'^\d{1,3}(?:[-–]\d{1,3})?\.\s',text))
   question='?' in text and len(text)<1100 and (numbered or (kind!='h2' and len(text)<500 and (bold or re.match(r'^(How|What|Why|Who|When|Where|Which|In what|Can you|Do you)\b',text))))
   if question and (text.isupper() or text[:1].islower()):
    question=False
    if text.isupper():kind='h2'
   if question:
    parts=re.split(r'\s+(?=\d{1,3}(?:[-–]\d{1,3})?\.\s)',text) if numbered else [text]
    for part in parts:
     if '?' not in part:blocks.append({'type':kind,'text':part,'box':b['bbox']});continue
     qid=f"q{pi+1}-"+hashlib.sha256(part.encode()).hexdigest()[:16]
     blocks.append({'type':'question','text':part,'questionId':qid,'box':b['bbox']});question_count+=1
   else:blocks.append({'type':kind,'text':text,'box':b['bbox']})
  # Restore article title and introductory material that PDF drawing order appends after the body.
  leading=[b for b in blocks if b['type']=='h2' and b['box'][1]<h*.4]
  if leading:
   top=max(b['box'][3] for b in leading)
   firstprose=next((b for b in blocks if b['type']=='p' and len(b['text'])>180 and b['box'][1]>=top),None)
   cutoff=firstprose['box'][1] if firstprose else top
   pre=[b for b in blocks if b in leading or b['box'][1]<cutoff or (firstprose and b['box'][2]<firstprose['box'][0])]
   pre=leading+[b for b in pre if b not in leading]
   blocks=pre+[b for b in blocks if b not in pre]
  # Put numbered review questions directly after their matching numbered paragraphs.
  questions=[b for b in blocks if b['type']=='question' and re.match(r'^\d+(?:[-–]\d+)?\.',b['text'])]
  for question in questions:
   numbers=re.match(r'^(\d+)(?:[-–](\d+))?\.',question['text']);target=int(numbers[2] or numbers[1]);candidates=[]
   for index,b in enumerate(blocks):
    if b['type'] not in ['p','aside']:continue
    m=re.match(r'^(\d{1,3})\s+[A-Z“‘]',b['text'])
    if m and int(m[1])==target:candidates.append(index)
   if target==1 and not candidates:
    candidates=[i for i,b in enumerate(blocks) if b['type']=='p' and len(b['text'])>180 and re.match(r'^[A-Z“‘]',b['text'])][:1]
   if candidates:
    anchor=blocks[candidates[0]];blocks.remove(question);blocks.insert(blocks.index(anchor)+1,question)
  # Merge split prose fragments without changing any words.
  joined=[]
  for b in blocks:
   prev=joined[-1] if joined else None
   if prev and prev['type']==b['type']=='p' and min(prev['box'][2],b['box'][2])-max(prev['box'][0],b['box'][0])>min(prev['box'][2]-prev['box'][0],b['box'][2]-b['box'][0])*.5 and re.match(r'^[a-z]',b['text']) and not re.search(r'[.!?:][”’]?$',prev['text']):prev['text']+=' '+b['text']
   else:joined.append(b)
  blocks=joined
  rects=[]
  for info in page.get_image_info():
   r=fitz.Rect(info['bbox']) & page.rect
   if r.width>=45 and r.height>=40 and r.get_area()>=w*h*.009 and info['width']>=80 and info['height']>=60:rects.append(r)
  # Keep complex vector maps/charts together, including their labels.
  drawings=page.get_drawings()
  if len(drawings)>=12:
   for r in page.cluster_drawings(drawings=drawings):
    r=fitz.Rect(r)&page.rect
    count=sum(1 for d in drawings if r.intersects(d['rect']))
    if r.width>90 and r.height>75 and w*h*.04<r.get_area()<w*h*.8 and count>=12:rects.append(r)
  rects=merge(rects)
  for ii,r in enumerate(rects):
   if r.is_empty or r.is_infinite:continue
   imageid=f'{pi+1}-{ii}'
   cached=next((b for b in doc['pages'][pi].get('blocks',[]) if b.get('imageId')==imageid),None) if reuse else None
   if cached:
    figure={**cached,'box':list(r)};figure.pop('caption',None);image_count+=1
   else:
    scale=min(2.2,1600/max(r.width,r.height));pix=page.get_pixmap(matrix=fitz.Matrix(scale,scale),clip=r,alpha=False)
    im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples);buf=io.BytesIO();im.save(buf,format='WEBP',quality=86,method=4);payload=buf.getvalue()
    if len(payload)<600:continue
    imageid=f'{pi+1}-{ii}';digest=hashlib.sha256(payload).hexdigest()[:12]
    figure={'type':'image','imageId':imageid,'offset':len(packed),'length':len(payload),'width':pix.width,'height':pix.height,'digest':digest,'alt':f"Illustration from {meta['title']}, source page {pi+1}",'box':list(r)}
    packed.extend(payload);image_count+=1
   # Nearby captions remain verbatim and are attached when clearly outside the image crop.
   captions=[b for b in blocks if (b['type']=='aside' or 'See paragraph' in b.get('text','')) and 8<len(b.get('text',''))<400 and 0<=b['box'][1]-r.y1<26 and min(b['box'][2],r.x1)-max(b['box'][0],r.x0)>min(r.width,b['box'][2]-b['box'][0])*.45]
   if captions:
    caption=captions[0];figure['caption']=caption['text'];blocks.remove(caption)
   # Place pictures by their physical location, keeping the prose in native column order.
   candidates=[(j,b) for j,b in enumerate(blocks) if b['box'][1]>=r.y1-5 and min(b['box'][2],r.x1)>max(b['box'][0],r.x0)]
   if candidates:blocks.insert(candidates[0][0],figure)
   else:blocks.append(figure)
  doc['pages'][pi]['blocks']=[{k:v for k,v in b.items() if k!='box'} for b in blocks]
 doc['readerVersion']=3
 # Keep each durable asset below 16 MiB and never split an illustration.
 chunks=[bytearray()]
 for pg in doc['pages']:
  for fig in pg['blocks']:
   if fig['type']!='image':continue
   payload=packed[fig['offset']:fig['offset']+fig['length']]
   assert len(payload)==fig['length'] and hashlib.sha256(payload).hexdigest()[:12]==fig['digest']
   if len(chunks[-1])+len(payload)>16*1024*1024:chunks.append(bytearray())
   fig['pack']=len(chunks)-1;fig['offset']=len(chunks[-1]);chunks[-1].extend(payload)
 for part,chunk in enumerate(chunks):(OUT/f"{meta['id']}-{part}.pack").write_bytes(chunk)
 doc['readerVersion']=4
 path.write_bytes(gzip.compress(json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
 return {'id':meta['id'],'pages':len(pdf),'images':image_count,'questions':question_count,'bytes':len(packed)}
if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser();parser.add_argument('--ids',nargs='*');parser.add_argument('--reuse-images',action='store_true');args=parser.parse_args();
 if args.reuse_images:os.environ['READER_REUSE_IMAGES']='1'
 items=[m for m in CAT if not args.ids or m['id'] in args.ids]
 results=[]
 with concurrent.futures.ProcessPoolExecutor(max_workers=4) as pool:
  for result in pool.map(process,items):
   results.append(result);print(json.dumps(result),flush=True)
 (ROOT/'data/immersive-manifest.json').write_text(json.dumps(results,indent=2))
 print(json.dumps({'complete':len(results),'images':sum(r['images'] for r in results),'questions':sum(r['questions'] for r in results)}),flush=True)
