import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $=id=>document.getElementById(id);
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x020713); scene.fog=new THREE.FogExp2(0x020713,.0015);
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.1,5000); camera.position.set(0,0,0);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(innerWidth,innerHeight); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.domElement.className='webgl'; $('game').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0x8dbdff,0x101324,2.1)); const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(20,30,10);scene.add(sun);
const starGeo=new THREE.BufferGeometry(), starCount=2200, starPos=new Float32Array(starCount*3);for(let i=0;i<starCount;i++){starPos[i*3]=(Math.random()-.5)*1800;starPos[i*3+1]=(Math.random()-.5)*1200;starPos[i*3+2]=-Math.random()*1800-30;}starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xaedfff,size:1.2,sizeAttenuation:true})));
const loader=new GLTFLoader();let modelURLs=[],enemyShips=[],projectiles=[],missiles=[],flares=[],lasers=[],loadedModels=[],modelNames=[],active=false,health=100,boost=100,flareCount=5,kills=0,weapon=1,fireCD=0,missileCD=0,spawnCD=0,warningTimer=0,toastTimer=0,gameOver=false,selectedModel=0,previewShip=null,lockedTarget=null,threatMissile=null;
const keys={};let speed=420,boosting=false;
const player={yaw:0,pitch:0,roll:0,pos:new THREE.Vector3(),vel:new THREE.Vector3()};
const clock=new THREE.Clock();
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');toastTimer=2.2;}
function materializeModel(gltf,scale=1){const obj=gltf.scene.clone(true);obj.scale.setScalar(scale);obj.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;}});return obj;}
async function loadAssetList(){
 try{
   const r=await fetch('list_assets.php',{cache:'no-store'});
   if(!r.ok)throw Error('No PHP');
   modelURLs=await r.json();
 }catch(e){
   modelURLs=['assets/Spaceship%20by%20Quaternius%20-%20DbGajMHrvp.glb','assets/Spaceship%20by%20Quaternius%20-%20PQzePrvBCD.glb','assets/Spaceship%20by%20Quaternius%20-%20Jqfed124pQ.glb','assets/Spaceship%20by%20Quaternius%20-%20htfBk9vPfw.glb','assets/Spaceship%20by%20Quaternius%20-%20xNbtFQwirO.glb','assets/Spaceship%20by%20Quaternius%20-%20uCeLfsdmNP.glb','assets/Spaceship%20by%20Quaternius%20-%20VSxUAFhzbA.glb'];
 }
 const sel=$('shipSelect');sel.innerHTML='';
 for(let i=0;i<modelURLs.length;i++){
   const url=modelURLs[i];
   try{
     const gltf=await loader.loadAsync(url);
     loadedModels.push(gltf);
     const raw=decodeURIComponent(url.split('/').pop()).replace(/\\.glb$/i,'').replace('Spaceship by Quaternius - ','');
     modelNames.push(raw);
     const opt=document.createElement('option');opt.value=String(loadedModels.length-1);opt.textContent=`NAVE ${String(loadedModels.length).padStart(2,'0')} · ${raw}`;sel.appendChild(opt);
   }catch(e){console.warn('No se pudo cargar',url,e);}
 }
 $('shipModelCount').textContent=`${loadedModels.length} MODELOS GLB DISPONIBLES`;
 if(!loadedModels.length){const opt=document.createElement('option');opt.value='';opt.textContent='Naves de emergencia';sel.appendChild(opt);}
 selectedModel=0;createPreviewShip();sel.addEventListener('change',()=>{selectedModel=Number(sel.value)||0;createPreviewShip();updateShipBonus();});
 updateShipBonus();
 $('loadStatus').textContent=loadedModels.length?`${loadedModels.length} modelos GLB cargados`:'No se cargaron modelos; se usarán naves de emergencia';
 return loadedModels.length;
}
function createPreviewShip(){
 if(previewShip){scene.remove(previewShip);previewShip=null;}
 if(!loadedModels.length)return;
 previewShip=materializeModel(loadedModels[selectedModel],4.2);
 previewShip.position.set(0,-1,-17);previewShip.rotation.y=Math.PI;
 scene.add(previewShip);
}
function updateShipBonus(){
 const names=['INTERCEPTOR','CAZA TÁCTICO','ESCOLTA','CAZA PESADO','EXPLORADOR','SUPREMACÍA','DEFENSA'];
 $('shipBonus').textContent='CLASE: '+(names[selectedModel%names.length]||'INTERCEPTOR');
}
function rand(a,b){return a+Math.random()*(b-a)}
function addEnemy(){let obj;if(loadedModels.length){const gltf=loadedModels[Math.floor(Math.random()*loadedModels.length)];obj=materializeModel(gltf,rand(1.5,3.1));}else{obj=new THREE.Mesh(new THREE.ConeGeometry(2,6,8),new THREE.MeshStandardMaterial({color:0xff593d,metalness:.6,roughness:.35}));obj.rotation.x=-Math.PI/2;}
const ang=rand(-.7,.7);obj.position.set(Math.sin(ang)*rand(45,100),rand(-35,35),-rand(160,330));obj.rotation.y=Math.PI+rand(-.3,.3);scene.add(obj);enemyShips.push({obj,hp:100,speed:rand(10,22),shoot:rand(2,6),phase:Math.random()*6,name:'HOSTIL-'+String(enemyShips.length+1).padStart(2,'0')});}
function makeBolt(from,to,color=0x55f6ff,r=.22){const dir=new THREE.Vector3().subVectors(to,from).normalize();const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,8,8),new THREE.MeshBasicMaterial({color}));mesh.position.copy(from);scene.add(mesh);projectiles.push({mesh,dir,speed:190,life:3,damage:34});}
function fireLaser(){const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);const origin=camera.position.clone().add(dir.clone().multiplyScalar(2));const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,7,6),new THREE.MeshBasicMaterial({color:0x54f4ff}));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);mesh.position.copy(origin).add(dir.clone().multiplyScalar(4));scene.add(mesh);lasers.push({mesh,dir,speed:260,life:1.2,damage:24});}
function firePlayerMissile(){const target=(lockedTarget&&enemyShips.includes(lockedTarget))?lockedTarget:nearestEnemy();if(!target){toast('NO HAY OBJETIVOS EN RANGO');return;}const m=new THREE.Mesh(new THREE.ConeGeometry(.28,1.8,8),new THREE.MeshStandardMaterial({color:0xffb45a,emissive:0x6d2200}));m.position.copy(camera.position).add(new THREE.Vector3(0,-.5,-2).applyQuaternion(camera.quaternion));m.quaternion.copy(camera.quaternion);scene.add(m);missiles.push({mesh:m,target,speed:95,life:8,enemy:false});}
function nearestEnemy(){let best=null,d=Infinity;for(const e of enemyShips){const n=e.obj.position.distanceTo(camera.position);if(n<d){d=n;best=e;}}return best;}
function launchFlare(){if(flareCount<=0){toast('SIN BENGALAS DISPONIBLES');return;}flareCount--;const group=new THREE.Group();for(let i=0;i<5;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.25+Math.random()*.16,8,8),new THREE.MeshBasicMaterial({color:i%2?0xffa54f:0xffe8a0}));p.position.set(rand(-1.5,1.5),rand(-1,1),rand(-1,1));group.add(p);}group.position.copy(camera.position).add(new THREE.Vector3(rand(-2,2),rand(-1,1),-4).applyQuaternion(camera.quaternion));scene.add(group);flares.push({mesh:group,life:4});toast('BENGALAS LANZADAS');$('flareText').textContent=flareCount;}
function enemyFire(e){const m=new THREE.Mesh(new THREE.ConeGeometry(.3,1.8,8),new THREE.MeshStandardMaterial({color:0xff4e5d,emissive:0x8a0010}));m.position.copy(e.obj.position);const target=new THREE.Vector3(player.pos.x,player.pos.y,player.pos.z);m.lookAt(target);m.rotateX(Math.PI/2);scene.add(m);missiles.push({mesh:m,target:null,speed:rand(30,42),life:9,enemy:true,aim:target});warningTimer=4;threatMissile=missiles[missiles.length-1];$('warning').style.display='block';updateThreatDirection(threatMissile);}
function updateThreatDirection(m){
 const el=$('threatDirection');if(!m){el.style.display='none';return;}
 const dx=m.mesh.position.x-camera.position.x;
 const dy=m.mesh.position.y-camera.position.y;
 el.className='threat-direction '+(Math.abs(dx)<5?'center':dx<0?'left':'right');
 el.textContent=Math.abs(dx)<5?'MISIL EN EJE DE VUELO':dx<0?'MISIL A BABOR':'MISIL A ESTRIBOR';
 el.style.display='block';
}
function cycleTarget(){
 const alive=enemyShips.slice().sort((a,b)=>a.obj.position.distanceTo(camera.position)-b.obj.position.distanceTo(camera.position));
 if(!alive.length){lockedTarget=null;$('lockPanel').style.display='none';$('targetBox').style.display='none';toast('NO HAY OBJETIVOS HOSTILES');return;}
 const idx=Math.max(0,alive.indexOf(lockedTarget));lockedTarget=alive[(idx+1)%alive.length];toast('OBJETIVO FIJADO: '+lockedTarget.name);
}
function updateTargetLock(){
 if(!lockedTarget||!enemyShips.includes(lockedTarget)){lockedTarget=null;$('lockPanel').style.display='none';$('targetBox').style.display='none';return;}
 $('lockPanel').style.display='flex';$('lockedName').textContent=lockedTarget.name;
 $('lockedDistance').textContent=Math.round(lockedTarget.obj.position.distanceTo(camera.position))+' m';
 $('lockedHealth').style.width=Math.max(0,lockedTarget.hp)+'%';
 const p=lockedTarget.obj.position.clone().project(camera);
 if(p.z<1){$('targetBox').style.display='block';$('targetBox').style.left=((p.x+1)/2*innerWidth)+'px';$('targetBox').style.top=((-p.y+1)/2*innerHeight)+'px';}
 else $('targetBox').style.display='none';
}
function explode(pos,color=0xff8c42){const geo=new THREE.SphereGeometry(1,12,10);const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,wireframe:true});const m=new THREE.Mesh(geo,mat);m.position.copy(pos);scene.add(m);let t=0;const iv=setInterval(()=>{t++;m.scale.multiplyScalar(1.25);mat.opacity-=.13;if(t>6){clearInterval(iv);scene.remove(m);geo.dispose();mat.dispose();}},35);}
function hitEnemy(e,damage){e.hp-=damage;if(e.hp<=0){scene.remove(e.obj);enemyShips=enemyShips.filter(x=>x!==e);explode(e.obj.position);kills++;$('killsText').textContent=kills;toast('OBJETIVO ELIMINADO');}}
function updateRadar(){const c=$('radar'),ctx=c.getContext('2d'),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.strokeStyle='rgba(99,234,255,.28)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(w/2,h/2,65,0,Math.PI*2);ctx.moveTo(10,75);ctx.lineTo(140,75);ctx.moveTo(75,10);ctx.lineTo(75,140);ctx.stroke();ctx.fillStyle='#62f5ff';ctx.beginPath();ctx.arc(75,75,3,0,Math.PI*2);ctx.fill();enemyShips.forEach(e=>{let x=75+e.obj.position.x*.5,y=75+e.obj.position.z*.15;ctx.fillStyle=lockedTarget===e?'#fff1a8':'#ff634f';ctx.fillRect(Math.max(8,Math.min(142,x)),Math.max(8,Math.min(142,y)),4,4);});missiles.filter(m=>m.enemy).forEach(m=>{const x=Math.max(8,Math.min(142,75+m.mesh.position.x*.5)),y=Math.max(8,Math.min(142,75+m.mesh.position.z*.15));ctx.fillStyle='#ffb34f';ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill();});}
function updateUI(dt){$('healthText').textContent=Math.max(0,Math.round(health))+'%';$('healthBar').style.width=Math.max(0,health)+'%';$('boostText').textContent=Math.round(boost)+'%';$('boostBar').style.width=boost+'%';$('speed').textContent=Math.round(speed*(boosting?1.8:1));$('boostLabel').textContent=boosting?'IMPULSO ACTIVADO':'IMPULSO DESACTIVADO';$('boostLabel').style.color=boosting?'#68eaff':'#7f9eb3';if(warningTimer>0){warningTimer-=dt;if(warningTimer<=0)$('warning').style.display='none';}if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show');}}
function update(dt){if(!active)return;fireCD-=dt;missileCD-=dt;spawnCD-=dt;boosting=!!keys.ShiftLeft||!!keys.ShiftRight;if(boosting&&boost>0)boost=Math.max(0,boost-27*dt);else boost=Math.min(100,boost+11*dt);
const turn=1.35*dt; if(keys.KeyA)player.yaw+=turn;if(keys.KeyD)player.yaw-=turn;if(keys.KeyW)player.pitch+=turn;if(keys.KeyS)player.pitch-=turn;player.pitch=THREE.MathUtils.clamp(player.pitch,-1.05,1.05);player.yaw=THREE.MathUtils.clamp(player.yaw,-1.4,1.4);
camera.rotation.order='YXZ';camera.rotation.set(player.pitch,player.yaw,0);const moveSpeed=(boosting&&boost>0?90:48)*dt;player.pos.x+=Math.sin(player.yaw)*moveSpeed;player.pos.y+=Math.sin(player.pitch)*moveSpeed;player.pos.z-=moveSpeed;camera.position.copy(player.pos);camera.position.z=0;player.pos.z=0;
if(keys.Space&&fireCD<=0){if(weapon===1){fireLaser();fireCD=.12;}else if(missileCD<=0){fireCD=.35;missileCD=1.1;firePlayerMissile();}}
if(spawnCD<=0&&enemyShips.length<7){addEnemy();spawnCD=2.2;}
for(const e of [...enemyShips]){e.phase+=dt;e.obj.position.z+=e.speed*dt;e.obj.position.x+=Math.sin(e.phase)*dt*7;e.obj.position.y+=Math.cos(e.phase*.8)*dt*4;e.shoot-=dt;if(e.shoot<=0&&e.obj.position.z< -35){enemyFire(e);e.shoot=rand(4,8);}if(e.obj.position.z>18){scene.remove(e.obj);enemyShips=enemyShips.filter(x=>x!==e);}}
for(const arr of [lasers,projectiles]){for(const p of [...arr]){p.mesh.position.addScaledVector(p.dir,p.speed*dt);p.life-=dt;let removed=false;if(arr===lasers){for(const e of [...enemyShips])if(p.mesh.position.distanceTo(e.obj.position)<7){hitEnemy(e,p.damage);p.life=0;break;}}else if(p.mesh.position.distanceTo(camera.position)<1.8){health-=p.damage||34;p.life=0;toast('IMPACTO RECIBIDO');if(health<=0)endGame();}if(p.life<=0){scene.remove(p.mesh);arr.splice(arr.indexOf(p),1);}}}
for(const m of [...missiles]){m.life-=dt;let target;if(m.enemy){let flare=flares.filter(f=>f.life>0).sort((a,b)=>a.mesh.position.distanceTo(m.mesh.position)-b.mesh.position.distanceTo(m.mesh.position))[0];if(flare&&flare.mesh.position.distanceTo(m.mesh.position)<80){target=flare.mesh.position;m.decoy=flare;}else{target=m.aim;m.decoy=null;}if(!flare)m.aim.set(camera.position.x,camera.position.y,camera.position.z);}else target=m.target?.obj.position;if(target){const dir=new THREE.Vector3().subVectors(target,m.mesh.position).normalize();m.mesh.position.addScaledVector(dir,m.speed*dt);m.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);if(m.mesh.position.distanceTo(target)<3){if(m.enemy){let f=m.decoy&&m.decoy.life>0&&m.decoy.mesh.position.distanceTo(m.mesh.position)<12?m.decoy:null;if(!f){health-=28;toast('MISIL IMPACTÓ LA NAVE');if(health<=0)endGame();}else{toast('MISIL DESVIADO POR BENGALAS');explode(m.mesh.position,0xffbd61);}}else if(m.target&&enemyShips.includes(m.target))hitEnemy(m.target,70);m.life=0;}}if(m.life<=0){scene.remove(m.mesh);missiles.splice(missiles.indexOf(m),1);}}
for(const f of [...flares]){f.life-=dt;f.mesh.position.z-=22*dt;if(f.life<=0){scene.remove(f.mesh);flares.splice(flares.indexOf(f),1);}}
updateUI(dt);updateRadar();updateTargetLock();if(previewShip&&!active){previewShip.rotation.y+=dt*.25;previewShip.rotation.x=Math.sin(clock.elapsedTime*.5)*.08;}if(threatMissile&&missiles.includes(threatMissile))updateThreatDirection(threatMissile);else if(!missiles.some(m=>m.enemy))$('threatDirection').style.display='none';}
function endGame(){active=false;gameOver=true;$('startScreen').style.display='flex';$('startBtn').textContent='VOLVER A INTENTAR';$('loadStatus').textContent=`Nave destruida · Objetivos eliminados: ${kills}`;toast('MISIÓN FALLIDA');}
$('startBtn').addEventListener('click',()=>{if(gameOver){health=100;boost=100;flareCount=5;kills=0;enemyShips.forEach(e=>scene.remove(e.obj));enemyShips=[];missiles.forEach(m=>scene.remove(m.mesh));missiles=[];$('killsText').textContent='0';$('flareText').textContent='5';gameOver=false;lockedTarget=null;}$('warning').style.display='none';active=true;if(previewShip){scene.remove(previewShip);previewShip=null;}$('startScreen').style.display='none';if(enemyShips.length===0)for(let i=0;i<4;i++)addEnemy();toast('MISIÓN INICIADA');});
$('weapon1').onclick=()=>setWeapon(1);$('weapon2').onclick=()=>setWeapon(2);
function setWeapon(n){weapon=n;$('weapon1').classList.toggle('active',n===1);$('weapon2').classList.toggle('active',n===2);$('weaponInfo').textContent=n===1?'LÁSER LISTO':'MISILES GUIADOS LISTOS';toast(n===1?'CAÑÓN LÁSER SELECCIONADO':'MISILES SELECCIONADOS');}
window.addEventListener('keydown',e=>{keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='Digit1')setWeapon(1);if(e.code==='Digit2')setWeapon(2);if(e.code==='KeyE'&&active)launchFlare();if(e.code==='Tab'&&active){e.preventDefault();cycleTarget();}if(e.code==='KeyR'&&active){lockedTarget=nearestEnemy();if(lockedTarget)toast('OBJETIVO FIJADO: '+lockedTarget.name);else toast('NO HAY OBJETIVOS HOSTILES');}});
window.addEventListener('keyup',e=>keys[e.code]=false);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
loadAssetList().then(n=>{if(!n)$('loadStatus').textContent='No se cargaron modelos; se usarán naves de emergencia';}).catch(()=>{});
renderer.setAnimationLoop(()=>{const dt=Math.min(clock.getDelta(),.05);update(dt);renderer.render(scene,camera);});
