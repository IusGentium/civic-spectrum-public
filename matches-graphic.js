(function(root){
'use strict';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function lines(name){const words=name.split(/\s+/),rows=[];let row='';for(const word of words){if(row&&row.length+word.length>22){rows.push(row);row='';}row+=(row?' ':'')+word;}if(row)rows.push(row);return rows;}
async function build(groups,options){
 const images=new Map(),credits=[];
 await Promise.all([...new Set(groups.flatMap(g=>g.rows.map(r=>r.profile.id)))].map(async id=>{const p=options.portraits[id];if(!p)return;try{const response=await fetch(p.src);if(!response.ok)return;const blob=await response.blob();const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});images.set(id,data);credits.push({id,credit:p.credit,license:p.license,licenseUrl:p.licenseUrl,sourceUrl:p.sourceUrl,changes:'Cropped for card; '+(p.changes??'')});}catch{/* Missing portraits use a monogram. */}}));
 const width=1320,cardWidth=294,cardHeight=278,gap=24,pad=36;let y=130,body='';
 for(const group of groups){body+=`<text x="${pad}" y="${y}" font-size="25" font-weight="700">${escape(group.name)}</text>`;y+=26;
  if(!group.rows.length){body+=`<text x="${pad}" y="${y+30}" font-size="20">—</text>`;y+=65;continue;}
  group.rows.forEach((r,i)=>{const x=pad+(i%4)*(cardWidth+gap),top=y+Math.floor(i/4)*(cardHeight+gap),id='portrait-'+y+'-'+i,name=options.name(r.profile),text=lines(name),image=images.get(r.profile.id),initials=name.split(/\s+/).slice(0,2).map(s=>s[0]).join('');body+=`<rect x="${x}" y="${top}" width="${cardWidth}" height="${cardHeight}" rx="18" fill="#fffdf8"/><circle cx="${x+147}" cy="${top+82}" r="57" fill="#dce7de"/>`;
   if(image)body+=`<defs><clipPath id="${id}"><circle cx="${x+147}" cy="${top+82}" r="57"/></clipPath></defs><image href="${escape(image)}" x="${x+90}" y="${top+25}" width="114" height="114" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`;
   else body+=`<text x="${x+147}" y="${top+95}" text-anchor="middle" font-size="35" fill="#276c62">${escape(initials)}</text>`;
   if(r.field)body+=`<text x="${x+147}" y="${top+161}" text-anchor="middle" font-size="14" fill="#677a70">${escape(r.field)}</text>`;
   text.forEach((line,j)=>{body+=`<text x="${x+147}" y="${top+185+j*21}" text-anchor="middle" font-size="18" font-weight="600">${escape(line)}</text>`;});
   body+=`<text x="${x+147}" y="${top+259}" text-anchor="middle" font-size="28" font-weight="700" fill="#276c62">${r.equalization?r.equalization.rankingScore:r.score}%</text>`;
  });y+=Math.ceil(group.rows.length/4)*(cardHeight+gap)+30;
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}" viewBox="0 0 ${width} ${y}"><title>Civic Spectrum matches</title><metadata>${escape(JSON.stringify({rankingMode:options.temporary?'temporary equalization':'documented similarity',portraitCredits:credits}))}</metadata><rect width="100%" height="100%" fill="#f3f3ea"/><g fill="#183b35" font-family="Arial, sans-serif"><text x="36" y="55" font-size="17" letter-spacing="3">CIVIC SPECTRUM</text><text x="36" y="94" font-size="30" font-weight="700">${options.temporary?'My matches · temporary ranking':'My matches'}</text>${body}</g></svg>`;
}
async function download(groups,options){
 const svg=await build(groups,options),svgUrl=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
 try{
  const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Could not render graphic'));img.src=svgUrl;});
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const context=canvas.getContext('2d');if(!context)throw new Error('Canvas unavailable');context.drawImage(image,0,0);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG export failed')),'image/png'));
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='civic-spectrum-matches.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }finally{URL.revokeObjectURL(svgUrl);}
}
root.CivicMatchesGraphic={build,download};
})(window);
