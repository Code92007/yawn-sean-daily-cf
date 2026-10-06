"""Review recent upstream edits without silently overwriting historical days."""
import copy
import datetime as dt
import hashlib
import json
import re
import subprocess

FIELDS=('key','id','aliases','contestId','index','kind','rating','estimated','hint','url','source','editorial','date')

def git(root,*args):
    return subprocess.check_output(['git','-C',str(root),*args],text=True,stderr=subprocess.DEVNULL).strip()

def recent_paths(root,previous_commit=None):
    head=git(root,'rev-parse','HEAD')
    if previous_commit==head:
        return head,[]
    if previous_commit:
        try:
            return head,git(root,'diff','--name-only',previous_commit,head,'--','daily_problems').splitlines()
        except subprocess.CalledProcessError:
            pass
    return head,git(root,'log','--since=2 days ago','--format=','--name-only','--no-root','--diff-merges=first-parent','--','daily_problems').splitlines()

def inspect(root,previous,paths,parse,enrich,metadata,today):
    changes={c['date']:c for c in previous.get('historicalChanges',[])}
    daily=previous.get('problems',[])
    for path in sorted(set(paths)):
        match=re.fullmatch(r'daily_problems/(\d{4})/(\d{2})/(\d{4})/problems\.md',path)
        if not match:continue
        year,month,day=match.groups()
        date=f'{year}-{month}-{day[2:]}'
        before=[p for p in daily if p['date']==date]
        if date>=today or not before:continue
        file=root/path
        error=None
        try:
            after=parse(file.read_text(),path,root) if file.exists() else []
        except ValueError as exc:
            after=[];error=str(exc)
        projection=lambda rows:sorted([{k:p.get(k) for k in FIELDS} for p in rows],key=lambda p:p['key'])
        if not error and projection(before)==projection(after):
            changes.pop(date,None)
            continue
        # Retain cached enrichment when source fields change; metadata refreshes
        # alone are not historical content changes.
        old={p['key']:p for p in before}
        after=[dict(old.get(p['key'],enrich(dict(p),metadata)),**p) for p in after]
        signature=json.dumps(dict(date=date,before=before,after=after,error=error),sort_keys=True,ensure_ascii=False)
        change_id=hashlib.sha256(signature.encode()).hexdigest()[:16]
        changes[date]=dict(id=change_id,date=date,path=path,before=before,after=after,error=error,
            detectedAt=changes.get(date,{}).get('detectedAt') if changes.get(date,{}).get('id')==change_id else dt.datetime.now(dt.timezone.utc).isoformat())
    return sorted(changes.values(),key=lambda c:c['date'],reverse=True)

def approve(previous,change_id):
    result=copy.deepcopy(previous)
    change=next((c for c in result.get('historicalChanges',[]) if c['id']==change_id),None)
    if not change:raise ValueError('Unknown or outdated historical change ID')
    if change.get('error'):raise ValueError('Cannot approve an unparseable upstream change')
    result['problems']=[p for p in result['problems'] if p['date']!=change['date']]+change['after']
    result['historicalChanges']=[c for c in result['historicalChanges'] if c['id']!=change_id]
    result.setdefault('historicalApprovals',[]).append(dict(id=change_id,date=change['date'],approvedAt=dt.datetime.now(dt.timezone.utc).isoformat()))
    return result
