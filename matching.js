/* Evidence-aware matching. Also loaded by the Node verification harness. */
(function(root){
'use strict';
const VERSION='evidence-v10-broad-capital-mobilization';
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>'Q'+String(a+i).padStart(2,'0'));
const FIELDS={
 'Politics':[...range(19,24),...range(31,48)],
 'Philosophy':['Q19','Q20','Q23','Q25','Q27',...range(31,36),'Q66','Q72'],
 'Political theory':['Q19','Q20',...range(31,48),...range(61,66)],
 'Legal theory':[...range(25,30),'Q19','Q20','Q32','Q33'],
 'Economics':range(49,60),
 'Theology':[...range(1,18),'Q19','Q20','Q27','Q32','Q34','Q36'],
 'Social':[...range(7,18),'Q21','Q22','Q24',...range(61,66)],
 'Foreign policy':['Q66',...range(67,72)],
 'AI outlook':range(73,78),
 'Church–state arrangements':range(1,12)
};
// Existing field assignments are editorial choices, not ranges in the answer
// array. New questions can declare fields explicitly; otherwise their axis
// supplies the broad field membership. AI never enters overall comparisons.
const FIELD_AXES={
 'Politics':[3,5,6,7], 'Philosophy':[3,4,5],
 'Political theory':[3,5,6,7,10], 'Legal theory':[4],
 'Economics':[8,9], 'Theology':[0,1,2], 'Social':[1,2,3,10],
 'Foreign policy':[11], 'AI outlook':[12], 'Church–state arrangements':[0,1]
};
const ORIGINAL_IDS=new Set(Object.values(FIELDS).flat());
function isAIQuestion(q){return q.axis===12||q.fields?.includes('AI outlook')===true;}
function scopeIds(questions,scope='overall'){
 if(scope!=='overall'&&!Object.hasOwn(FIELDS,scope))return null;
 return questions.filter(q=>{
  if(q.identity===true)return false;
  if(scope==='overall')return !isAIQuestion(q);
  if(scope==='AI outlook')return isAIQuestion(q);
  if(isAIQuestion(q))return false;
  if(Array.isArray(q.fields))return q.fields.includes(scope);
  return ORIGINAL_IDS.has(q.id)?FIELDS[scope].includes(q.id):FIELD_AXES[scope].includes(q.axis);
 }).map(q=>q.id);
}
// Arrays are always aligned to the supplied question list. Persisted answers
// should use stable question IDs and be migrated/version-checked by the caller.
function answerFor(answers,id,index){return Array.isArray(answers)?answers[index]:answers?.[id];}
// Ordinal questions use their declared values. Other choices are genuinely
// categorical: disagreement is not interpreted as another adjacent ideology.
function distance(q,a,b){if(a===b)return 0;if(q.type==='scale')return Math.abs(a-b)/4;if(q.values)return Math.abs(q.values[a]-q.values[b])/2;return 1;}
function accepted(q,position){return (position?.answers??[]).filter(x=>Number.isInteger(x)&&x>=0&&x<(q.type==='scale'?5:q.options.length));}
function isSupported(p,pos){return pos&&['explicit','inferred'].includes(pos.basis)&&typeof pos.rationale==='string'&&pos.rationale.length>0&&Array.isArray(pos.sourceIds)&&pos.sourceIds.length>0&&pos.sourceIds.every(id=>p.sources.some(s=>s.id===id&&/^https?:\/\//.test(s.url)));}
// Editorial key-policy conflicts are separate from ordinary distance. Only a
// researched opposition across every accepted alternative triggers a penalty.
// Keep this list small and explicit; unknown positions never incur penalties.
const KEY_CONFLICT_RULES=[{id:'Q100',scope:'Economics',sides:[[0,1],[2,3]],maxPenalty:20}];
function keyPolicyConflicts(items,scope){return KEY_CONFLICT_RULES.filter(rule=>rule.scope===scope).flatMap(rule=>{
 const item=items.find(x=>x.id===rule.id);if(!item)return [];
 const side=rule.sides.findIndex(options=>options.includes(item.answer));
 if(side<0||!item.options.every(a=>rule.sides.some((options,i)=>i!==side&&options.includes(a))))return [];
 const evidenceWeight=1;
 return [{id:item.id,penalty:rule.maxPenalty*evidenceWeight,evidenceWeight,maxPenalty:rule.maxPenalty}];
});}
function scoreProfile(profile,answers,questions,scope='overall'){
 const ids=scopeIds(questions,scope);if(!ids)return null;
 const byId=new Map(questions.map(q=>[q.id,q])),indices=new Map(questions.map((q,i)=>[q.id,i])),sourcePositions=[],compared=[];
 for(const id of ids){const q=byId.get(id),pos=profile.positions?.[id];if(!q||!isSupported(profile,pos))continue;const options=accepted(q,pos);if(!options.length)continue;const item={id,axis:q.axis,position:pos,options,question:q};sourcePositions.push(item);const a=answerFor(answers,id,indices.get(id));if(!Number.isInteger(a)||a<0||a>=(q.type==='scale'?5:q.options.length))continue;const similarities=options.map(b=>1-distance(q,a,b)),upper=Math.max(...similarities),lower=pos.basis==='inferred'?Math.min(...similarities):upper;const similarity=pos.basis==='inferred'?similarities.reduce((sum,x)=>sum+x,0)/similarities.length:upper;compared.push({...item,answer:a,similarity,lower,upper,importance:(q.matchingWeight??1)*(scope==='Economics'&&id==='Q100'?2:1),weight:(q.matchingWeight??1)*(scope==='Economics'&&id==='Q100'?2:1)});}
 const axes=new Map();for(const r of compared){if(!axes.has(r.axis))axes.set(r.axis,[]);axes.get(r.axis).push(r);}
 const availableAxes=new Set(sourcePositions.map(r=>r.axis));
 const global=scope==='overall';
 let minAxes=0,minQuestions=3;
 if(global){minAxes=profile.kind==='Overall ideology'?6:8;minQuestions=profile.kind==='Overall ideology'?12:12;}
 else if(scope==='AI outlook')minQuestions=3;
 else minQuestions=4;
 const spread=a=>[3,4,5,6,7].some(i=>a.has(i))&&[0,1,2,10].some(i=>a.has(i))&&[8,9].some(i=>a.has(i));
 const availableEligible=sourcePositions.length>=minQuestions&&(!global||(availableAxes.size>=minAxes&&spread(availableAxes)));
 const eligible=availableEligible&&compared.length>=minQuestions&&(!global||(axes.size>=minAxes&&spread(new Set(axes.keys()))));
 // Overall comparisons retain equal axis weights. Economics is a focused field:
 // each supported item has equal weight except the Q100 emphasis, so Q83 cannot become a third
 // of the field merely because it comes from the territorial axis.
 const groups=scope==='Economics'?(compared.length?[compared]:[]):[...axes.values()];
 const aggregate=key=>{const scores=groups.map(items=>items.reduce((sum,x)=>sum+x[key]*x.weight,0)/items.reduce((sum,x)=>sum+x.weight,0));return scores.length?100*scores.reduce((sum,x)=>sum+x,0)/scores.length:null;};
 const unpenalizedRaw=aggregate('similarity'),conflicts=keyPolicyConflicts(compared,scope),conflictPenalty=conflicts.reduce((sum,x)=>sum+x.penalty,0);
 const adjusted=value=>value===null?null:Math.max(0,value-conflictPenalty);
 const policyRaw=adjusted(unpenalizedRaw);let raw=policyRaw,scoreLow=adjusted(aggregate('lower')),scoreHigh=adjusted(aggregate('upper')),religion=null;
 const iq=questions.find(q=>q.identity===true&&q.id==='Q102'),ia=iq?answerFor(answers,iq.id,questions.indexOf(iq)):null;
 const affiliation=root.CIVIC_AFFILIATIONS?.profiles.find(p=>p.id===profile.id);
 const religionScope=profile.kind==='Political personality'&&['overall','Theology','Social','Church–state arrangements'].includes(scope);
 if(religionScope&&Number.isInteger(ia)&&ia>=0&&ia<7&&raw!==null&&affiliation&&isSupported(affiliation,affiliation.position)){
  const options=accepted(iq,affiliation.position),fit=options.includes(ia)?1:0,weight=.3;
  if(options.length){religion={question:iq,answer:ia,options,position:affiliation.position,sources:affiliation.sources,weight,fit};raw=(1-weight)*raw+weight*100*fit;scoreLow=(1-weight)*scoreLow+weight*100*fit;scoreHigh=(1-weight)*scoreHigh+weight*100*fit;}
 }
 const agreements=compared.filter(r=>r.similarity>=.875).sort((a,b)=>b.weight-a.weight||b.similarity-a.similarity).slice(0,2);
 const differences=compared.filter(r=>r.similarity<=.5).sort((a,b)=>a.similarity-b.similarity||b.weight-a.weight).slice(0,1);
 return {profile,scope,policyRaw,unpenalizedRaw,conflicts,conflictPenalty,religion,score:raw===null?null:Math.round(raw),raw,scoreLow:scoreLow===null?null:Math.round(scoreLow),scoreHigh:scoreHigh===null?null:Math.round(scoreHigh),items:compared,comparedIds:compared.map(x=>x.id),eligible,availableEligible,compared:compared.length,available:sourcePositions.length,axes:axes.size,availableAxes:availableAxes.size,total:ids.length,inferred:compared.filter(x=>x.position.basis==='inferred').length,agreements,differences,reason:!availableEligible?'The researched profile does not yet meet this comparison’s coverage requirement.':!eligible?'More substantive answers are needed for this comparison.':null};
}
function rank(profiles,answers,questions,scope='overall',limit=8){return profiles.filter(p=>!p.retired).map(p=>scoreProfile(p,answers,questions,scope)).filter(x=>x?.eligible).sort((a,b)=>b.raw-a.raw||b.compared-a.compared||a.profile.name.localeCompare(b.profile.name)).slice(0,limit);}
// Diagnostic only: compare two eligible profiles on identical answered evidence.
// Never changes rank or fills unknown answers, and cannot establish a full match.
function sharedComparison(a,b,answers,questions,scope='overall'){
 const ra=scoreProfile(a,answers,questions,scope),rb=scoreProfile(b,answers,questions,scope);
 const common=ra.comparedIds.filter(id=>rb.comparedIds.includes(id));
 const masked=Object.fromEntries(questions.map((q,i)=>[q.id,common.includes(q.id)?answerFor(answers,q.id,i):null]));
 const left=scoreProfile(a,masked,questions,scope),right=scoreProfile(b,masked,questions,scope);
 return {count:common.length,ids:common,left:left.score,right:right.score,sufficient:common.length>=4};
}
const api={KEY_CONFLICT_RULES,keyPolicyConflicts,sharedComparison,VERSION,FIELDS,FIELD_AXES,isAIQuestion,scopeIds,answerFor,distance,accepted,isSupported,scoreProfile,rank};root.CivicMatching=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

