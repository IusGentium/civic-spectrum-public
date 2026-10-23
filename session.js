/* Versioned answers and immutable submitted snapshots. No network or browser storage dependencies. */
(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function fingerprint(value){const s=JSON.stringify(value);let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
function revision(q){return fingerprint([q.id,q.text,q.type,q.options??null,q.axis,q.sign??null,q.values??null,q.note??null,q.fields??null]);}
function questionVersion(qs){return fingerprint(qs.map(q=>[q.id,revision(q)]));}
function validAnswer(q,a){return a===null||a==='u'||(a==='m'&&q.type==='choice')||(Number.isInteger(a)&&a>=0&&a<(q.type==='scale'?5:q.options.length));}
function empty(){return {schema:3,draft:{entries:{},indexId:null},submissions:[]};}
function entries(qs,answers){return Object.fromEntries(qs.map((q,i)=>[q.id,{revision:revision(q),value:validAnswer(q,answers[i])?answers[i]:null}]));}
function align(records,qs){return qs.map(q=>{const r=records?.[q.id];return r?.revision===revision(q)&&validAnswer(q,r.value)?r.value:null;});}
function validRecords(records){return records&&typeof records==='object'&&!Array.isArray(records)&&Object.values(records).every(r=>r&&typeof r.revision==='string'&&(r.value===null||r.value==='u'||r.value==='m'||Number.isInteger(r.value)));}
function validSnapshot(x){return x&&typeof x.id==='string'&&typeof x.kind==='string'&&typeof x.questionVersion==='string'&&typeof x.evidenceVersion==='string'&&typeof x.createdAt==='string'&&Number.isFinite(Date.parse(x.createdAt))&&Array.isArray(x.questions)&&new Set(x.questions.map(q=>q?.id)).size===x.questions.length&&x.questions.every(q=>q&&typeof q.id==='string'&&typeof q.text==='string'&&['scale','choice'].includes(q.type)&&(q.type==='scale'||Array.isArray(q.options)))&&validRecords(x.entries)&&x.questions.every(q=>validAnswer(q,x.entries[q.id]?.value))&&x.result&&Number.isInteger(x.result.answered)&&Number.isInteger(x.result.total)&&x.result.total===x.questions.length&&x.result.answered>=0&&x.result.answered<=x.result.total&&Array.isArray(x.result.groups)&&x.result.groups.every(g=>typeof g.name==='string'&&Array.isArray(g.rows)&&g.rows.every(r=>typeof r.name==='string'&&Number.isFinite(r.score)&&r.score>=0&&r.score<=100&&Number.isInteger(r.compared)&&Number.isInteger(r.total)&&r.compared>=0&&r.compared<=r.total));}
function load(raw,legacy,qs,baseline,legacyV1=false){
 if(raw!==null){const state=JSON.parse(raw);if(state?.schema!==3||!validRecords(state.draft?.entries)||!Array.isArray(state.submissions)||!state.submissions.every(validSnapshot)||new Set(state.submissions.map(x=>x.id)).size!==state.submissions.length)throw Error('Invalid saved history');return state;}
 const state=empty();if(!legacy)return state;
 const saved=JSON.parse(legacy);if(!Array.isArray(saved?.answers)||saved.answers.length!==baseline.length||!saved.answers.every((a,i)=>validAnswer(baseline[i],a)))throw Error('Invalid legacy answers');
 state.draft.entries=entries(baseline,saved.answers);
 state.draft.indexId=baseline[Math.max(0,Math.min(baseline.length-1,saved.index||0))]?.id;
 if(legacyV1&&saved.answers[48]===2)state.draft.entries.Q49.value=null;
 return state;
}
function update(state,qs,answers,index){state.draft={...state.draft,entries:{...state.draft.entries,...entries(qs,answers)},indexId:qs[index]?.id??null};}
function submit(state,qs,answers,result,evidenceVersion,kind='submitted'){
 const records=entries(qs,answers),key=fingerprint([records,evidenceVersion,kind]);
 if(state.submissions.at(-1)?.key===key)return state.submissions.at(-1);
 const snapshot={id:Date.now().toString(36)+'-'+state.submissions.length,key,createdAt:new Date().toISOString(),kind,questionVersion:questionVersion(qs),evidenceVersion,questions:clone(qs),entries:records,result:clone(result)};
 state.submissions.push(snapshot);return snapshot;
}
function restore(state,snapshot,qs){state.draft={entries:clone(snapshot.entries),indexId:qs[0]?.id??null};return align(state.draft.entries,qs);}
root.CivicSession={fingerprint,revision,questionVersion,validAnswer,empty,entries,align,load,update,submit,restore};
})(typeof window!=='undefined'?window:globalThis);

