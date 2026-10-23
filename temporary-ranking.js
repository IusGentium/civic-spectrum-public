/* Temporary display ranking only. Set ENABLED=false to restore normal ranking. */
(function(root){
'use strict';
const ENABLED=false;
const VERSION='temporary-equalization-v1';
const M=root.CivicMatching;
function score(profile,answers,questions,scope='overall'){
 const normal=M.scoreProfile(profile,answers,questions,scope);
 if(!ENABLED||!normal)return normal;
 const ids=M.scopeIds(questions,scope),indices=new Map(questions.map((q,i)=>[q.id,i]));
 const compared=new Map(normal.items.map(item=>[item.id,item]));
 const groups=new Map();
 for(const q of questions){
  if(!ids.includes(q.id))continue;
  const a=M.answerFor(answers,q.id,indices.get(q.id));
  if(!Number.isInteger(a)||a<0||a>=(q.type==='scale'?5:q.options.length))continue;
  const item=compared.get(q.id);
  // Unknown evidence contributes a neutral ranking value, never a profile answer.
  // Inferences pull less far from neutral than explicit positions.
  const value=item?item.weight*(item.similarity-.5)+.5:.5;
  const key=scope==='overall'?q.axis:0;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(item?value:.5);
 }
 const means=[...groups.values()].map(g=>g.reduce((a,b)=>a+b,0)/g.length);
 let rankingRaw=means.length?100*means.reduce((a,b)=>a+b,0)/means.length:null;
 if(normal.religion&&rankingRaw!==null)rankingRaw=(1-normal.religion.weight)*rankingRaw+normal.religion.weight*100*normal.religion.fit;
 return {...normal,equalization:{version:VERSION,rankingRaw,rankingScore:rankingRaw===null?null:Math.round(rankingRaw),normalEligible:normal.eligible,answeredQuestions:[...groups.values()].reduce((n,g)=>n+g.length,0)},rankingEligible:normal.compared>0};
}
function rank(profiles,answers,questions,scope='overall',limit=8){
 if(!ENABLED)return M.rank(profiles,answers,questions,scope,limit);
 return profiles.map(p=>score(p,answers,questions,scope)).filter(r=>r?.rankingEligible).sort((a,b)=>b.equalization.rankingRaw-a.equalization.rankingRaw||a.profile.name.localeCompare(b.profile.name)).slice(0,limit);
}
function canRank(profile,answers,questions,scope){const r=score(profile,answers,questions,scope);return ENABLED?r?.rankingEligible===true:r?.eligible===true;}
root.CivicTemporaryRanking={ENABLED,VERSION,score,rank,canRank};
})(typeof window!=='undefined'?window:globalThis);
