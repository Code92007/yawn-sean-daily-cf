import {selectProblems,statusOf,collectSubmissions,ratingColor,dayCompleted,combineTracks} from './core.js?v=2c08c4958539';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const save=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v))}catch{$('accountStatus').textContent='浏览器无法保存本地记录；本次操作仍有效。'}};
let sheepRounds=[],indexMeta={};
let tracks=[],allTrackProblems=[],mode='daily',activeTrack='all',ready=false,loadError='',ratingAscending=true;
let problems=[],category='all',page=1,descending=true,remote={},busy=false,currentHandle=read('dcf.handle','');
const manual={};
const size=50;
$('handle').value=currentHandle;
function loadCache(){const cached=read('dcf.cache.'+currentHandle.toLowerCase(),null);remote=cached?.statuses||{};if(cached)$('accountStatus').textContent=`${currentHandle} · 缓存于 ${new Date(cached.at).toLocaleString('zh-CN')}，可重新同步`;}
loadCache();
const divisionLabels={div1:'Div. 1',div2:'Div. 2',div3:'Div. 3',div4:'Div. 4',div12:'Div. 1 + Div. 2',educational:'Educational',global:'Global',icpc:'ICPC Mirror',gym:'Gym',other:'其他'};
function cell(p){
 if(!p)return '<td class="problemcell emptycell">—</td>';
 const state=statusOf(p,remote,manual),color=ratingColor(p.rating);
 const topicTags=mode==='tracks'&&activeTrack==='all'?(p.topics||[]).map(id=>`<button class="topic-tag" data-track="${esc(id)}">${esc(tracks.find(t=>t.id===id)?.label||id)}</button>`).join(''):'';
 return `<td class="problemcell ${state==='solved'?'complete':''}"><div class="problem"><span class="dot" style="border-color:${color};${state==='solved'?'background:'+color:''}"></span><a style="color:${color}" title="${esc(p.id+(p.name?' · '+p.name:''))}" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.id)}${p.name?' · '+esc(p.name):''}</a></div><div class="cellmeta">${p.divisions.map(d=>`<span class="badge" title="${esc(p.contestName||'')}">${divisionLabels[d]||esc(d)}</span>`).join('')}<span class="rating" style="color:${color}">${p.estimated?'*':''}${p.rating??'—'}</span></div>${topicTags?`<div class="topic-tags">${topicTags}</div>`:''}${$('hints').checked&&p.hint?`<div class="hint">${esc(p.hint)}</div>`:''}<div class="cellactions"><a href="${esc(p.source)}" target="_blank" rel="noopener">原文 ↗</a>${p.editorial?`<a href="${esc(p.editorial)}" target="_blank" rel="noopener">题解 ↗</a>`:''}</div></td>`;
}
function setTopic(id){activeTrack=id;page=1;updateHash();render();}
function updateHash(){const hash=mode==='tracks'?'#tracks/'+encodeURIComponent(activeTrack):mode==='sheep'?'#sheep':'#daily';history.replaceState(null,'',hash);}
function loadHash(){const parts=location.hash.slice(1).split('/');mode=['tracks','sheep'].includes(parts[0])?parts[0]:'daily';try{activeTrack=decodeURIComponent(parts[1]||'all')}catch{activeTrack='all'}page=1;}
loadHash();
window.addEventListener('hashchange',()=>{loadHash();render()});
function renderSheep(){
 if(!ready){$('sheepPanel').innerHTML=`<p class="empty">${esc(loadError||'正在加载小羊杯资料…')}</p>`;return;}
 $('sheepPanel').innerHTML=sheepRounds.map(round=>`<article class="sheep-card"><div class="sheep-card-heading"><div><h2>${esc(round.title)}</h2><span class="badge">${esc(round.platform||'题解资料')}</span>${round.problems.length?`<span class="sheep-count">${round.problems.length} 道题</span>`:''}</div><div class="sheep-actions">${round.contestUrl?`<a class="contest-link" href="${esc(round.contestUrl)}" target="_blank" rel="noopener">前往补题 ↗</a>`:''}<a href="${esc(round.editorial||round.source)}" target="_blank" rel="noopener">${round.editorial?'文字题解':'题解目录'} ↗</a>${round.standardSolution?`<a href="${esc(round.standardSolution)}" target="_blank" rel="noopener">标准代码 ↗</a>`:''}</div></div>${round.accessCode?`<p class="access-code">洛谷访问码：<code>${esc(round.accessCode)}</code><button class="copy-code light" data-code="${esc(round.accessCode)}">复制</button></p>`:''}${round.problems.length?`<details><summary>展开 ${round.problems.length} 道题</summary><div class="tablewrap"><table class="sheep-table"><thead><tr><th>编号</th><th>题目</th><th>难度分档</th><th>题解</th></tr></thead><tbody>${round.problems.map(p=>`<tr><td>${esc(p.index)}</td><td>${p.url?`<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a>`:esc(p.title)}</td><td>${esc(p.difficulty||'—')}</td><td><a href="${esc(p.editorial)}" target="_blank" rel="noopener">题解 ↗</a></td></tr>`).join('')}</tbody></table></div></details>`:''}</article>`).join('')||'<p class="empty">暂无小羊杯资料。</p>';
}
$('sheepPanel').onclick=async e=>{const button=e.target.closest('[data-code]');if(!button)return;try{await navigator.clipboard.writeText(button.dataset.code);button.textContent='已复制';}catch{button.textContent='请手动复制';}};
function render(){
 const isSheep=mode==='sheep';
 document.querySelector('.account').hidden=isSheep;
 document.querySelector('.toolbar').hidden=isSheep;
 document.querySelector('.tabs').hidden=isSheep;
 $('problemLayout').hidden=isSheep;$('sheepPanel').hidden=!isSheep;
 document.querySelector('.note').hidden=isSheep;
 document.querySelectorAll('.modules button').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',b.dataset.mode===mode)});
 if(ready)$('update').textContent=`资料更新 ${new Date(indexMeta.generatedAt).toLocaleString('zh-CN')}`+(isSheep?'':` · ${indexMeta.days} 天`);
 if(isSheep){document.title='Yawn-Sean Daily CF Problems · 小羊杯';$('title').textContent='小羊杯';$('description').textContent='洛谷 / 牛客补题入口，以及小羊杯官方题解与标准代码。';renderSheep();return;}
 const topic=tracks.find(t=>t.id===activeTrack);
 if(mode==='tracks'&&activeTrack!=='all'&&!topic&&ready)activeTrack='all';
 const isTracks=mode==='tracks';
 document.querySelectorAll('.modules button').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',b.dataset.mode===mode)});
 document.title='Yawn-Sean Daily CF Problems · '+(isTracks?'题单':'每日一题');
 $('trackPanel').hidden=!isTracks;$('problemLayout').classList.toggle('with-topics',isTracks);
 document.querySelector('table').classList.toggle('track-table',isTracks);
 $('title').textContent=isTracks?(topic?`${topic.label} · ${topic.id}`:'算法题单'):'每日一题题库';
 $('description').textContent=isTracks?'选择算法专题，按难度练习，记录每道题的完成进度。':'按日期找到题目，记录每一道已完成的练习。';
 $('startLabel').textContent=isTracks?'每日日期 ≥':'开始日期';$('endLabel').textContent=isTracks?'每日日期 ≤':'结束日期';
 $('legend').innerHTML='<span class="greenkey"></span>'+(isTracks?'绿色题格：已完成 · 绿色题单：全部完成':'绿色题格：已完成 · 绿色日期：当天全部完成');
 $('topicSource').href=topic?.source||'https://github.com/Yawn-Sean/Daily_CF_Problems/tree/main/categories';
 const catalogue=[{id:'all',label:'全部题单',problems:allTrackProblems},...tracks];
 $('topicChoices').innerHTML=catalogue.map(t=>{
 const done=t.problems.filter(p=>statusOf(p,remote,manual)==='solved').length;
 return `<button data-track="${esc(t.id)}" class="topic-choice ${t.id===activeTrack?'active':''} ${t.problems.length>0&&done===t.problems.length?'complete':''}" aria-pressed="${t.id===activeTrack}"><span>${esc(t.label)}${t.id==='all'?'':`<small>${esc(t.id)}</small>`}</span><span class="topic-count">${done} / ${t.problems.length}</span></button>`;
 }).join('');
 $('tableHead').innerHTML=isTracks?`<tr><th>序号</th><th><button data-sort>题目 · 难度 ${ratingAscending?'↑':'↓'}</button></th><th>每日一题日期</th></tr>`:`<tr><th><button data-sort>日期 ${descending?'↓':'↑'}</button></th><th>题目 1</th><th>题目 2</th></tr>`;
 if(!ready){$('summary').textContent=loadError||'正在加载题库…';$('summary').classList.toggle('error',!!loadError);$('rows').innerHTML='';$('prev').disabled=true;$('next').disabled=true;return;}
 const filters=Object.fromEntries(['query','start','end','min','max','completion'].map(id=>[id,$(id).value]));filters.category=category;
 const base=isTracks?(topic?.problems||allTrackProblems):problems;
 const matched=selectProblems(base,filters,remote,manual);
 const count=new Set(matched.map(p=>p.key)).size,solved=new Set(matched.filter(p=>statusOf(p,remote,manual)==='solved').map(p=>p.key)).size;
 let units;
 if(isTracks){
  matched.sort((a,b)=>(a.rating==null)-(b.rating==null)||(ratingAscending?1:-1)*((a.rating??0)-(b.rating??0))||a.id.localeCompare(b.id,undefined,{numeric:true}));
  units=matched;
  $('summary').textContent=`${topic?topic.label:'全部题单'} · ${count} 道题 · 已完成 ${solved} 道`;
 }else{
  matched.sort((a,b)=>(descending?-1:1)*a.date.localeCompare(b.date));
  const groups=new Map();for(const p of matched){if(!groups.has(p.date))groups.set(p.date,[]);groups.get(p.date).push(p);}
  units=[...groups.entries()];$('summary').textContent=`${units.length} 天 · ${matched.length} 条每日记录 · ${count} 道题 · 已完成 ${solved} 道`;
 }
 if(filters.start&&filters.end&&filters.start>filters.end)$('summary').textContent='开始日期不能晚于结束日期';
 const pages=Math.max(1,Math.ceil(units.length/size));page=Math.max(1,Math.min(page,pages));
 $('page').textContent=`${page} / ${pages}`;$('prev').disabled=page===1;$('next').disabled=page===pages;
 const visible=units.slice((page-1)*size,page*size);
 if(isTracks){
  $('rows').innerHTML=visible.map((p,i)=>`<tr><td class="datecell">${(page-1)*size+i+1}</td>${cell(p)}<td class="track-dates">${p.dates?.length?p.dates.map(date=>`<button class="date-link" data-date="${date}" data-problem="${esc(p.id)}">${date}</button>`).join(''):'—'}</td></tr>`).join('');
 }else{
  const allDays=new Map();for(const p of problems){if(!allDays.has(p.date))allDays.set(p.date,[]);allDays.get(p.date).push(p);}
  $('rows').innerHTML=visible.map(([date,list])=>{list.sort((a,b)=>(a.rating??0)-(b.rating??0)||a.id.localeCompare(b.id));return `<tr><td class="datecell ${dayCompleted(allDays.get(date),remote)?'complete':''}"><a href="${esc(list[0].source)}" target="_blank" rel="noopener">${date}</a></td>${cell(list[0])}${cell(list[1])}</tr>`}).join('');
 }
 if(!visible.length)$('rows').innerHTML='<tr><td colspan="3" class="empty">没有匹配的题目。试试其他题号或筛选条件。</td></tr>';
}

for(const id of ['query','start','end','min','max','completion','hints'])$(id).addEventListener('input',()=>{page=1;render()});
document.querySelector('.tabs').addEventListener('click',e=>{if(!e.target.dataset.category)return;category=e.target.dataset.category;document.querySelectorAll('.tabs button').forEach(b=>{b.classList.toggle('active',b.dataset.category===category);b.setAttribute('aria-pressed',b.dataset.category===category)});page=1;render()});
document.querySelector('.modules').onclick=e=>{const button=e.target.closest('[data-mode]');if(!button)return;mode=button.dataset.mode;page=1;updateHash();render();};
$('topicChoices').onclick=e=>{const button=e.target.closest('[data-track]');if(button)setTopic(button.dataset.track)};
$('rows').onclick=e=>{const topic=e.target.closest('[data-track]');if(topic){setTopic(topic.dataset.track);return;}const date=e.target.closest('[data-date]');if(date){mode='daily';$('query').value=date.dataset.problem;$('start').value=date.dataset.date;$('end').value=date.dataset.date;category='all';document.querySelectorAll('.tabs button').forEach(b=>{b.classList.toggle('active',b.dataset.category==='all');b.setAttribute('aria-pressed',b.dataset.category==='all')});page=1;updateHash();render();}};
$('prev').onclick=()=>{page--;render()};$('next').onclick=()=>{page++;render()};$('tableHead').onclick=e=>{if(!e.target.hasAttribute('data-sort'))return;if(mode==='tracks')ratingAscending=!ratingAscending;else descending=!descending;page=1;render()};
$('reset').onclick=()=>{for(const id of ['query','start','end','min','max'])$(id).value='';$('completion').value='all';category='all';document.querySelectorAll('.tabs button').forEach(b=>{b.classList.toggle('active',b.dataset.category==='all');b.setAttribute('aria-pressed',b.dataset.category==='all')});page=1;render()};
$('clear').onclick=()=>{if(busy)return;currentHandle='';$('handle').value='';remote={};save('dcf.handle','');$('accountStatus').textContent='输入 ID，查看公开提交记录';render()};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchPage(handle,from){
 for(let attempt=0;attempt<3;attempt++){
 try{const response=await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=${from}&count=1000`,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`HTTP ${response.status}`);const data=await response.json();if(data.status!=='OK')throw Error(data.comment||'API 返回失败');return data.result;}
 catch(e){if(attempt===2||/not found|invalid handle/i.test(e.message))throw e;await delay(2200*(attempt+1));}
 }
}
$('accountForm').addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;const handle=$('handle').value.trim();if(!/^[a-zA-Z0-9_.-]{1,40}$/.test(handle)){$('accountStatus').textContent='请输入有效的 Codeforces ID';return;}
 busy=true;$('sync').disabled=true;$('clear').disabled=true;$('handle').disabled=true;$('accountStatus').classList.remove('error');
 const statuses={};let from=1;
 try{
 while(true){$('accountStatus').textContent=`正在同步 ${handle} · 已读取 ${from-1} 条提交…`;const batch=await fetchPage(handle,from);collectSubmissions(batch,statuses);if(batch.length<1000)break;from+=batch.length;await delay(2200);}
 currentHandle=handle;remote=statuses;save('dcf.handle',handle);save('dcf.cache.'+handle.toLowerCase(),{statuses,at:Date.now()});$('accountStatus').textContent=`${handle} · 同步完成 · ${Object.values(statuses).filter(s=>s==='solved').length} 道公开 AC 题目`;render();
 }catch(e){$('accountStatus').textContent=`同步失败：${e.message}。现有状态已保留，可稍后重试。`;$('accountStatus').classList.add('error');}
 finally{busy=false;$('sync').disabled=false;$('clear').disabled=false;$('handle').disabled=false;}
});
render();
try{const response=await fetch('./data/problems.json?t='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error(`HTTP ${response.status}`);const data=await response.json();indexMeta=data;sheepRounds=data.sheepRounds||[];problems=data.problems;tracks=data.tracks||[];allTrackProblems=combineTracks(tracks);ready=true;$('update').textContent=`题库更新 ${new Date(data.generatedAt).toLocaleString('zh-CN')} · ${data.days} 天`;render();}catch(e){loadError=`题库加载失败：${e.message}，请刷新重试`;render();}
