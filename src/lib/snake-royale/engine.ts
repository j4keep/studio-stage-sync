import { GRID_H, GRID_W, JungleMap, TILE, WORLD_H, WORLD_W, buildJungle, idx, mulberry32, walkable, type AnimalKind, type WeaponKind } from "./map";
import { DEN_AWARENESS_RANGE, EMERGE_DURATION, ImpactHazard, MAX_ACTIVE_IMPACTS, MAX_ACTIVE_SNAKES, RETREAT_DURATION, SNAKE_R, STRIKE_LOSE_RANGE, STRIKE_LUNGE, STRIKE_RANGE, STRIKE_WINDUP, SnakeHazard, WANDER_RADIUS, WAVES, WAVE_MS, branchInterval, denCooldown, isCrocWater, isMud, rockInterval, spawnImpact, spawnSnake, waveFor } from "./hazards";

export const RUN_MS = 240_000;
export const MAX_HEARTS = 3;
export const PLAYER_R = 15;
const BASE_SPEED = 205, JEEP_SPEED = 330, MUD_SPEED_MUL=.6, ACCEL=12, SNAKE_WANDER_SPEED=86;

export type SnakeEvent = "star"|"heart"|"hiss"|"strike"|"hit"|"splash"|"mud"|"rock"|"branch"|"warn"|"wave"|"objective"|"timer"|"weapon"|"attack"|"animal"|"jeep"|"escape";
export type SnakeAnim = "idle"|"run"|"hit"|"wade"|"celebrate";
export type Star={x:number;y:number;taken:boolean;respawn:number};
export type Objective={id:string;label:string;target:number;progress:number;done:boolean};
export type SnakeInput={mx:number;my:number;attack?:boolean};
export const NO_INPUT:SnakeInput={mx:0,my:0,attack:false};
export type AnimalHazard={id:number;kind:AnimalKind;x:number;y:number;homeX:number;homeY:number;vx:number;vy:number;roam:number;cooldown:number;stunned:number};
export type Pickup={x:number;y:number;kind:WeaponKind;taken:boolean};

export type SnakeRoyaleState={
  map:JungleMap;rnd:()=>number;t:number;timeLeft:number;endless:boolean;status:"alive"|"survived"|"over";
  hearts:number;invuln:number;stars:number;score:number;dodged:number;streak:number;bestStreak:number;wave:number;waveFlash:number;
  x:number;y:number;vx:number;vy:number;safeX:number;safeY:number;facing:1|-1;anim:SnakeAnim;
  snakes:SnakeHazard[];impacts:ImpactHazard[];animals:AnimalHazard[];pickups:Pickup[];weapon:WeaponKind|null;weaponUses:number;attackCooldown:number;driving:boolean;
  denCooldowns:number[];starList:Star[];objectives:Objective[];nextRock:number;nextBranch:number;thornCooldown:number;crocTimer:number;events:SnakeEvent[];toast:{text:string;t:number}|null;
};

const OBJECTIVE_POOL=[
  {id:"stars10",label:"Collect 10 jungle relics",target:10},{id:"temple",label:"Reach the jungle ruins",target:1},{id:"bridge",label:"Cross the river",target:1},
  {id:"weapon",label:"Find a defense tool",target:1},{id:"jeep",label:"Reach the abandoned jeep",target:1}
];

export function initialSnakeRoyale(seed=Math.floor(Math.random()*1_000_000),endless=false):SnakeRoyaleState{
  const map=buildJungle(20260822),rnd=mulberry32(seed);
  const objectives=OBJECTIVE_POOL.slice(0,3).map(o=>({...o,progress:0,done:false}));
  return {map,rnd,t:0,timeLeft:RUN_MS,endless,status:"alive",hearts:MAX_HEARTS,invuln:0,stars:0,score:0,dodged:0,streak:0,bestStreak:0,wave:1,waveFlash:2.6,
    x:map.spawn.x,y:map.spawn.y,vx:0,vy:0,safeX:map.spawn.x,safeY:map.spawn.y,facing:1,anim:"idle",snakes:[],impacts:[],
    animals:map.animalSpots.map((a,i)=>({id:i+1,kind:a.kind,x:a.x,y:a.y,homeX:a.x,homeY:a.y,vx:0,vy:0,roam:a.roam,cooldown:0,stunned:0})),
    pickups:map.weaponSpots.map(p=>({...p,taken:false})),weapon:null,weaponUses:0,attackCooldown:0,driving:false,
    denCooldowns:map.denSpots.map((_,i)=>(i%5)*.5),starList:map.starSpots.map(s=>({...s,taken:false,respawn:0})),objectives,nextRock:4,nextBranch:3,thornCooldown:0,crocTimer:0,events:[],toast:null};
}

export function step(st:SnakeRoyaleState,input:SnakeInput,dtMs:number):SnakeRoyaleState{
  if(st.status!=="alive")return st; const dt=Math.min(.05,dtMs/1000); st.events=[];st.t+=dt;
  if(!st.endless)st.timeLeft=Math.max(0,st.timeLeft-dtMs);
  const wave=waveFor(st.t*1000);if(wave!==st.wave){st.wave=wave;st.waveFlash=2.5;st.events.push("wave");}
  st.waveFlash=Math.max(0,st.waveFlash-dt);st.invuln=Math.max(0,st.invuln-dt);st.attackCooldown=Math.max(0,st.attackCooldown-dt);if(st.toast){st.toast.t-=dt;if(st.toast.t<=0)st.toast=null;}
  movePlayer(st,input,dt); if(input.attack) doAttack(st); tickDens(st,dt);tickSnakes(st,dt);tickAnimals(st,dt);tickImpacts(st,dt,wave);tickPickups(st);tickStars(st,dt);tickObjectives(st);tickJeep(st);
  st.score=Math.floor(st.t)*10+st.stars*120+st.dodged*30+(st.weapon?250:0)+(st.driving?500:0);
  if(st.hearts<=0)st.status="over"; else if(!st.endless&&st.timeLeft<=0)st.status="over";
  return st;
}

function movePlayer(st:SnakeRoyaleState,input:SnakeInput,dt:number){const mag=Math.hypot(input.mx,input.my),mud=isMud(st.map,st.x,st.y),speed=(st.driving?JEEP_SPEED:BASE_SPEED)*(mud&&!st.driving?MUD_SPEED_MUL:1);let tx=0,ty=0;if(mag>.08){const n=Math.min(1,mag);tx=input.mx/mag*n*speed;ty=input.my/mag*n*speed;}st.vx+=(tx-st.vx)*Math.min(1,ACCEL*dt);st.vy+=(ty-st.vy)*Math.min(1,ACCEL*dt);if(Math.abs(st.vx)>6)st.facing=st.vx>0?1:-1;slide(st,st.vx*dt,0);slide(st,0,st.vy*dt);if(!isCrocWater(st.map,st.x,st.y)){st.safeX=st.x;st.safeY=st.y;}const moving=Math.hypot(st.vx,st.vy)>26;st.anim=st.invuln>.75?"hit":mud&&!st.driving?(moving?"wade":"idle"):(moving?"run":"idle");}
function slide(st:SnakeRoyaleState,dx:number,dy:number){const nx=st.x+dx,ny=st.y+dy;if(!blocked(st,nx,ny)){st.x=Math.max(PLAYER_R,Math.min(WORLD_W-PLAYER_R,nx));st.y=Math.max(PLAYER_R,Math.min(WORLD_H-PLAYER_R,ny));}else{if(dx)st.vx*=.2;if(dy)st.vy*=.2;}}
function blocked(st:SnakeRoyaleState,x:number,y:number){for(const [ox,oy] of [[10,0],[-10,0],[0,9],[0,-9]])if(!walkable(st.map,x+ox,y+oy))return true;for(const p of st.map.props)if(p.solid>0&&Math.hypot(x-p.x,y-p.y)<p.solid*.8+8)return true;return false;}

function tickDens(st:SnakeRoyaleState,dt:number){const capacity=Math.min(MAX_ACTIVE_SNAKES,2+st.wave);for(let i=0;i<st.denCooldowns.length;i++)st.denCooldowns[i]=Math.max(0,st.denCooldowns[i]-dt);if(st.snakes.length>=capacity)return;for(let i=0;i<st.map.denSpots.length;i++){if(st.denCooldowns[i]>0||st.snakes.some(s=>s.denIndex===i))continue;const d=st.map.denSpots[i],dd=Math.hypot(st.x-d.x,st.y-d.y);if(dd>DEN_AWARENESS_RANGE*1.2||dd<40)continue;st.snakes.push(spawnSnake(d,i));st.events.push("hiss");if(st.snakes.length>=capacity)break;}}
function tickSnakes(st:SnakeRoyaleState,dt:number){for(const sn of st.snakes){sn.t+=dt;const dp=Math.hypot(st.x-sn.x,st.y-sn.y);if(sn.state==="emerging"){if(sn.t>=EMERGE_DURATION){sn.state="active";sn.t=0;pick(sn,st.rnd);}continue;}if(sn.state==="active"){const targetPlayer=dp<190;const tx=targetPlayer?st.x:sn.wanderTx,ty=targetPlayer?st.y:sn.wanderTy;if(!targetPlayer&&Math.hypot(tx-sn.x,ty-sn.y)<8)pick(sn,st.rnd);const a=Math.atan2(ty-sn.y,tx-sn.x);sn.x+=Math.cos(a)*SNAKE_WANDER_SPEED*dt;sn.y+=Math.sin(a)*SNAKE_WANDER_SPEED*dt;sn.angle=a;if(dp<STRIKE_RANGE){sn.state="striking";sn.t=0;sn.angle=Math.atan2(st.y-sn.y,st.x-sn.x);st.events.push("hiss");}else if(dp>DEN_AWARENESS_RANGE*1.35){sn.state="retreating";sn.t=0;}continue;}if(sn.state==="striking"){if(sn.t>=STRIKE_WINDUP&&sn.t<STRIKE_WINDUP+STRIKE_LUNGE){const sp=(STRIKE_RANGE*1.5)/STRIKE_LUNGE;sn.x+=Math.cos(sn.angle)*sp*dt;sn.y+=Math.sin(sn.angle)*sp*dt;if(!sn.hitPlayer&&Math.hypot(st.x-sn.x,st.y-sn.y)<SNAKE_R+PLAYER_R){sn.hitPlayer=true;damage(st);}}else if(sn.t>=STRIKE_WINDUP+STRIKE_LUNGE){sn.hitPlayer=false;sn.state=dp<STRIKE_LOSE_RANGE?"active":"retreating";sn.t=0;if(sn.state==="active")pick(sn,st.rnd);}continue;}if(sn.state==="retreating"){const a=Math.atan2(sn.denY-sn.y,sn.denX-sn.x),d=Math.hypot(sn.denX-sn.x,sn.denY-sn.y);sn.angle=a;sn.x+=Math.cos(a)*SNAKE_WANDER_SPEED*1.3*dt;sn.y+=Math.sin(a)*SNAKE_WANDER_SPEED*1.3*dt;if(d<5||sn.t>RETREAT_DURATION*3){st.denCooldowns[sn.denIndex]=denCooldown(st.wave,st.rnd);sn.t=-1;}}}st.snakes=st.snakes.filter(s=>s.t>=0);}
function pick(sn:SnakeHazard,rnd:()=>number){const a=rnd()*Math.PI*2,r=rnd()*WANDER_RADIUS;sn.wanderTx=sn.denX+Math.cos(a)*r;sn.wanderTy=sn.denY+Math.sin(a)*r;}

function tickAnimals(st:SnakeRoyaleState,dt:number){for(const a of st.animals){a.cooldown=Math.max(0,a.cooldown-dt);a.stunned=Math.max(0,a.stunned-dt);if(a.stunned>0)continue;const dp=Math.hypot(st.x-a.x,st.y-a.y);let speed=a.kind==="jaguar"?125:a.kind==="boar"?105:a.kind==="croc"?72:62;let tx=a.homeX+Math.sin(st.t*.7+a.id)*a.roam*.45,ty=a.homeY+Math.cos(st.t*.55+a.id)*a.roam*.35;if(dp<(a.kind==="jaguar"?230:150)){tx=st.x;ty=st.y;}const ang=Math.atan2(ty-a.y,tx-a.x);a.vx=Math.cos(ang)*speed;a.vy=Math.sin(ang)*speed;a.x+=a.vx*dt;a.y+=a.vy*dt;if(dp<(a.kind==="jaguar"?30:28)&&a.cooldown<=0&&!st.driving){a.cooldown=1.6;st.events.push("animal");damage(st);}}
}
function tickPickups(st:SnakeRoyaleState){for(const p of st.pickups){if(!p.taken&&Math.hypot(st.x-p.x,st.y-p.y)<35){p.taken=true;st.weapon=p.kind;st.weaponUses=p.kind==="stick"?99:p.kind==="repellent"?5:3;st.events.push("weapon");announce(st,p.kind==="stick"?"Found a jungle staff — ATTACK is ready":p.kind==="flare"?"Found flares — scare predators away":"Snake repellent equipped");}}}
function doAttack(st:SnakeRoyaleState){if(st.attackCooldown>0||!st.weapon||st.weaponUses<=0||st.driving)return;st.attackCooldown=.55;if(st.weapon!=="stick")st.weaponUses--;st.events.push("attack");let hits=0;st.snakes.forEach(s=>{if(Math.hypot(st.x-s.x,st.y-s.y)<92){s.state="retreating";s.t=0;hits++;}});st.animals.forEach(a=>{if(Math.hypot(st.x-a.x,st.y-a.y)<105){a.stunned=st.weapon==="flare"?4:2;a.vx*=.2;a.vy*=.2;hits++;}});if(st.weaponUses<=0)st.weapon=null;if(hits)announce(st,`${hits} jungle threat${hits>1?"s":""} driven back!`);}
function tickJeep(st:SnakeRoyaleState){if(!st.driving&&Math.hypot(st.x-st.map.jeep.x,st.y-st.map.jeep.y)<st.map.jeep.r){st.driving=true;st.events.push("jeep");announce(st,"JEEP STARTED — DRIVE TO THE EXTRACTION ROAD!");}if(st.driving&&Math.hypot(st.x-st.map.exit.x,st.y-st.map.exit.y)<st.map.exit.r){st.status="survived";st.anim="celebrate";st.events.push("escape");}}

function tickImpacts(st:SnakeRoyaleState,dt:number,wave:number){st.nextRock-=dt;if(st.nextRock<=0){st.nextRock=rockInterval(wave);if(st.impacts.length<MAX_ACTIVE_IMPACTS){const h=spawnImpact(st.map,"rock",st.rnd);if(h)st.impacts.push(h);}}st.nextBranch-=dt;if(st.nextBranch<=0){st.nextBranch=branchInterval(wave);if(st.impacts.length<MAX_ACTIVE_IMPACTS){const h=spawnImpact(st.map,"branch",st.rnd);if(h)st.impacts.push(h);}}for(const h of st.impacts){if(!h.impacted){h.warn-=dt;if(h.warn<=0){h.impacted=true;if(Math.hypot(st.x-h.x,st.y-h.y)<h.radius&&!st.driving)damage(st);else st.dodged++;}}else h.age+=dt;}st.impacts=st.impacts.filter(h=>!h.impacted||h.age<.7);}
function tickStars(st:SnakeRoyaleState,dt:number){for(const s of st.starList){if(s.taken){s.respawn-=dt;if(s.respawn<=0)s.taken=false;}else if(Math.hypot(st.x-s.x,st.y-s.y)<31){s.taken=true;s.respawn=30;st.stars++;st.events.push("star");}}}
function tickObjectives(st:SnakeRoyaleState){for(const o of st.objectives){if(o.done)continue;if(o.id==="stars10")o.progress=st.stars;else if(o.id==="temple"&&Math.hypot(st.x-st.map.temple.x,st.y-st.map.temple.y)<st.map.temple.r)o.progress=1;else if(o.id==="bridge"&&st.map.bridgeTiles.includes(idx(Math.floor(st.x/TILE),Math.floor(st.y/TILE))))o.progress=1;else if(o.id==="weapon"&&st.weapon)o.progress=1;else if(o.id==="jeep"&&st.driving)o.progress=1;if(o.progress>=o.target){o.done=true;st.events.push("objective");announce(st,`Checkpoint — ${o.label}`);}}}
function damage(st:SnakeRoyaleState){if(st.invuln>0||st.driving)return false;st.hearts=Math.max(0,st.hearts-1);st.invuln=1.5;st.streak=0;st.anim="hit";st.events.push("hit");return true;}
function announce(st:SnakeRoyaleState,text:string){st.toast={text,t:2.4};}
export function waveLabel(st:SnakeRoyaleState){return WAVES[Math.min(WAVES.length,st.wave)-1]??WAVES[0];}
export function waveProgress(st:SnakeRoyaleState){return ((st.t*1000)%WAVE_MS)/WAVE_MS;}
export {TILE,WORLD_H,WORLD_W,GRID_W,GRID_H};
