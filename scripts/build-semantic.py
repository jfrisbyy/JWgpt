"""Build a deterministic, local latent-semantic index from the uploaded library.
No external service, user data, or paid embeddings are involved. Rebuild after imports.
"""
import gzip,json,pathlib,re,base64,hashlib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize
root=pathlib.Path(__file__).resolve().parents[1]
cat=json.loads((root/'data/catalog.json').read_text()); texts=[]; ids=[]
for p in cat:
 if p['category']=='bible':continue
 doc=json.load(gzip.open(root/'data/publications'/(p['id']+'.json.gz')))
 for page in doc['pages']:
  text=page['text']
  if len(text)<100:continue
  texts.append(text);ids.append(p['offset']+page['number']-1)
bible=json.load(gzip.open(root/'data/bible.json.gz'));chapter_texts=[]
for book,chapters in bible.items():
 for chapter,verses in chapters.items():chapter_texts.append(' '.join(v['text'] for v in verses.values()))
vec=TfidfVectorizer(strip_accents='unicode',lowercase=True,stop_words='english',token_pattern=r'(?u)\b[a-z]{3,}\b',max_features=12000,min_df=3,sublinear_tf=True,dtype=np.float32)
X=vec.fit_transform(texts+chapter_texts)
svd=TruncatedSVD(n_components=64,n_iter=7,random_state=19)
projections=svd.fit_transform(X); rows=[normalize(projections[:len(texts)])]
verse_texts=[]
for book,chapters in bible.items():
 for chapter,verses in chapters.items():
  keys=list(verses)
  for i,v in enumerate(keys):
   verse_texts.append(' '.join(verses[k]['text'] for k in keys[max(0,i-1):i+2]));ids.append('b:'+book+':'+chapter+':'+v)
rows.append(normalize(svd.transform(vec.transform(verse_texts))))
docs=np.rint(np.clip(np.vstack(rows),-1,1)*127).astype('int8')
terms=svd.components_.T.copy(); scales=np.max(np.abs(terms),axis=1); quant=np.rint(terms/scales[:,None]*127).astype('int8')
out={'version':1,'dimensions':64,'method':'Corpus-trained latent semantic retrieval + lexical and topic matching','vocabulary':vec.get_feature_names_out().tolist(),'idf':np.round(vec.idf_,4).tolist(),'scales':np.round(scales,7).tolist(),'terms':base64.b64encode(quant.tobytes()).decode(),'documents':base64.b64encode(docs.tobytes()).decode(),'ids':ids,'corpusFingerprint':hashlib.sha256(('\n'.join(texts)).encode()).hexdigest()}
target=root/'data/semantic.json.gz';target.write_bytes(gzip.compress(json.dumps(out,separators=(',',':')).encode(),mtime=0))
print(json.dumps({'documents':len(ids),'dimensions':64,'terms':len(out['vocabulary']),'compressedBytes':target.stat().st_size,'explainedVariance':float(svd.explained_variance_ratio_.sum())}))
