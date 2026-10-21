const repository='Code92007/yawn-sean-daily-cf';
const workflow='pages.yml';
const actionsUrl=`https://github.com/${repository}/actions/workflows/${workflow}`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export class HistoryReviewClient {
 #token='';
 constructor(request=(url,options)=>fetch(url,options)){this.request=request;}
 disconnect(){this.#token='';}
 async api(path,options={},token=this.#token){
  if(!token)throw Error('请先连接 GitHub');
  const response=await this.request(`https://api.github.com${path}`,{
   ...options,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28',...(options.body?{'Content-Type':'application/json'}:{})},signal:AbortSignal.timeout(30000),redirect:'error',credentials:'omit'
  });
  if(!response.ok){
   if(response.status===401){this.disconnect();throw Error('GitHub 凭据无效或已过期，请重新连接');}
   if(response.status===403)throw Error('没有操作权限或请求受限；请检查此仓库的 Actions 读写权限');
   if(response.status===404)throw Error('无法访问仓库或工作流，请检查凭据的仓库授权');
   throw Error(`GitHub 请求失败（${response.status}），请查看工作流后重试`);
  }
  return response.status===204?null:response.json();
 }
 async connect(token){
  this.disconnect();
  const user=await this.api('/user',{},token);
  const repo=await this.api(`/repos/${repository}`,{},token);
  if(!repo.permissions?.push)throw Error('此 GitHub 账号没有仓库写入权限');
  await this.api(`/repos/${repository}/actions/workflows/${workflow}`,{},token);
  this.#token=token;
  return user.login;
 }
 async dispatch(id,decision){
  if(!/^[a-f0-9]{16}$/.test(id)||!['approve','reject'].includes(decision))throw Error('无效的历史差异操作');
  return this.api(`/repos/${repository}/actions/workflows/${workflow}/dispatches`,{method:'POST',body:JSON.stringify({ref:'main',inputs:{[decision==='approve'?'approve_change':'reject_change']:id}})});
 }
 async findRun(id,decision){
  const title=`${decision==='approve'?'Approve':'Keep'} history ${id}`;
  const data=await this.api(`/repos/${repository}/actions/workflows/${workflow}/runs?event=workflow_dispatch&branch=main&per_page=50`);
  return data.workflow_runs.find(run=>run.display_title===title);
 }
 async run(id){
  if(!/^\d+$/.test(String(id)))throw Error('无效的工作流编号');
  return this.api(`/repos/${repository}/actions/runs/${id}`);
 }
}

export function initHistoryReview(onData){
 const $=id=>document.getElementById(id);
 const client=new HistoryReviewClient();
 let changes=[],login='',confirmation=null,connecting=false;
 const jobs=new Map();
 const status=(message,error=false)=>{$('reviewAuthStatus').textContent=message;$('reviewAuthStatus').classList.toggle('error',error);};
 function render(){
  const count=changes.length;
  $('notificationCount').hidden=!count;$('notificationCount').textContent=count;
  $('notifications').setAttribute('aria-label',`历史数据变更通知，${count} 条待确认`);
  $('reviewSettings').hidden=!count;
  $('reviewCredentials').hidden=!!login;
  $('disconnectReview').hidden=!login;
  const fields={id:'题号',rating:'难度',estimated:'估计难度',hint:'提示',url:'题目链接',editorial:'题解',aliases:'别名'};
  const display=value=>value==null?'—':Array.isArray(value)?value.join('、'):String(value);
  $('historyChanges').innerHTML=count?changes.map(change=>{
   const before=new Map(change.before.map(p=>[p.key,p])),after=new Map(change.after.map(p=>[p.key,p]));
   const differences=[...new Set([...before.keys(),...after.keys()])].flatMap(key=>{
    const old=before.get(key),next=after.get(key);
    if(!old||!next)return `<tr><td>${esc((old||next).id)} · ${old?'移除题目':'新增题目'}</td><td>${esc(old?old.id:'—')}</td><td>${esc(next?next.id:'—')}</td></tr>`;
    return Object.entries(fields).filter(([field])=>JSON.stringify(old[field])!==JSON.stringify(next[field])).map(([field,label])=>`<tr><td>${esc(old.id)} · ${label}</td><td>${esc(display(old[field]))}</td><td>${esc(display(next[field]))}</td></tr>`);
   }).join('');
   const job=jobs.get(change.id),disabled=job?.busy?' disabled':'';
   const confirm=confirmation?.id===change.id;
   return `<article class="history-card"><h3>${esc(change.date)} <span class="badge">${job?.busy?'处理中':'待确认'}</span></h3><a href="https://github.com/Yawn-Sean/Daily_CF_Problems/commits/main/${esc(change.path)}" target="_blank" rel="noopener">查看上游修改记录 ↗</a>${change.error?'<p class="error">上游内容暂时无法解析，保留原数据，请先检查上游文件。</p>':`<div class="tablewrap"><table class="history-table"><thead><tr><th>变更项</th><th>当前数据</th><th>上游数据</th></tr></thead><tbody>${differences||'<tr><td colspan="3">来源信息有变化，请查看上游修改记录。</td></tr>'}</tbody></table></div>`}<p>采用更新只修改这个日期；保留当前会记录本次决定，有新的差异时再通知。</p><div class="history-actions"><button data-review="approve" data-id="${esc(change.id)}"${disabled||change.error?' disabled':''}>采用更新</button><button class="light" data-review="reject" data-id="${esc(change.id)}"${disabled}>保留当前</button><a href="${actionsUrl}" target="_blank" rel="noopener">查看更新进度 ↗</a></div>${confirm?`<div class="history-confirm" role="group" aria-label="确认历史数据决定"><p>${confirmation.decision==='approve'?`确认将 ${esc(change.date)} 更新为上游的 ${change.after.length} 道题？`:`确认保留 ${esc(change.date)} 的当前数据，并关闭这条通知？`}</p><div class="history-actions"><button data-confirm="${esc(change.id)}">${confirmation.decision==='approve'?'确认采用':'确认保留'}</button><button class="light" data-cancel>取消</button></div></div>`:''}<p class="history-job ${job?.error?'error':''}" role="status">${esc(job?.message||'')}</p><code>${esc(change.id)}</code></article>`;
  }).join(''):'<p class="history-empty">暂无待确认的历史数据变更。</p>';
 }
 function requireConnection(){
  if(login)return true;
  $('reviewSettings').open=true;
  status('请先连接有仓库权限的 GitHub 账号，再选择是否更新。');
  $('reviewToken').focus();
  return false;
 }
 $('notifications').onclick=()=>{$('historyDialog').showModal();};
 $('closeHistory').onclick=()=>{$('historyDialog').close();};
 $('reviewAuthForm').onsubmit=async event=>{
  event.preventDefault();if(connecting)return;
  const token=$('reviewToken').value.trim();if(!token){status('请输入 GitHub 访问令牌',true);return;}
  connecting=true;$('connectReview').disabled=true;status('正在验证 GitHub 权限…');
  try{login=await client.connect(token);status(`已连接 ${login}，可以选择是否更新。`);}
  catch(error){login='';status(error.message,true);}
  finally{$('reviewToken').value='';connecting=false;$('connectReview').disabled=false;render();}
 };
 $('disconnectReview').onclick=()=>{client.disconnect();login='';confirmation=null;status('已断开 GitHub 连接');render();};
 async function track(id,decision,dispatched,started){
  let runId=dispatched?.workflow_run_id;
  for(let attempt=0;attempt<180;attempt++){
   await pause(5000);
   const run=runId?await client.run(runId):await client.findRun(id,decision);
   // A prior attempt for the same ID must not be mistaken for this request.
   if(!run||Date.parse(run.created_at)<started-10000)continue;
   runId=run.id;
   if(run.status!=='completed')continue;
   if(run.conclusion!=='success')throw Error('更新任务失败，当前数据已保留。请查看更新进度；差异可能已过期，刷新后重新确认。');
   jobs.set(id,{busy:true,message:'更新已完成，等待站点发布…'});render();
   for(let refresh=0;refresh<60;refresh++){
    const response=await fetch('./data/problems.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw Error('更新已完成，暂时无法读取站点数据，请稍后刷新。');
    const data=await response.json();
    const decisions=decision==='approve'?data.historicalApprovals:data.historicalRejections;
    if(decisions?.some(entry=>entry.id===id)){
     onData(data);update(data);status(decision==='approve'?'已采用更新，题库已刷新。':'已保留当前数据，本次通知已关闭。');
     $('reviewResult').textContent=decision==='approve'?'已采用更新，题库已刷新。':'已保留当前数据，本次通知已关闭。';
     return;
    }
    await pause(5000);
   }
   // Keep the submitted action locked while a deployment may still be syncing.
   jobs.set(id,{busy:true,message:'决定已记录，站点仍在同步，请稍后刷新页面。'});render();return;
  }
  jobs.set(id,{busy:true,message:'任务仍在排队或运行，请查看更新进度，完成后刷新页面。'});render();
 }
 $('historyChanges').onclick=async event=>{
  if(event.target.closest('[data-cancel]')){confirmation=null;render();return;}
  const choice=event.target.closest('[data-review]');
  if(choice){
   if(!requireConnection())return;
   confirmation={id:choice.dataset.id,decision:choice.dataset.review};render();
   $('historyChanges').querySelector('[data-confirm]')?.focus();return;
  }
  const button=event.target.closest('[data-confirm]');
  if(!button||!confirmation||button.dataset.confirm!==confirmation.id||!requireConnection())return;
  const {id,decision}=confirmation;
  if(jobs.get(id)?.busy||!changes.some(change=>change.id===id))return;
  confirmation=null;
  jobs.set(id,{busy:true,message:'正在提交决定…'});render();
  let submitted=false;
  try{
   const started=Date.now(),dispatched=await client.dispatch(id,decision);submitted=true;
   jobs.set(id,{busy:true,message:'决定已提交，正在更新题库…'});render();
   await track(id,decision,dispatched,started);
  }catch(error){
   // A network interruption after dispatch does not prove the job failed.
   jobs.set(id,{busy:submitted,error:true,message:error.message+(submitted?' 请查看更新进度后刷新页面。':'')});
   if(/凭据/.test(error.message)){login='';confirmation=null;}
   render();
  }
 };
 function update(data){
  changes=data.historicalChanges||[];confirmation=null;
  if(!changes.length){client.disconnect();login='';}
  render();
 }
 render();
 return update;
}
