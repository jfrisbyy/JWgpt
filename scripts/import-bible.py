import fitz,re,json,gzip,unicodedata,pathlib,collections
ROOT=pathlib.Path(__file__).resolve().parents[1]
import os
doc=fitz.open(pathlib.Path(os.environ.get('PETEY_UPLOAD_DIR',ROOT.parent/'upload'))/'01-nwt_E.pdf')
names='Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation'.upper().split('|')
pattern=re.compile(r'(?<![A-Z0-9])(?:'+'|'.join(re.escape(x) for x in sorted(names+['PSALM'],key=len,reverse=True))+r')(?![A-Z0-9])')
books={};states={};previous='GENESIS';lastlines={}
for pi in range(42,1663):
 page=doc[pi];blocks=page.get_text('dict')['blocks'];lines=[l for b in blocks if 'lines' in b for l in b['lines']]
 header=' '.join(s['text'] for l in lines for s in l['spans'] if s['bbox'][1]<32)
 found=[m.group().replace('PSALM','PSALMS') if m.group()=='PSALM' else m.group() for m in pattern.finditer(header)]
 first=found[0] if found else previous;last=found[-1] if found else first
 titles=[s for l in lines for s in l['spans'] if s['size']>17 and not s['text'].strip().isdigit()]
 boundary=min((s['bbox'][1] for s in titles),default=9999)
 if not found and titles:
  compact=re.sub(r'[^A-Z]','',''.join(s['text'] for s in titles))
  candidates=[n for n in names if re.sub(r'[^A-Z]','',n)==compact]
  if candidates:
   next_names=names[names.index(previous)+1:] if previous in names else names
   first=last=next((n for n in next_names if n in candidates),candidates[0])
 for li,line in enumerate(lines):
  for s in line['spans']:
   font=s['font'];size=round(s['size'],1);t=s['text'];y=s['bbox'][1]
   if y<32:continue
   book=last if y>boundary else first
   if book not in names:continue
   books.setdefault(book,{})
   chapter,verse=states.get(book,(None,None))
   if book in ['OBADIAH','PHILEMON','2 JOHN','3 JOHN','JUDE'] and chapter is None:chapter,verse=1,1;books[book].setdefault('1',{})
   if 'FixedNum' in font and size>12 and t.strip().isdigit():
    chapter=int(t);verse=1;books[book].setdefault(str(chapter),{});books[book][str(chapter)].setdefault('1',{'text':'','page':pi+1});lastlines[book]=None
   elif 'FixedNum' in font and 6.8<size<7.2 and t.strip().isdigit() and chapter:
    verse=int(t);books[book][str(chapter)].setdefault(str(verse),{'text':'','page':pi+1});lastlines[book]=None
   elif chapter and verse and 6.8<size<7.2 and ('ClearText' in font or 'UtSerif' in font):
    target=books[book][str(chapter)].setdefault(str(verse),{'text':'','page':pi+1});text=unicodedata.normalize('NFKC',t).replace('\x03','ʹ').replace('\x02','ʹ');text=re.sub(r'[\x00-\x1f]','',text)
    if lastlines.get(book)!=(pi,li) and target['text']:
     if target['text'].endswith('-') and re.match(r'^[a-z]',text):
      # Keep genuine compound-word hyphens that happen to fall at line breaks.
      tail=re.search(r'(\w+)-$',target['text']); compound=tail and tail[1] in ['only','well','first','self','God','Jehovah','loving','long','great','life','blood','fellow']
      if not compound:target['text']=target['text'][:-1]
     else:target['text']+=' '
    target['text']+=text;lastlines[book]=(pi,li)
   states[book]=(chapter,verse)
 previous=last
for chapters in books.values():
 for verses in chapters.values():
  for v in verses.values():v['text']=re.sub(r'\s+',' ',v['text']).strip()
(ROOT/'data/bible.json.gz').write_bytes(gzip.compress(json.dumps(books,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
report={b:{'chapters':len(c),'verses':sum(len(v) for v in c.values())} for b,c in books.items()}
print(json.dumps({'books':len(books),'chapters':sum(len(c) for c in books.values()),'verses':sum(x['verses'] for x in report.values()),'report':report,'samples':{r:books.get(b,{}).get(c,{}).get(v) for r,b,c,v in [('John 3:16','JOHN','3','16'),('Proverbs 15:22','PROVERBS','15','22'),('Genesis 1:1','GENESIS','1','1')]}}))
