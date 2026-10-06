"""Build a static index from an upstream checkout. No third-party dependencies."""
import argparse
import datetime as dt
import json
import re
from pathlib import Path

LINK = re.compile(r'\[([^\]]+)\]\((https?://(?:www\.)?codeforces\.com/(?:problemset/problem/\d+/[A-Za-z0-9]+|(?:contest|gym)/\d+/problem/[A-Za-z0-9]+)/?)\)')
PATH = re.compile(r'daily_problems/(\d{4})/(\d{2})/(\d{4})/problems\.md$')

def parse(text, path, root):
    match = PATH.search(path)
    if not match:
        return []
    year, month, day = match.groups()
    if day[:2] != month:
        raise ValueError(f'Inconsistent date: {path}')
    date = dt.date(int(year), int(month), int(day[2:])).isoformat()
    records = []
    for line in text.splitlines():
        link = LINK.search(line)
        if not link:
            continue
        label, url = link.groups()
        parts = url.rstrip('/').split('/')
        contest, index = (parts[-2], parts[-1]) if '/problemset/' in url else (parts[-3], parts[-1])
        kind = 'gym' if '/gym/' in url else 'cf'
        cells = [x.strip() for x in line.strip().strip('|').split('|')]
        rating = re.search(r'\d{3,4}', cells[0])
        folder = Path(path).parent
        solutions = sorted((root / folder / 'solution').glob('*.md'))
        editorial = next((p for p in solutions if p.stem.lower() == f'{kind}{contest}{index}'.lower()), None)
        records.append(dict(key=f'{kind}:{contest}:{index.upper()}', id=label, aliases=[f'{kind.upper()}{contest}{index.upper()}'], contestId=int(contest), index=index.upper(), kind=kind, date=date, rating=int(rating.group()) if rating else None, estimated='*' in cells[0], hint=cells[2] if len(cells)>2 else '', url=url, source='https://github.com/Yawn-Sean/Daily_CF_Problems/blob/main/'+path, editorial='https://github.com/Yawn-Sean/Daily_CF_Problems/blob/main/'+editorial.relative_to(root).as_posix() if editorial else None))
    if not records:
        raise ValueError(f'No supported problems in {path}')
    return records

def build(root, metadata=None):
    records=[]
    files=sorted((root/'daily_problems').rglob('problems.md'))
    if not files:
        raise ValueError('No daily problem files')
    for file in files:
        records.extend(parse(file.read_text(), file.relative_to(root).as_posix(), root))
    for p in records:
        meta=(metadata or {}).get(str(p['contestId'])+':'+p['index'], {})
        p.update(meta)
        p.setdefault('divisions', ['gym'] if p['kind']=='gym' else ['other'])
    records.sort(key=lambda p:(p['date'],p['rating'] or 0,p['id']), reverse=True)
    return dict(generatedAt=dt.datetime.now(dt.timezone.utc).isoformat(), source='Yawn-Sean/Daily_CF_Problems', days=len({p['date'] for p in records}), problems=records)

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('upstream',type=Path)
    ap.add_argument('--output',type=Path,default=Path('site/data/problems.json'))
    ap.add_argument('--metadata',type=Path,default=Path('site/data/metadata.json'))
    args=ap.parse_args()
    data=build(args.upstream,json.loads(args.metadata.read_text()) if args.metadata.exists() else {})
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
    print(f"Indexed {len(data['problems'])} appearances over {data['days']} days")
