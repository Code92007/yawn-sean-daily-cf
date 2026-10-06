export function normalizeQuery(value) {
 const v=value.trim();
 const m=v.match(/codeforces\.com\/(?:problemset\/problem\/(\d+)\/([a-z0-9]+)|(?:contest|gym)\/(\d+)\/problem\/([a-z0-9]+))/i);
 return m ? ((v.includes('/gym/')?'GYM':'CF')+(m[1]||m[3])+(m[2]||m[4])).toUpperCase() : v.toUpperCase().replace(/[\s_-]/g,'');
}
export function statusOf(p, remote, manual) {
 return manual[p.key] || remote[`${p.contestId}:${p.index}`]==='solved' ? 'solved' : remote[`${p.contestId}:${p.index}`] || 'unknown';
}
export function selectProblems(problems, filters, remote={}, manual={}) {
 const query=normalizeQuery(filters.query||'');
 return problems.filter(p=>{
 const ids=[p.id,...(p.aliases||[])].map(normalizeQuery);
 const number=/^(?:CF|GYM)?\d+[A-Z0-9]*$/.test(query);
 return (!query || (number ? ids.some(id=>id===query||id.replace(/^(CF|GYM)/,'')===query) : [p.id,p.name||'',p.contestName||''].some(s=>normalizeQuery(s).includes(query)))) &&
 (!(filters.start||filters.end)||(p.dates||[p.date]).some(date=>date&&(!filters.start||date>=filters.start)&&(!filters.end||date<=filters.end)))&&
 (!filters.min||(p.rating!==null&&p.rating>=Number(filters.min)))&&(!filters.max||(p.rating!==null&&p.rating<=Number(filters.max)))&&
 (filters.category==='all'||p.divisions.includes(filters.category))&&
 (filters.completion==='all'||(filters.completion==='unsolved'?statusOf(p,remote,manual)!=='solved':statusOf(p,remote,manual)===filters.completion));
 });
}
export function collectSubmissions(submissions, statuses={}) {
 for(const s of submissions){
 if(!s.problem?.contestId||!s.problem?.index)continue;
 const key=`${s.problem.contestId}:${s.problem.index.toUpperCase()}`;
 if(s.verdict==='OK')statuses[key]='solved';
 else if(s.verdict && !['TESTING','SKIPPED'].includes(s.verdict)&&statuses[key]!=='solved')statuses[key]='attempted';
 }
 return statuses;
}
export function ratingColor(n){return n==null?'#818990':n<1200?'#818990':n<1400?'#24923c':n<1600?'#139c9c':n<1900?'#245bd4':n<2100?'#9b45bb':n<2400?'#dd8a00':'#e03838';}

export function dayCompleted(problems,remote){return problems.length>0&&problems.every(p=>statusOf(p,remote,{})==='solved');}

export function combineTracks(tracks){
 const records=new Map();
 for(const track of tracks)for(const problem of track.problems){
  if(!records.has(problem.key))records.set(problem.key,{...problem,dates:[...(problem.dates||[])],topics:[],aliases:[...(problem.aliases||[])]});
  const p=records.get(problem.key);
  if(!p.topics.includes(track.id))p.topics.push(track.id);
  p.dates=[...new Set([...p.dates,...(problem.dates||[])])].sort();
  p.aliases=[...new Set([...p.aliases,...(problem.aliases||[])])];
  p.editorial=p.editorial||problem.editorial;
 }
 return [...records.values()];
}
