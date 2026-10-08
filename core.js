(function(root){
'use strict';
class PlanError extends Error { constructor(message,detail={}) {super(message);this.detail=detail;} }
const integer=(n,label='數量')=>{n=Number(n);if(!Number.isSafeInteger(n)||n<0)throw new PlanError(label+'必須是非負整數');return n;};
const add=(m,k,q)=>{const value=(m.get(k)||0)+q;if(!Number.isSafeInteger(value)||value<0)throw new PlanError('數量超出可安全計算範圍');m.set(k,value);};
function createEngine(db){
 const items=new Map(db.items.map(x=>[x.id,x])), recipes=new Map(db.recipes.map(x=>[x.id,x]));
 const producers=new Map(),consumers=new Map();
 db.recipes.forEach(r=>{if(!producers.has(r.item))producers.set(r.item,[]);producers.get(r.item).push(r);r.materials.forEach(([id])=>{if(!consumers.has(id))consumers.set(id,[]);consumers.get(id).push(r);});});
 const name=id=>items.get(id)?.name||'待確認物品 #'+id;
 const signature=r=>JSON.stringify([r.yieldQty,r.materials.filter(([id])=>items.get(id)?.category!=='水晶').slice().sort((a,b)=>a[0]-b[0])]);
 function choose(id,preferences={},forced){
   let list=producers.get(id)||[];if(!list.length)return null;
   const selection=forced??preferences[id];
   if(selection!==undefined){const r=list.find(r=>r.id===Number(selection));if(!r)throw new PlanError(name(id)+'的配方選擇已失效');return r;}
   const safe=list.filter(r=>!r.quest&&!r.expert&&!r.specialist);
   if(!safe.length)throw new PlanError(name(id)+'需要確認特殊配方條件',{item:id,choices:list});
   if(new Set(safe.map(signature)).size>1)throw new PlanError(name(id)+'有不同材料或產量的配方，請選擇本次路線',{item:id,choices:safe});
   return safe.slice().sort((a,b)=>Number(b.tracked)-Number(a.tracked)||a.id-b.id)[0];
 }
 function normalize(targets){
  const out=new Map();for(const t of targets){const mode=t.mode||'craft';if(!['craft','completion','unlock'].includes(mode))throw new PlanError('不支援的目標種類');const key=mode==='unlock'?'unlock:'+integer(t.item):mode+':'+integer(t.recipe);const qty=integer(t.qty??1);if(!qty)continue;
   if(mode==='unlock'){if(!db.unlocks.some(u=>u.item===Number(t.item)))throw new PlanError('這個永久收藏尚未核對');out.set(key,{key,mode,item:Number(t.item),qty:1});}
   else{const r=recipes.get(Number(t.recipe));if(!r)throw new PlanError('找不到配方 #'+t.recipe);const old=out.get(key);out.set(key,{key,mode,item:r.item,recipe:r.id,qty:mode==='completion'?1:(old?.qty||0)+qty});}
  }return [...out.values()];
 }
 function solve(input,inventory={},preferences={}){
  const targets=normalize(input),reserved=new Map(),minimum=new Map(),forced=new Map(),chosen=new Map(),dependencies=new Map(),state=new Map(),order=[];
  for(const t of targets){if(t.mode==='completion')minimum.set(t.recipe,1);else {add(reserved,t.item,t.qty);if(t.mode==='craft'&&!minimum.has(t.recipe))minimum.set(t.recipe,0);}if(t.recipe&&!forced.has(t.item))forced.set(t.item,t.recipe);}
  const mandatoryByItem=new Map();for(const rid of minimum.keys()){const r=recipes.get(rid);if(!mandatoryByItem.has(r.item))mandatoryByItem.set(r.item,[]);mandatoryByItem.get(r.item).push(r);}
  function visit(id){if(state.get(id)===1)throw new PlanError('配方出現循環：'+name(id),{item:id,cycle:true});if(state.get(id)===2)return;state.set(id,1);
   const r=choose(id,preferences,forced.get(id));chosen.set(id,r);
   const rs=[...new Map([...(r?[r]:[]),...(mandatoryByItem.get(id)||[])].map(r=>[r.id,r])).values()];
   const children=[...new Set(rs.flatMap(r=>r.materials.filter(([id])=>items.get(id)?.category!=='水晶').map(([id])=>id)))];dependencies.set(id,children);children.forEach(visit);state.set(id,2);order.push(id);
  }
  targets.forEach(t=>visit(t.item));order.reverse();
  const materialIds=new Set([...dependencies.values()].flat());
  const pureTargets=new Set(targets.filter(t=>(t.mode==='craft'||t.mode==='completion')&&!materialIds.has(t.item)).map(t=>t.item));
  for(const t of targets){if(t.mode==='craft'&&pureTargets.has(t.item)){const r=recipes.get(t.recipe);minimum.set(r.id,Math.max(minimum.get(r.id)||0,Math.ceil(t.qty/r.yieldQty)));if(!mandatoryByItem.has(r.item))mandatoryByItem.set(r.item,[]);if(!mandatoryByItem.get(r.item).some(x=>x.id===r.id))mandatoryByItem.get(r.item).push(r);}}
  const demand=new Map(reserved),shares=[],incoming=new Map(),rows=[],crafts=[];
  for(const id of order){
   const need=demand.get(id)||0,stock=integer(inventory[id]||0,'庫存'),r=chosen.get(id),plans=new Map();
   for(const mr of mandatoryByItem.get(id)||[])plans.set(mr.id,minimum.get(mr.id)||0);
   let produced=[...plans].reduce((sum,[rid,n])=>sum+recipes.get(rid).yieldQty*n,0);
   const usedStock=pureTargets.has(id)?0:Math.min(stock,Math.max(0,need-produced));
   let gap=Math.max(0,need-produced-usedStock);
   if(gap&&r){const batches=Math.ceil(gap/r.yieldQty);add(plans,r.id,batches);produced+=batches*r.yieldQty;gap=0;}
   const uses=incoming.get(id)||[],direct=(reserved.get(id)||0)+uses.filter(s=>s.direct).reduce((sum,s)=>sum+s.qty,0);
   const row={item:id,need,reserve:reserved.get(id)||0,direct,conditional:need-direct,stock,usedStock,shortage:gap,produced,batches:[...plans.values()].reduce((a,b)=>a+b,0),surplus:Math.max(0,produced+usedStock-need),remaining:stock-usedStock+Math.max(0,produced+usedStock-need),pureTarget:pureTargets.has(id),plans:[...plans],uses};
   rows.push(row);
   for(const [rid,batches] of plans){if(!batches)continue;const recipe=recipes.get(rid);crafts.push({recipe:rid,item:id,batches,yieldQty:recipe.yieldQty,produced:batches*recipe.yieldQty,job:recipe.job});
    for(const [child,perBatch] of recipe.materials){if(items.get(child)?.category==='水晶')continue;const qty=perBatch*batches;add(demand,child,qty);const share={key:rid+':'+child,item:child,parent:id,recipe:rid,qty,output:recipe.yieldQty*batches,direct:pureTargets.has(id),gate:pureTargets.has(id)?null:id};shares.push(share);if(!incoming.has(child))incoming.set(child,[]);incoming.get(child).push(share);}
   }
  }
  // Rows are read after all parent shares have been generated; no render-time arithmetic.
  const active=rows.filter(r=>r.need||r.batches);
  for(const r of active){if(r.usedStock>r.stock||r.produced+r.usedStock+r.shortage<r.need)throw new PlanError('份額驗算失敗');if(r.direct+r.conditional!==r.need)throw new PlanError('直接／條件份額不守恆');}
  return {targets,rows:active,crafts:crafts.reverse(),shares,dependencies:Object.fromEntries(dependencies),chosen:Object.fromEntries([...chosen].map(([id,r])=>[id,r?.id||null])),pureTargets:[...pureTargets],raw:active.filter(r=>!chosen.get(r.item)&&r.need),inventoryAfter:Object.fromEntries(active.map(r=>[r.item,r.remaining]))};
 }
 function downstream(start,completion={}){
  start=integer(start);if(!items.has(start))throw new PlanError('找不到素材');
  const seenItems=new Set([start]),seenRecipes=new Set(),queue=[start];
  for(let i=0;i<queue.length;i++)for(const r of consumers.get(queue[i])||[]){seenRecipes.add(r.id);if(!seenItems.has(r.item)){seenItems.add(r.item);queue.push(r.item);}}
  const targets=[];
  for(const rid of [...seenRecipes].sort((a,b)=>a-b)){const r=recipes.get(rid);if(r.tracked)targets.push({key:'completion:'+rid,completionKey:'recipe_completion:'+rid,mode:'completion',recipe:rid,item:r.item,qty:1,done:completion['recipe_completion:'+rid]===true});}
  for(const u of db.unlocks){if(seenItems.has(u.item)&&u.item!==start)targets.push({key:'unlock:'+u.item,completionKey:'permanent_unlock:'+u.item,mode:'unlock',item:u.item,qty:1,done:completion['permanent_unlock:'+u.item]===true});}
  return {start,recipes:[...seenRecipes],items:[...seenItems],targets,pending:db.pendingUnlocks.filter(u=>seenItems.has(u.item)),coverage:db.provenance?.scope||'來源配方快照'};
 }
 return {items,recipes,producers,consumers,name,choose,normalize,solve,downstream,PlanError};
}
const api={createEngine,PlanError,integer};if(typeof module!=='undefined')module.exports=api;root.FF14Core=api;
})(globalThis);
