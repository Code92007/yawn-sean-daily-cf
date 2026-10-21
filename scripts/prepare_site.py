"""Version static assets so a new deployment never mixes cached old code."""
import hashlib,re
from pathlib import Path
site=Path(__file__).resolve().parents[1]/'site'
def version(name):return hashlib.sha256((site/name).read_bytes()).hexdigest()[:12]
app=site/'app.js'
s=app.read_text()
for name in ['core.js','history-review.js']:
    s=re.sub(r"from './"+re.escape(name)+r"(?:\?v=[a-f0-9]+)?'",f"from './{name}?v={version(name)}'",s)
app.write_text(s)
index=site/'index.html';s=index.read_text()
for name in ['app.js','style.css']:
    s=re.sub(re.escape(name)+r'(?:\?v=[a-f0-9]+)?',name+'?v='+version(name),s)
index.write_text(s)
