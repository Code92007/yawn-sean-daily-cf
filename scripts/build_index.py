"""Build a static index from an upstream checkout. No third-party dependencies."""
import argparse
import datetime as dt
import json
import re
from urllib.parse import quote
from pathlib import Path

LINK = re.compile(r'\[([^\]]+)\]\((https?://(?:www\.)?codeforces\.com/(?:problemset/problem/\d+/[A-Za-z0-9]+|(?:contest|gym)/\d+/problem/[A-Za-z0-9]+)/?)\)')
PATH = re.compile(r'daily_problems/(\d{4})/(\d{2})/(\d{4})/problems\.md$')

TOPIC_NAMES = {
    'DP':'动态规划', 'binary_search':'二分', 'bitmask':'位运算 / 状态压缩',
    'brain_teaser':'思维', 'brute_force':'枚举', 'constructive':'构造',
    'counting':'计数', 'data_structures':'数据结构', 'games':'博弈',
    'geometry':'几何', 'graph':'图论', 'greedy':'贪心', 'matrix':'矩阵',
    'number_theory':'数论', 'probabilities':'概率', 'random':'随机化',
    'shortest_path':'最短路', 'sortings':'排序', 'strings':'字符串',
    'trees':'树', 'two_pointers':'双指针',
}
REPO_URL = 'https://github.com/Yawn-Sean/Daily_CF_Problems/blob/main/'
EDITORIAL = re.compile(r'\[Editorial\]\(https://github\.com/Yawn-Sean/Daily_CF_Problems/blob/main/([^\)]+)\)', re.I)

def problem_row(line, path, root):
    link = LINK.search(line)
    if not link:
        return None
    label, url = link.groups()
    parts = url.rstrip('/').split('/')
    contest, index = (parts[-2], parts[-1]) if '/problemset/' in url else (parts[-3], parts[-1])
    kind = 'gym' if '/gym/' in url else 'cf'
    cells = [x.strip() for x in line.strip().strip('|').split('|')]
    rating = re.search(r'\d{3,4}', cells[0])
    editorial = EDITORIAL.search(line)
    editorial_path = editorial.group(1) if editorial else None
    if editorial_path and not (root/editorial_path).is_file():
        editorial_path = None
    if not editorial_path:
        # Gym editorials in upstream often use cf, not gym, as the filename prefix.
        folder = root/Path(path).parent/'solution'
        stems = [f'{kind}{contest}{index}', f'cf{contest}{index}', label.lower().replace('gym','cf',1)]
        editorial_file = next((file for stem in stems for file in folder.glob(stem.lower()+'.md')), None)
        editorial_path = editorial_file.relative_to(root).as_posix() if editorial_file else None
    return dict(key=f'{kind}:{contest}:{index.upper()}', id=label,
        aliases=[f'{kind.upper()}{contest}{index.upper()}'], contestId=int(contest),
        index=index.upper(), kind=kind, rating=int(rating.group()) if rating else None,
        estimated='*' in cells[0], hint=cells[2] if len(cells)>2 else '', url=url,
        source=REPO_URL+quote(path, safe='/'), editorial=REPO_URL+quote(editorial_path, safe='/') if editorial_path else None)

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
        p = problem_row(line,path,root)
        if p:
            p['date']=date
            records.append(p)
    if not records:
        raise ValueError(f'No supported problems in {path}')
    return records

def enrich(p, metadata):
    p.update(metadata.get(str(p['contestId'])+':'+p['index'], {}))
    if p['kind']=='cf':
        p.update(metadata.get('contest:'+str(p['contestId']), {}))
    p.setdefault('divisions', ['gym'] if p['kind']=='gym' else ['other'])
    return p

def build_tracks(root, metadata, daily):
    dates={}
    for p in daily:
        dates.setdefault(p['key'],set()).add(p['date'])
    tracks=[]
    for file in sorted((root/'categories').glob('*.md')):
        path=file.relative_to(root).as_posix()
        records={}
        for line in file.read_text().splitlines():
            p=problem_row(line,path,root)
            if not p:continue
            p['dates']=sorted(dates.get(p['key'],[]))
            records.setdefault(p['key'],enrich(p,metadata))
        if not records:
            raise ValueError(f'No supported problems in {path}')
        tracks.append(dict(id=file.stem,label=TOPIC_NAMES.get(file.stem,file.stem.replace('_',' ')),
            source=REPO_URL+quote(path,safe='/'),problems=list(records.values())))
    return tracks

def build_sheep(root):
    folder=root/'SheepCup'
    if not folder.is_dir():return []
    config_path=Path(__file__).resolve().parents[1]/'config/sheep-cup.json'
    config=json.loads(config_path.read_text()) if config_path.exists() else {}
    rounds=[]
    for directory in sorted((d for d in folder.iterdir() if d.is_dir()),key=lambda d:int(re.search(r'\d+',d.name).group()) if re.search(r'\d+',d.name) else 10000):
        info=dict(config.get(directory.name,{}))
        info.setdefault('title','小羊杯 '+directory.name.replace('Round','Round '))
        info['id']=directory.name
        relative=directory.relative_to(root).as_posix()
        info['source']='https://github.com/Yawn-Sean/Daily_CF_Problems/tree/main/'+quote(relative,safe='/')
        info['editorial']=None
        info['standardSolution']=info['source']+'/standard_solution' if (directory/'standard_solution').is_dir() else None
        info['problems']=[]
        tutorial=directory/'tutorial.md'
        if tutorial.is_file():
            info['editorial']=REPO_URL+quote(tutorial.relative_to(root).as_posix(),safe='/')
            text=tutorial.read_text()
            titles=dict(re.findall(r'^\|\*\*([A-Z])\*\*\|\*\*([^|]+?)\*\*\|',text,re.M))
            difficulty=''
            for line in text.splitlines():
                group=re.match(r'^### (.+)$',line)
                if group:difficulty=group.group(1)
                match=re.match(r'^#### ([A-Z])\. (.+)$',line)
                if not match:continue
                index,title=match.groups()
                slug=re.sub(r'[^\w\s-]','',index+'. '+title).strip().lower().replace(' ','-')
                template=info.get('problemUrlTemplate')
                info['problems'].append(dict(index=index,title=titles.get(index,title),difficulty=difficulty,
                    url=template.format(index=index) if template else None,
                    editorial=info['editorial']+'#'+quote(slug)))
            info['problems'].sort(key=lambda p:p['index'])
        rounds.append(info)
    return rounds

def build(root, metadata=None):
    records=[]
    files=sorted((root/'daily_problems').rglob('problems.md'))
    if not files:
        raise ValueError('No daily problem files')
    for file in files:
        records.extend(parse(file.read_text(), file.relative_to(root).as_posix(), root))
    metadata=metadata or {}
    for p in records:
        enrich(p,metadata)
    tracks=build_tracks(root,metadata,records)
    records.sort(key=lambda p:(p['date'],p['rating'] or 0,p['id']), reverse=True)
    return dict(generatedAt=dt.datetime.now(dt.timezone.utc).isoformat(), source='Yawn-Sean/Daily_CF_Problems', days=len({p['date'] for p in records}), problems=records, tracks=tracks, sheepRounds=build_sheep(root))

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('upstream',type=Path)
    ap.add_argument('--output',type=Path,default=Path('site/data/problems.json'))
    ap.add_argument('--metadata',type=Path,default=Path('site/data/metadata.json'))
    args=ap.parse_args()
    data=build(args.upstream,json.loads(args.metadata.read_text()) if args.metadata.exists() else {})
    if not data['tracks']:
        raise ValueError('Missing categories: checkout daily_problems and categories before building')
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
    print(f"Indexed {len(data['problems'])} appearances over {data['days']} days; {len(data['tracks'])} topic lists")
