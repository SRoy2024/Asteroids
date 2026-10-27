import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { addPlayer, advanceWorld, arenaStep, makeWorld, snapshot } from '../lib/arena/engine.ts';
import { sqlite } from './d1-test-env.mjs';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'cloudflare:workers') return {url:new URL('./d1-test-env.mjs',import.meta.url).href,shortCircuit:true};
  if (specifier.startsWith('@/')) return {url:new URL('../'+specifier.slice(2)+'.ts',import.meta.url).href,shortCircuit:true};
  if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) { const candidate=new URL(specifier+'.ts',context.parentURL); if(existsSync(candidate))return {url:candidate.href,shortCircuit:true}; }
  return next(specifier,context);
} });
const {POST:join}=await import('../app/api/arena/join/route.ts');
const {POST:sync}=await import('../app/api/arena/sync/route.ts');
const {POST:leave}=await import('../app/api/arena/leave/route.ts');
const {GET:board}=await import('../app/api/arena/leaderboard/route.ts');
function player(w,id='one',now=0){return addPlayer(w,{id,pilot:'pilot-'+id,tokenHash:'secret',name:id,color:0},now);}
async function call(handler,path,data,cookie=''){
  const res=await handler(new Request('https://arena.test'+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',Origin:'https://arena.test',Cookie:cookie},...(data?{body:JSON.stringify(data)}:{})}));
  return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]??cookie};
}
test('pickups grow trails, boosting spends energy, and snapshots conceal credentials',()=>{
  const w=makeWorld(3,0),p=player(w);p.x=1000;p.y=800;p.angle=0;p.target=0;p.shieldUntil=0;
  w.orbs=[{id:999,x:1007,y:800,value:20,color:1}];arenaStep(w);assert.equal(p.energy,20);
  arenaStep(w);assert.ok(p.trail.length>14);p.boost=true;
  while(w.tick%4!==3){w.orbs=[];arenaStep(w);}
  w.orbs=[];const before=p.energy,x=p.x;arenaStep(w);assert.equal(p.energy,before-1);assert.ok(p.x-x>10);
  const visible=snapshot(w,'ABC234',p.id).players[0];assert.equal('tokenHash'in visible,false);assert.equal('pilot'in visible,false);assert.equal('lastSeen'in visible,false);
});
test('rival trail collisions award eliminations and disconnects remove active pilots',()=>{
  const w=makeWorld(10,5000),a=player(w,'one',0),b=player(w,'two',0);
  a.x=800;a.y=800;a.angle=0;a.target=0;a.shieldUntil=0;
  b.x=1400;b.y=1100;b.angle=0;b.target=0;b.shieldUntil=0;
  b.trail=Array.from({length:14},()=>({x:807,y:800}));arenaStep(w);
  assert.equal(a.alive,false);assert.equal(b.kills,1);assert.match(a.cause,/trail/);
  advanceWorld(w,20000);assert.equal(b.alive,false);assert.match(b.cause,/connection/);
});
test('two independent clients share one room and cannot submit position or energy',async()=>{
  mock.timers.enable({apis:['Date'],now:1_800_000_000_000});
  try{
    const a=await call(join,'/api/arena/join',{name:'Alpha',color:0,newRoom:true});assert.equal(a.status,201);assert.match(a.data.room,/^[A-Z0-9]{6}$/);
    const b=await call(join,'/api/arena/join',{name:'Bravo',color:2,room:a.data.room});assert.equal(b.status,201);assert.notEqual(a.data.id,b.data.id);
    assert.equal(b.data.world.population,2);assert.ok(b.data.world.players.some(p=>p.name==='Alpha'));
    assert.ok(b.data.world.players.every(p=>!('tokenHash'in p)&&!('pilot'in p)));
    const credentialsA={id:a.data.id,token:a.data.token,room:a.data.room},credentialsB={id:b.data.id,token:b.data.token,room:b.data.room};
    mock.timers.tick(400);
    const nextA=await call(sync,'/api/arena/sync',{...credentialsA,seq:0,angle:0,turn:0,boost:false,energy:999999,x:0},a.cookie);
    assert.equal(nextA.status,200);assert.equal(nextA.data.world.population,2);assert.ok(nextA.data.world.players.find(p=>p.id===a.data.id).energy<999999);
    const nextB=await call(sync,'/api/arena/sync',{...credentialsB,seq:0,angle:1,turn:0,boost:false},b.cookie);assert.equal(nextB.status,200);
    assert.equal(nextB.data.world.tick,nextA.data.world.tick);
    assert.equal((await call(sync,'/api/arena/sync',{...credentialsA,token:b.data.token,seq:1,angle:0,turn:0,boost:false},a.cookie)).status,410);
    assert.equal((await call(sync,'/api/arena/sync',{...credentialsA,seq:1,angle:'Infinity',turn:0,boost:false},a.cookie)).status,400);
    // Inject pickups only into the isolated test database, then let real server physics award them.
    const row=sqlite.prepare('SELECT state FROM arena_rooms WHERE id=?').get(a.data.room);const w=JSON.parse(row.state),hero=w.players.find(p=>p.id===a.data.id);
    w.orbs.push({id:99999,x:hero.x+Math.cos(hero.angle)*6.5,y:hero.y+Math.sin(hero.angle)*6.5,value:40,color:0});
    sqlite.prepare('UPDATE arena_rooms SET state=? WHERE id=?').run(JSON.stringify(w),a.data.room);
    mock.timers.tick(400);const grown=await call(sync,'/api/arena/sync',{...credentialsA,seq:1,angle:0,turn:0,boost:false},a.cookie);assert.equal(grown.status,200);
    const energy=grown.data.world.players.find(p=>p.id===a.data.id).energy;assert.ok(energy>=40);
    assert.equal((await call(leave,'/api/arena/leave',credentialsA,a.cookie)).status,200);
    assert.equal((await call(leave,'/api/arena/leave',credentialsA,a.cookie)).status,200);
    assert.equal(sqlite.prepare('SELECT count(*) AS total FROM arena_scores WHERE id=?').get(a.data.id).total,1);
    const records=await call(board,'/api/arena/leaderboard',undefined,a.cookie);assert.equal(records.data.entries[0].name,'Alpha');assert.equal(records.data.entries[0].score,energy);
    mock.timers.tick(11000);
    const timeout=await call(sync,'/api/arena/sync',{...credentialsB,seq:1,angle:0,turn:0,boost:false},b.cookie);assert.equal(timeout.status,200);assert.equal(timeout.data.world.population,0);
    assert.equal(timeout.data.world.players.find(p=>p.id===b.data.id).alive,false);
    mock.timers.tick(8*86400000);assert.equal((await call(board,'/api/arena/leaderboard?period=week',undefined,a.cookie)).data.entries.length,0);
  }finally{mock.timers.reset();}
});

test('concurrent joins preserve every player and full rooms enforce capacity',async()=>{
  const host=await call(join,'/api/arena/join',{name:'Host',color:0,newRoom:true});assert.equal(host.status,201);
  const peers=await Promise.all(Array.from({length:4},(_,i)=>call(join,'/api/arena/join',{name:'Peer '+i,color:i,room:host.data.room})));
  assert.ok(peers.every(p=>p.status===201));
  let row=sqlite.prepare('SELECT state FROM arena_rooms WHERE id=?').get(host.data.room);
  assert.equal(JSON.parse(row.state).players.filter(p=>p.alive).length,5);
  for(let i=0;i<3;i++)assert.equal((await call(join,'/api/arena/join',{name:'Extra '+i,color:i,room:host.data.room})).status,201);
  assert.equal((await call(join,'/api/arena/join',{name:'Overflow',color:1,room:host.data.room})).status,409);
  row=sqlite.prepare('SELECT state FROM arena_rooms WHERE id=?').get(host.data.room);
  assert.equal(JSON.parse(row.state).players.filter(p=>p.alive).length,8);
});
