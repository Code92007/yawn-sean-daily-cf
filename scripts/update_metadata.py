"""Enrich regular CF problems; preserve last known metadata on API failure."""
import argparse,json,re,time,urllib.request
from pathlib import Path

def fetch(method):
    req=urllib.request.Request('https://codeforces.com/api/'+method,headers={'User-Agent':'DailyCFStaticIndex/1.0'})
    with urllib.request.urlopen(req,timeout=60) as response:
        data=json.load(response)
    if data['status']!='OK':raise ValueError(data.get('comment','Codeforces API failed'))
    return data['result']

def merge(contests,problems,existing):
    contests={c['id']:c for c in contests}
    for p in problems:
        cid=p.get('contestId')
        if cid is None:continue
        name=contests.get(cid,{}).get('name','')
        divs=[f'div{i}' for i in (1,2) if re.search(r'Div\.?\s*'+str(i)+r'\b',name,re.I)] or ['other']
        existing[str(cid)+':'+p['index'].upper()]={'name':p['name'],'contestName':name,'divisions':divs}
    return existing

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--output',type=Path,default=Path('site/data/metadata.json'));ap.add_argument('--fixtures',type=Path);args=ap.parse_args()
    old=json.loads(args.output.read_text()) if args.output.exists() else {}
    try:
        if args.fixtures:
            contests=json.loads((args.fixtures/'contests.json').read_text())['result'];problems=json.loads((args.fixtures/'cf-problems.json').read_text())['result']['problems']
        else:
            contests=fetch('contest.list?gym=false');time.sleep(2.2);problems=fetch('problemset.problems')['problems']
        old=merge(contests,problems,old)
    except Exception as error:
        if not old:raise
        print('Metadata update unavailable; retaining cached metadata:',error)
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(old,ensure_ascii=False,separators=(',',':'))+'\n')
    print(f'Metadata: {len(old)} problems')
