import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HistoryReviewClient} from '../site/history-review.js';

const id='34ca60f5f981248b';
function mockApi(permission=true){
 const requests=[];
 const client=new HistoryReviewClient(async(url,options)=>{
  requests.push({url,options});
  const path=new URL(url).pathname;
  const body=path==='/user'?{login:'owner'}:path.endsWith('/yawn-sean-daily-cf')?{permissions:{push:permission}}:{};
  return new Response(options.method==='POST'?null:JSON.stringify(body),{status:options.method==='POST'?204:200});
 });
 return {client,requests};
}
test('viewing/connecting never dispatches and both decisions bind to one change ID',async()=>{
 const {client,requests}=mockApi();
 assert.equal(requests.length,0);
 await assert.rejects(client.dispatch(id,'approve'),/连接/);
 assert.equal(requests.length,0);
 assert.equal(await client.connect('test-token'),'owner');
 assert.equal(requests.length,3);
 assert.ok(requests.every(r=>!r.options.method));
 for(const decision of ['approve','reject']){
  await client.dispatch(id,decision);
  const request=requests.at(-1);
  assert.equal(new URL(request.url).origin,'https://api.github.com');
  assert.equal(request.options.headers.Authorization,'Bearer test-token');
  assert.equal(request.options.credentials,'omit');
  assert.equal(request.options.redirect,'error');
  assert.deepEqual(JSON.parse(request.options.body),{ref:'main',inputs:{[decision==='approve'?'approve_change':'reject_change']:id}});
 }
 client.disconnect();
 await assert.rejects(client.dispatch(id,'approve'),/连接/);
 assert.equal(requests.length,5);
});
test('read-only accounts and malformed decisions cannot dispatch',async()=>{
 const {client,requests}=mockApi(false);
 await assert.rejects(client.connect('test-token'),/写入权限/);
 await assert.rejects(client.dispatch(id,'approve'),/连接/);
 await assert.rejects(client.dispatch('outdated-id','approve'),/无效/);
 await assert.rejects(client.dispatch(id,'unknown'),/无效/);
 assert.equal(requests.length,2);
});
test('invalid credentials fail without exposing secrets',async()=>{
 const client=new HistoryReviewClient(async()=>new Response('{}',{status:401}));
 await assert.rejects(client.connect('secret-value'),error=>/凭据/.test(error.message)&&!error.message.includes('secret-value'));
 await assert.rejects(client.dispatch(id,'approve'),/连接/);
});
