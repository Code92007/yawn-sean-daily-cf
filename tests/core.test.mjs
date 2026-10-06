import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeQuery,collectSubmissions,selectProblems,statusOf} from '../site/core.js';
const p={key:'cf:1900:E',id:'CF1900E',contestId:1900,index:'E',date:'2024-02-26',rating:2000,divisions:['div1','div2']};
const gym={key:'gym:106247:2',id:'GYM106247B',aliases:['GYM1062472'],contestId:106247,index:'2',date:'2026-02-20',rating:1400,divisions:['gym']};
const filters={category:'all',completion:'all'};
test('search exact identity, URL, numeric gym alias, multiple dates',()=>{
 for(const q of ['1900E','cf1900e','https://codeforces.com/contest/1900/problem/E'])assert.equal(selectProblems([p,{...p,date:'2025-01-01'},gym],{...filters,query:q}).length,2);
 for(const q of ['GYM106247B','https://codeforces.com/gym/106247/problem/2'])assert.equal(selectProblems([p,gym],{...filters,query:q})[0],gym);
 assert.equal(selectProblems([p],{...filters,query:'1900E1'}).length,0);
});
test('inclusive date/rating filters and joint divisions',()=>{
 for(const category of ['div1','div2'])assert.equal(selectProblems([p,gym],{...filters,category,start:p.date,end:p.date,min:2000,max:2000}).length,1);
 assert.equal(selectProblems([p,gym],{...filters,category:'gym'}).length,1);
 assert.equal(selectProblems([p],{...filters,start:'2025-01-01'}).length,0);
});
test('AC stays solved across pages and failed submissions',()=>{
 const s=(verdict)=>({verdict,problem:{contestId:1900,index:'E'}});
 const state=collectSubmissions([s('WRONG_ANSWER'),s('OK')]);collectSubmissions([s('WRONG_ANSWER')],state);
 assert.equal(state['1900:E'],'solved');assert.equal(statusOf(p,{},{}),'unknown');assert.equal(statusOf(p,{}, {[p.key]:true}),'solved');
 assert.equal(selectProblems([p],{...filters,completion:'unsolved'},state).length,0);
});
