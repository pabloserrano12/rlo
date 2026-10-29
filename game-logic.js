// Física autoritativa: reutiliza el código de física del cliente (extraído tal cual) usando three.js de npm.
const T=require('three');
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rnd=(a,b)=>a+Math.random()*(b-a);
const BODIES={
  octane:{name:'Octane',len:4.3,wid:2.5,h:.7,hood:1.6,cabZ:-.4,cabL:1.9,cabH:.65,spoiler:1,hy:.55,st:{acc:1,turn:1,pow:1,spd:1}},
  dominus:{name:'Dominus',len:4.7,wid:2.7,h:.55,hood:2,cabZ:-.8,cabL:1.6,cabH:.5,spoiler:0,hy:.5,st:{acc:1.03,turn:.93,pow:1.08,spd:1.02}},
  breakout:{name:'Breakout',len:4.8,wid:2.4,h:.5,hood:2.4,cabZ:-1,cabL:1.5,cabH:.45,spoiler:1,hy:.45,st:{acc:.97,turn:.92,pow:1.04,spd:1.05}},
  merc:{name:'Merc',len:4.2,wid:2.8,h:1,hood:1.2,cabZ:-.2,cabL:2.4,cabH:.8,spoiler:0,hy:.7,st:{acc:.94,turn:.95,pow:1.12,spd:.97}},
  hotshot:{name:'Hotshot',len:3.9,wid:2.5,h:.75,hood:1.2,cabZ:-.3,cabL:1.8,cabH:.6,spoiler:1,hy:.55,st:{acc:1.06,turn:1.1,pow:.95,spd:1}}
};
const BODY_KEYS=Object.keys(BODIES);
function create(teams){
const W=72,L=92,H=32,GW=13,GH=9,GD=13,BR0=2.3,CUT=9,KD=W+L-CUT,R2=Math.SQRT2;let G=16,BR=BR0;
const M={turbo:'normal',diff:1,ball:1},mode={};let shake=0;const events=[];
const emit=()=>{},beep=()=>{},boostCol=()=>[1,1,1],addFeed=(t,c)=>events.push({e:'feed',t,c}),addRing=p=>events.push({e:'boom',x:p.x,y:p.y,z:p.z});
const ballMat={emissive:{set(){}}},cars=[],pads=[];
const ball={pos:V(0,BR,0),vel:V(),w:V(),mesh:{position:V(),quaternion:new T.Quaternion(),scale:{set(){}}},lastTeam:null,lastCar:null,sh:{position:{set(){}},scale:{setScalar(){}}},trail:{clear(){}}};
const pad=(x,z,big)=>pads.push({x:x*W/56,z:z*L/70,big,t:0,glow:{visible:true}});
[[0,41.4],[17.5,40.9],[-17.5,40.9],[9.2,32.3],[-9.2,32.3],[0,27.5],[35,24.3],[-35,24.3],[17.5,22.5],[-17.5,22.5],[20,10.1],[-20,10.1],[0,10]].forEach(([x,z])=>{pad(x,z,false);pad(x,-z,false);});
pad(10,0,false);pad(-10,0,false);[[30,40],[-30,40],[30,-40],[-30,-40],[35,0],[-35,0]].forEach(([x,z])=>pad(x,z,true));
const UP=V(0,1,0),N_UP=V(0,1,0),N_DN=V(0,-1,0),N_XM=V(-1,0,0),N_XP=V(1,0,0),N_ZM=V(0,0,-1),N_ZP=V(0,0,1);
const N_C={'1,1':V(-1,0,-1).normalize(),'1,-1':V(-1,0,1).normalize(),'-1,1':V(1,0,-1).normalize(),'-1,-1':V(1,0,1).normalize()};
const qE=new T.Quaternion(),eu=new T.Euler(),mB=new T.Matrix4();
const CURV=[[0,.5],[6.8,.29],[13.6,.173],[20.4,.101],[23.8,.081],[31,.065],[38,.06]];
function curv(s){for(let k=1;k<CURV.length;k++)if(s<=CURV[k][0]){const a=CURV[k-1],b=CURV[k];return a[1]+(b[1]-a[1])*(s-a[0])/(b[0]-a[0]);}return .06;}
function sDist(p,n){if(n.x*n.z!==0)return KD/R2+n.x*p.x+n.z*p.z;
  return n.y>.5?p.y:n.y<-.5?H+n.y*p.y:Math.abs(n.x)>.5?W+n.x*p.x:L+n.z*p.z;}
function nearSurf(p){
  const a=[N_UP,N_DN,p.x>0?N_XM:N_XP];
  if(Math.abs(p.z)<L+.5&&(mode.hoops||Math.abs(p.x)>GW-.5||p.y>GH-.5))a.push(p.z>0?N_ZM:N_ZP);
  const sx=p.x>0?1:-1,sz=p.z>0?1:-1;if(sx*p.x+sz*p.z>KD-4&&Math.abs(p.z)<L+.3)a.push(N_C[sx+','+sz]);
  return a;
}
function setBasis(c){
  c.f.addScaledVector(c.n,-c.f.dot(c.n));if(c.f.lengthSq()<1e-6)c.f.set(0,0,1).addScaledVector(c.n,-c.n.z);c.f.normalize();
  mB.makeBasis(V().crossVectors(c.n,c.f),c.n,c.f);c.q.setFromRotationMatrix(mB);
}
function turnV(v,np,no){const vin=-v.dot(np);if(vin>0)return v.clone().addScaledVector(np,vin).addScaledVector(no,vin);return v.clone().addScaledVector(np,-v.dot(np));}
function placeCar(c,x,z,yaw){
  c.pos.set(x,.6,z);c.vel.set(0,0,0);c.n.set(0,1,0);c.f.set(Math.sin(yaw),0,Math.cos(yaw));c.onS=true;c.boost=33;c.jumps=0;c.spinT=0;c.dead=0;c.bob=c.bobV=0;
  c.mesh.visible=c.sh.visible=true;setBasis(c);c.mesh.position.copy(c.pos);c.mesh.quaternion.copy(c.q);c.trail.clear();
}
function respawn(c){placeCar(c,rnd(-10,10),c.team?L*.5:-L*.5,c.team?Math.PI:0);}
function demo(v,by){v.dead=3;v.mesh.visible=v.sh.visible=false;by.stats.d++;
  for(let k=0;k<70;k++)emit(v.pos,V(rnd(-14,14),rnd(-4,14),rnd(-14,14)),1,rnd(.3,.8),.1,rnd(.5,1.2),6);
  addRing(v.pos,0xffaa30,0);shake=Math.max(shake,.8);addFeed(by.name+' demolió a '+v.name,by.team?'#ff8a1e':'#2a7bff');beep(90,.5,.2);}
function stepCar(c,i,dt){
  if(c.dead>0){c.dead-=dt;if(c.dead<=0)respawn(c);return;}
  if(M.turbo==='inf')c.boost=100;const boosting=!!i.boost&&c.boost>0&&M.turbo!=='none',S=c.sp.st,skill=c.human?1:.86+.14*M.diff;c.bst=boosting;c.steerIn=i.steer;
  const maxN=26*S.spd*skill,maxB=42*S.spd*skill;
  if(c.onS){
    const n=c.n;let f=c.f;const l=V().crossVectors(n,f);
    let fs=c.vel.dot(f),ls=c.vel.dot(l);
    if(i.thr){const br=Math.sign(i.thr)!==Math.sign(fs)&&Math.abs(fs)>1;fs+=i.thr*(br?55:Math.max(2,26*S.acc*(1-Math.abs(fs)/maxN)))*dt;}else fs*=Math.exp(-.6*dt);
    if(boosting)fs+=42*S.acc*dt;
    if(fs>maxN&&!boosting)fs-=18*dt;
    fs=Math.max(-22,Math.min(fs,boosting?maxB:Math.max(maxN,fs)));
    ls*=Math.exp(-(i.slide?1.3:9)*dt);
    const as=Math.abs(fs),th=i.steer*(fs<0?-1:1)*Math.max(as,2.5)*curv(as)*S.turn*(i.slide?1.7:1)*Math.min(as/2,1)*dt;
    f=f.clone().multiplyScalar(Math.cos(th)).addScaledVector(l,Math.sin(th)).normalize();
    const l2=V().crossVectors(n,f);
    if(i.slide)fs*=Math.exp(-.25*dt);
    c.vel.copy(f).multiplyScalar(fs).addScaledVector(l2,ls);
    if(n.y<.99){const gd=-G*n.y;c.vel.x+=-gd*n.x*dt;c.vel.y+=(-G-gd*n.y)*dt;c.vel.z+=-gd*n.z*dt;}
    c.f.copy(f);c.wheel+=fs*dt/.58;
    if(i.slide&&Math.abs(ls)>3&&Math.abs(fs)>6)for(const sx of[-1,1])emit(c.pos.clone().addScaledVector(f,-1.3).addScaledVector(l2,sx*1.2).addScaledVector(n,-.45),V(rnd(-1,1),rnd(.5,2),rnd(-1,1)),.5,.5,.55,.7,0);
    if(i.jump){c.vel.addScaledVector(n,8.5);c.jumps=1;c.holdT=.2;c.jn.copy(n);c.onS=false;c.pos.addScaledVector(n,.05);}
    else if(n.y<-.5&&c.vel.length()<10)c.onS=false;
  }else{
    c.jumpT+=dt;
    if(c.holdT>0&&i.jumpHeld&&c.jumps===1){c.vel.addScaledVector(c.jn,24*dt);c.holdT-=dt;}else c.holdT=0;
    const roll=i.slide?-i.steer:i.roll,yw=i.slide?0:i.steer;
    if(c.spinT<=0){eu.set(i.thr*4.5*dt,yw*3.2*dt,roll*5*dt,'YXZ');qE.setFromEuler(eu);c.q.multiply(qE);}
    else{qE.setFromAxisAngle(c.spinAx,c.spinRate*dt);c.q.multiply(qE);c.spinT-=dt;}
    c.q.normalize();
    if(i.jump&&c.jumps===1&&c.jumpT<1.5){
      c.jumps=2;c.holdT=0;
      if(i.thr||i.steer){
        const f=V(0,0,1).applyQuaternion(c.q);f.y=0;if(f.lengthSq()<.01)f.set(c.f.x,0,c.f.z);if(f.lengthSq()<.01)f.set(0,0,1);f.normalize();
        const l=V(f.z,0,-f.x),d=f.multiplyScalar(i.thr).addScaledVector(l,i.steer).normalize();
        c.vel.addScaledVector(d,13);c.vel.y=Math.max(c.vel.y*.3,2.5);
        c.spinAx.set(i.thr,0,-i.steer).normalize();c.spinRate=Math.PI*4;c.spinT=.5;
      }else c.vel.addScaledVector(UP.clone().applyQuaternion(c.q),8.5);
      if(c.human)beep(300,.15,.05);
    }
    if(boosting)c.vel.addScaledVector(V(0,0,1).applyQuaternion(c.q),42*S.acc*dt);
    c.vel.y-=G*dt;c.vel.clampLength(0,50);
  }
  if(boosting){if(M.turbo!=='inf')c.boost=Math.max(0,c.boost-33.3*dt);
    const f=V(0,0,1).applyQuaternion(c.q),p=c.pos.clone().addScaledVector(f,-c.hit.z-.4),bc=boostCol(c.cfg,performance.now()/1000);
    for(let k=0;k<3;k++)emit(p,f.clone().multiplyScalar(-9).add(V(rnd(-1.5,1.5),rnd(-1.5,1.5),rnd(-1.5,1.5))).add(c.vel.clone().multiplyScalar(.3)),bc[0],bc[1],bc[2],.35,0);}
  c.pos.addScaledVector(c.vel,dt);
  if(c.onS){
    const n=c.n.clone();
    c.pos.addScaledVector(n,.6-sDist(c.pos,n));
    if(Math.abs(n.z)>.5&&n.x===0&&!mode.hoops&&Math.abs(c.pos.x)<GW-.5&&c.pos.y<GH-.5)c.onS=false;
    else for(const np of nearSurf(c.pos)){
      if(np.equals(n))continue;
      const d=sDist(c.pos,np),vn=c.vel.dot(np);
      if(d<1.2&&vn<-.5&&(c.wall||np.y>.5)){
        c.vel.copy(turnV(c.vel,np,n));const nf=turnV(c.f,np,n);if(nf.lengthSq()>1e-4)c.f.copy(nf.normalize());
        c.n.copy(np);c.pos.addScaledVector(np,.6-sDist(c.pos,np));break;
      }
      if(d<.62&&vn<0){c.pos.addScaledVector(np,.62-d);c.vel.addScaledVector(np,-vn*1.3);}
    }
  }else{
    const up=UP.clone().applyQuaternion(c.q);
    for(const n of nearSurf(c.pos)){
      const d=sDist(c.pos,n);if(d>.62)continue;
      const vn=c.vel.dot(n),al=up.dot(n);
      if(vn>.5)continue;
      if(n.y>.5||(c.wall&&al>.4)){
        let f=V(0,0,1).applyQuaternion(c.q);f.addScaledVector(n,-f.dot(n));
        if(f.lengthSq()<.09){f=c.vel.clone();f.addScaledVector(n,-f.dot(n));}
        if(f.lengthSq()<.01){f.copy(c.f);f.addScaledVector(n,-f.dot(n));}
        c.f.copy(f.lengthSq()>1e-4?f.normalize():V(0,0,1));c.n.copy(n);
        c.bobV=Math.min(-vn*.04,.5)*(-1);c.vel.addScaledVector(n,-vn);c.pos.addScaledVector(n,.6-d);c.onS=true;c.jumps=0;c.jumpT=0;c.spinT=0;break;
      }else{c.pos.addScaledVector(n,.62-d);if(vn<0)c.vel.addScaledVector(n,-vn*1.3);}
    }
  }
  if(Math.abs(c.pos.z)>L+.3&&!mode.hoops)c.pos.x=clamp(c.pos.x,-(GW-1.8),GW-1.8);
  if(Math.abs(c.pos.z)>L+GD-.6){c.pos.z=Math.sign(c.pos.z)*(L+GD-.6);c.vel.z*=-.3;}
  if(c.pos.y>H-.5)c.pos.y=H-.5;if(c.pos.y<.5)c.pos.y=.6;
  for(const p of pads){if(p.t>0)continue;
    if(Math.hypot(c.pos.x-p.x,c.pos.z-p.z)<(p.big?3.2:2.2)&&c.pos.y<2.5&&c.boost<100&&M.turbo==='normal'){c.boost=Math.min(100,c.boost+(p.big?100:12));p.t=p.big?10:4;p.glow.visible=false;if(c.human)beep(p.big?700:900,.12,.06);}}
  if(c.onS)setBasis(c);
}
function carCar(a,b){
  if(a.dead>0||b.dead>0)return;
  const za=V(0,0,1).applyQuaternion(a.q),zb=V(0,0,1).applyQuaternion(b.q),ra=a.hit.x+.1,rb=b.hit.x+.1,oa=a.hit.z-ra,ob=b.hit.z-rb;
  for(const x of[-oa,0,oa])for(const y of[-ob,0,ob]){
    const d=a.pos.clone().addScaledVector(za,x).sub(b.pos.clone().addScaledVector(zb,y)),dist=d.length(),R=ra+rb;
    if(dist<R&&dist>1e-4){
      const n=d.multiplyScalar(1/dist),rel=a.vel.clone().sub(b.vel).dot(n),sa=a.vel.length(),sb=b.vel.length();
      if(rel<-2){if(sa>34&&sa>sb+4&&a.bst)return demo(b,a);if(sb>34&&sb>sa+4&&b.bst)return demo(a,b);}
      const pen=(R-dist)/2;a.pos.addScaledVector(n,pen);b.pos.addScaledVector(n,-pen);
      if(rel<0){const j=-1.35*rel/2;a.vel.addScaledVector(n,j);b.vel.addScaledVector(n,-j);if(j>6)shake=Math.max(shake,.25);}
      return;
    }
  }
}
function carBall(c){
  if(c.dead>0)return;
  const ax=V(1,0,0).applyQuaternion(c.q),ay=V(0,1,0).applyQuaternion(c.q),az=V(0,0,1).applyQuaternion(c.q),d=ball.pos.clone().sub(c.pos),h=c.hit;
  const lx=d.dot(ax),ly=d.dot(ay),lz=d.dot(az),px=clamp(lx,-h.x,h.x),py=clamp(ly,-h.y,h.y*1.2),pz=clamp(lz,-h.z,h.z);
  let dx=lx-px,dy=ly-py,dz=lz-pz,dist=Math.hypot(dx,dy,dz);
  if(dist>=BR)return;
  if(dist<1e-4){dx=0;dy=1;dz=0;dist=1;}
  const n=ax.clone().multiplyScalar(dx/dist).addScaledVector(ay,dy/dist).addScaledVector(az,dz/dist).normalize();
  ball.pos.addScaledVector(n,BR-dist);
  const relv=ball.vel.clone().sub(c.vel),rel=relv.dot(n);
  if(rel<0){
    const j=-(1+.6)*rel*c.sp.st.pow,fi=relv.clone().addScaledVector(n,-rel).multiplyScalar(-.1);
    ball.vel.addScaledVector(n,j*1.05);ball.vel.y+=Math.abs(rel)*.08;ball.vel.add(fi);
    ball.w.add(V().crossVectors(n.clone().multiplyScalar(-BR),fi).multiplyScalar(1/(.4*BR*BR)));
    c.vel.addScaledVector(n,-j*.08);
    if(j>3)c.stats.t++;
    ball.lastTeam=c.team;ball.lastCar=c;ballMat.emissive.set(c.team?0x6a3300:0x0a2a6a);
    if(j>14){shake=Math.max(shake,Math.min(j/60,.5));for(let k=0;k<12;k++)emit(ball.pos,V(rnd(-6,6),rnd(0,6),rnd(-6,6)),1,1,.8,.4,0);}
    if(c.human&&j>8)beep(120,.12,.12);
  }
}
function stepBall(dt){
  const p=ball.pos,v=ball.vel,w=ball.w,R=BR;
  v.y-=G*dt;
  if(mode.heat&&ball.lastTeam!=null){const gz=ball.lastTeam?-L:L,d=V(-p.x*.3,3-p.y,gz-p.z).normalize(),sp=Math.min(v.length()+8*dt,55);v.lerp(d.multiplyScalar(sp),.08);v.y+=G*dt;}
  p.addScaledVector(v,dt);
  const bump=(nx,ny,nz,pen)=>{p.x+=nx*pen;p.y+=ny*pen;p.z+=nz*pen;const vn=v.x*nx+v.y*ny+v.z*nz;if(vn<0){v.x-=nx*vn*1.6;v.y-=ny*vn*1.6;v.z-=nz*vn*1.6;}};
  if(p.y<R){p.y=R;if(v.y<0)v.y=-v.y*(mode.puck?.1:.6);if(Math.abs(v.y)<1.2)v.y=0;
    const ux=v.x+R*w.z,uz=v.z-R*w.x,k=(mode.puck?.6:6)*dt;
    v.x-=ux*k;v.z-=uz*k;w.x+=uz*k/(.4*R);w.z-=ux*k/(.4*R);const f=Math.exp(-.04*dt);v.x*=f;v.z*=f;}
  if(p.y>H-R){p.y=H-R;if(v.y>0)v.y=-v.y*.6;}
  if(!mode.hoops)for(const s of[-1,1]){const zc=s*L;
    for(const sx of[-1,1])if(p.y<GH){const dx=p.x-sx*GW,dz=p.z-zc,d=Math.hypot(dx,dz);if(d<R+.45&&d>1e-4)bump(dx/d,0,dz/d,R+.45-d);}
    if(Math.abs(p.x)<GW){const dy=p.y-GH,dz=p.z-zc,d=Math.hypot(dy,dz);if(d<R+.45&&d>1e-4)bump(0,dy/d,dz/d,R+.45-d);}}
  const csx=p.x>0?1:-1,csz=p.z>0?1:-1,dd=csx*p.x+csz*p.z;
  if(dd>KD-R*R2&&Math.abs(p.z)<L+.1){const n=N_C[csx+','+csz],pen=(dd-(KD-R*R2))/R2;bump(n.x,0,n.z,pen);w.multiplyScalar(.97);}
  if(Math.abs(p.x)>W-R){p.x=Math.sign(p.x)*(W-R);v.x*=-.7;w.multiplyScalar(.9);}
  const inM=!mode.hoops&&Math.abs(p.x)<GW&&(p.y<GH-R*.5||Math.abs(p.z)>L),zl=inM?L+GD-R:L-R;
  if(Math.abs(p.z)>zl){p.z=Math.sign(p.z)*zl;v.z*=-.6;w.multiplyScalar(.9);}
  if(inM&&Math.abs(p.z)>L-R){
    if(Math.abs(p.x)>GW-R){p.x=Math.sign(p.x)*(GW-R);v.x*=-.5;}
    if(p.y>GH-R&&Math.abs(p.z)>L){p.y=GH-R;if(v.y>0)v.y*=-.5;}}
  w.multiplyScalar(Math.exp(-.1*dt));v.clampLength(0,70);w.clampLength(0,8);
  ball.mesh.position.copy(p);
  if(!mode.puck){const a=w.length()*dt;if(a>1e-5){qE.setFromAxisAngle(w.clone().normalize(),a);ball.mesh.quaternion.premultiply(qE);}}
  ball.sh.position.set(p.x,.04,p.z);ball.sh.scale.setScalar(Math.max(.4,1-p.y/30)*BR/BR0);
}

teams.forEach(t=>{const sp=BODIES[t.body]||BODIES.octane;cars.push({team:t.team,human:true,name:t.name,sp,hit:{x:sp.wid/2,y:sp.hy,z:sp.len/2},pos:V(),vel:V(),q:new T.Quaternion(),n:V(0,1,0),f:V(0,0,1),onS:true,jn:V(0,1,0),dead:0,wall:true,bst:false,boost:33,jumps:0,jumpT:0,holdT:0,spinT:0,spinAx:V(1,0,0),spinRate:0,wheel:0,steerIn:0,lean:0,bob:0,bobV:0,mesh:{visible:true,position:V(),quaternion:new T.Quaternion()},sh:{visible:true},trail:{clear(){}},stats:{g:0,d:0,t:0},stuckT:0,revT:0});});
const zeroIn=()=>({thr:0,steer:0,boost:false,jump:false,jumpHeld:false,slide:false,roll:0});
const KO={1:[[0,-37]],2:[[-9,-36],[9,-36]],3:[[-14,-34],[14,-34],[0,-44]]};
let score=[0,0],timeLeft=300,overtime=false,state='count',st=3;
function kickoff(){ball.pos.set(0,BR,0);ball.vel.set(0,0,0);ball.w.set(0,0,0);ball.lastTeam=null;ball.lastCar=null;
  const n=cars.filter(c=>c.team===0).length;[0,1].forEach(tm=>{let s=0;cars.forEach(c=>{if(c.team!==tm)return;const p=KO[n][s++],sg=tm?-1:1;placeCar(c,p[0]*sg*W/56,p[1]*sg*L/70,tm?Math.PI:0);});});state='count';st=3;}
const scored=()=>Math.abs(ball.pos.z)>L+BR*.9&&Math.abs(ball.pos.x)<GW&&ball.pos.y<GH?(ball.pos.z>0?0:1):-1;
const stats=()=>cars.map(c=>[c.stats.g,c.stats.d,c.stats.t]);
function onGoal(sc){score[sc]++;const c=ball.lastCar;let ci=-1;if(c&&c.team===sc){c.stats.g++;ci=cars.indexOf(c);}
  events.push({e:'goal',team:sc,car:ci,stats:stats()});if(overtime)state='end';else{state='goal';st=3;}}
function step(dt,inp){
  for(const p of pads)if(p.t>0)p.t-=dt;
  if(state==='count'){st-=dt;if(st<=0)state='play';}
  else if(state==='play'){
    cars.forEach((c,i)=>stepCar(c,Object.assign(zeroIn(),inp[i]||{}),dt));
    for(let a=0;a<cars.length;a++)for(let b=a+1;b<cars.length;b++)carCar(cars[a],cars[b]);
    for(let k=0;k<2;k++){for(const c of cars)carBall(c);stepBall(dt/2);}
    if(!overtime){timeLeft-=dt;if(timeLeft<=0){timeLeft=0;if(score[0]===score[1])overtime=true;else state='end';}}
    const sc=scored();if(sc>=0&&state==='play')onGoal(sc);
  }else if(state==='goal'){st-=dt;stepBall(dt);cars.forEach(c=>stepCar(c,zeroIn(),dt));if(st<=0)kickoff();}
}
const q=v=>Math.round(v*100)/100;
function snap(){const b=ball.pos,v=ball.vel,r=ball.mesh.quaternion;
  return{s:['count','play','goal','end'].indexOf(state),st:Math.round(st*10)/10,tl:Math.round(timeLeft*10)/10,ot:+overtime,sc:score.slice(),
  b:[b.x,b.y,b.z,r.x,r.y,r.z,r.w,v.x,v.y,v.z].map(q),
  c:cars.map(c=>[c.pos.x,c.pos.y,c.pos.z,c.q.x,c.q.y,c.q.z,c.q.w,c.vel.x,c.vel.y,c.vel.z,c.n.x,c.n.y,c.n.z,c.boost,(c.onS?1:0)|(c.bst?2:0)|(c.dead>0?4:0),c.steerIn,c.wheel].map(q)),
  p:pads.map(p=>p.t>0?0:1).join('')};}
kickoff();
return{step,snap,events,stats,get state(){return state;},get score(){return score;}};}
module.exports={create,BODY_KEYS};
