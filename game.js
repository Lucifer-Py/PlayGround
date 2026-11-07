(() => {
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const gameArea = document.querySelector('#game-area');
  const TILE = 32, WORLD_W = 96, WORLD_H = 36;
  const defs = {
    grass:{name:'Grass',icon:'🟩',color:'#67b85a'}, dirt:{name:'Dirt',icon:'🟫',color:'#996647'}, stone:{name:'Stone',icon:'🪨',color:'#8c9b9b'}, wood:{name:'Wood',icon:'🪵',color:'#a76e43'}, leaf:{name:'Leaf',icon:'🍃',color:'#5ba86a'}, flower:{name:'Flower',icon:'🌼',color:'#f4c64e'}, brick:{name:'Brick',icon:'🧱',color:'#ca8261'}, seed:{name:'Seed',icon:'🌱',color:'#75bb70'}
  };
  const kinds = Object.keys(defs);
  let worldName = 'SUNNY MEADOW', world = null, inventory = {grass:4,dirt:4,stone:2,wood:0,leaf:0,flower:0,brick:0,seed:3};
  let selected = 'grass', cameraX = 0, cameraY = 0, lastTime = 0, toastTimer, toastFade = 0, target = null, moveLeft = false, moveRight = false;
  const player = {x: 16*TILE, y:0, vx:0, vy:0, w:20, h:29, grounded:false, face:1, frame:0};
  const savedName = localStorage.getItem('sproutName');
  const playerId = sessionStorage.getItem('sproutId') || Math.random().toString(36).slice(2,9);
  sessionStorage.setItem('sproutId',playerId);
  let playerName = savedName || 'little sprout';
  const remotePlayers = new Map();
  let channel;
  try { channel = new BroadcastChannel('sprout-world'); } catch(e) {}
  const tileIndex = (x,y) => y*WORLD_W+x;
  const inBounds = (x,y) => x>=0 && y>=0 && x<WORLD_W && y<WORLD_H;
  const cell = (x,y) => inBounds(x,y) ? world[tileIndex(x,y)] : 'stone';
  const isSolid = (x,y) => !!cell(x,y) && cell(x,y)!=='flower' && cell(x,y)!=='leaf';

  function generateWorld(name) {
    worldName=name;
    document.querySelector('#world-name').textContent=name.toUpperCase();
    const seed=Array.from(name).reduce((a,c)=>((a*31+c.charCodeAt(0))>>>0),7521);
    let rand=seed; const random=()=>{rand=(rand*1664525+1013904223)>>>0;return rand/4294967296};
    world=Array(WORLD_W*WORLD_H).fill(null);
    const heights=[];let h=17;
    for(let x=0;x<WORLD_W;x++){if(random()<.22)h+=random()<.5?1:-1;h=Math.max(14,Math.min(19,h));heights[x]=h;
      for(let y=h;y<WORLD_H;y++)world[tileIndex(x,y)]= y===h?'grass':y<h+5?'dirt':'stone';
      if(random()<.13 && x>2 && x<WORLD_W-2){const y=h-1;world[tileIndex(x,y)]='flower';}
    }
    for(let x=3;x<WORLD_W-3;x++){if(random()<.095){const ground=heights[x], trunk=3+Math.floor(random()*2);for(let n=1;n<=trunk;n++)world[tileIndex(x,ground-n)]='wood';for(let dy=-2;dy<=0;dy++)for(let dx=-2;dx<=2;dx++)if(Math.abs(dx)+Math.abs(dy)<4 && random()>.1 && inBounds(x+dx,ground-trunk+dy-1))world[tileIndex(x+dx,ground-trunk+dy-1)]='leaf';}}
    for(let x=0;x<WORLD_W;x+=1){if(random()<.065 && x>5 && x<WORLD_W-5){let y=7+Math.floor(random()*5);let len=2+Math.floor(random()*4);for(let i=0;i<len;i++)world[tileIndex(x+i,y)]='dirt';}}
    player.x=16*TILE;player.y=heights[16]*TILE-player.h;player.vx=0;player.vy=0;cameraX=0;cameraY=0;
    const saved=localStorage.getItem('sproutWorld_'+name); if(saved){try{world=JSON.parse(saved)}catch(e){persistWorld()}}else persistWorld();
    drawHotbar();say(`You wandered into ${name.toLowerCase()}!`);broadcast({type:'join',name:playerName,world:worldName});
  }
  function persistWorld(){localStorage.setItem('sproutWorld_'+worldName,JSON.stringify(world));}
  function broadcast(msg){if(channel)channel.postMessage({...msg,id:playerId,world:worldName});}
  if(channel)channel.onmessage=({data})=>{if(!data||data.id===playerId)return;if(data.type==='move'&&data.world===worldName){remotePlayers.set(data.id,{x:data.x,y:data.y,name:data.name,face:data.face,time:Date.now()});updatePlayerCount();}else if(data.type==='leave'){remotePlayers.delete(data.id);updatePlayerCount();}else if(data.type==='chat'&&data.world===worldName)addChat(data.name,data.text);else if(data.type==='tile'&&data.world===worldName){world[tileIndex(data.x,data.y)]=data.value;persistWorld();}else if(data.type==='join'&&data.world===worldName){toast(`${data.name} joined your world`);updatePlayerCount();}};
  function updatePlayerCount(){document.querySelector('#player-count').textContent=1+[...remotePlayers.values()].filter(p=>Date.now()-p.time<9000).length;}
  window.addEventListener('beforeunload',()=>broadcast({type:'leave'}));
  function resize(){const rect=gameArea.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.floor(rect.width*dpr);canvas.height=Math.floor(rect.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
  new ResizeObserver(resize).observe(gameArea);resize();
  function roundedRect(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function drawSky(w,h){let g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#83c8df');g.addColorStop(.58,'#b5e3dd');g.addColorStop(1,'#d7edcf');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    const sx=w*.77-cameraX*.08,sy=h*.2;ctx.fillStyle='rgba(255,235,159,.22)';ctx.beginPath();ctx.arc(sx,sy,45,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffdc86';ctx.beginPath();ctx.arc(sx,sy,25,0,Math.PI*2);ctx.fill();
    for(let i=0;i<8;i++){const xx=((i*203-cameraX*.12)%(w+180)+w+180)%(w+180)-70;const yy=55+(i*83%Math.max(120,h*.55));drawCloud(xx,yy,.65+(i%3)*.14);}
    // distant rolling hills
    ctx.fillStyle='rgba(120,196,159,.22)';ctx.beginPath();ctx.moveTo(0,h*.68);for(let x=0;x<=w+20;x+=20)ctx.lineTo(x,h*.64+Math.sin((x+cameraX*.12)*.008)*18+Math.sin(x*.019)*6);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.fill();
  }
  function drawCloud(x,y,s){ctx.fillStyle='rgba(255,255,255,.52)';ctx.beginPath();ctx.ellipse(x,y,30*s,10*s,0,0,Math.PI*2);ctx.ellipse(x+12*s,y-7*s,13*s,12*s,0,0,Math.PI*2);ctx.ellipse(x-9*s,y-4*s,12*s,10*s,0,0,Math.PI*2);ctx.fill();}
  function drawTile(type,x,y,wx,wy){const px=x*TILE-cameraX,py=y*TILE-cameraY;ctx.fillStyle=defs[type].color;ctx.fillRect(px,py,TILE,TILE);
    // subtle block faces and bright highlights
    ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(px+2,py+2,TILE-4,2);ctx.fillRect(px+2,py+2,2,TILE-4);
    ctx.fillStyle='rgba(30,46,34,.12)';ctx.fillRect(px+TILE-3,py+3,2,TILE-5);ctx.fillRect(px+3,py+TILE-3,TILE-5,2);
    if(type==='grass'){ctx.fillStyle='#8cd176';ctx.fillRect(px,py,TILE,6);ctx.fillRect(px+3,py+5,3,3);ctx.fillStyle='#4b9952';ctx.fillRect(px+23,py+12,3,2);ctx.fillRect(px+8,py+23,2,2);}
    else if(type==='dirt'){ctx.fillStyle='#b17a50';ctx.fillRect(px+6,py+9,4,3);ctx.fillRect(px+22,py+19,3,3);ctx.fillStyle='#81583f';ctx.fillRect(px+14,py+25,4,2);}
    else if(type==='stone'){ctx.fillStyle='#aab8b3';ctx.fillRect(px+6,py+8,8,3);ctx.fillRect(px+18,py+20,7,3);ctx.fillStyle='#748783';ctx.fillRect(px+13,py+15,3,3);}
    else if(type==='wood'){ctx.fillStyle='#c18952';ctx.fillRect(px+5,py,4,TILE);ctx.fillStyle='#885734';ctx.fillRect(px+23,py,3,TILE);ctx.fillRect(px+4,py+8,24,2);ctx.fillRect(px+4,py+24,24,2);}
    else if(type==='leaf'){ctx.fillStyle='#79c77a';ctx.fillRect(px+5,py+5,10,7);ctx.fillRect(px+18,py+16,9,8);ctx.fillStyle='rgba(36,105,66,.23)';ctx.fillRect(px+18,py+7,7,5);}
    else if(type==='brick'){ctx.fillStyle='#edaa7c';ctx.fillRect(px,py+14,TILE,2);ctx.fillRect(px+15,py,2,14);ctx.fillRect(px+7,py+16,2,16);ctx.fillRect(px+23,py+16,2,16);}
    else if(type==='flower'){ctx.fillStyle='#488954';ctx.fillRect(px+15,py+15,3,17);ctx.fillRect(px+9,py+22,7,3);ctx.fillStyle='#fff4c2';ctx.fillRect(px+8,py+6,6,6);ctx.fillRect(px+18,py+5,6,6);ctx.fillRect(px+13,py+2,6,7);ctx.fillStyle='#f6ac50';ctx.fillRect(px+14,py+7,5,5);}
  }
  function drawCharacter(x,y,face,name,isSelf=false,frame=0){const px=x-cameraX,py=y-cameraY;ctx.save();ctx.translate(px,py);if(face<0){ctx.translate(20,0);ctx.scale(-1,1)}
    // soft foot shadow
    ctx.fillStyle='rgba(50,91,72,.19)';ctx.beginPath();ctx.ellipse(10,30,12,3,0,0,Math.PI*2);ctx.fill();
    const bob=Math.sin(frame*.13)*1.2;
    // tiny legs
    ctx.fillStyle='#536b70';ctx.fillRect(5,22+bob,4,7);ctx.fillRect(13,22-bob,4,7);ctx.fillStyle='#e49a67';ctx.fillRect(4,27+bob,6,3);ctx.fillRect(12,27-bob,6,3);
    // shirt and arms
    ctx.fillStyle=isSelf?'#53ad7d':'#728fc5';ctx.fillRect(3,13+bob,15,11);ctx.fillStyle=isSelf?'#388b65':'#5575a9';ctx.fillRect(7,21+bob,9,3);ctx.fillStyle='#f3bd91';ctx.fillRect(1,15+bob,3,8);ctx.fillRect(18,15+bob,3,8);
    // head and hair
    ctx.fillStyle='#f4bf91';ctx.fillRect(4,3+bob,14,12);ctx.fillStyle=isSelf?'#684932':'#53483f';ctx.fillRect(3,1+bob,16,6);ctx.fillRect(2,4+bob,3,5);ctx.fillRect(15,0+bob,4,3);
    ctx.fillStyle='#354047';ctx.fillRect(13,8+bob,2,2);ctx.fillRect(8,8+bob,2,2);ctx.fillStyle='#dc8b76';ctx.fillRect(10,12+bob,4,1);
    if(isSelf){ctx.fillStyle='#edc658';ctx.fillRect(14,17+bob,3,3);}
    ctx.restore();
    if(name){ctx.font='600 10px "DM Sans", sans-serif';const tw=ctx.measureText(name).width;roundedRect(px+10-tw/2-7,py-18,tw+14,15,7,isSelf?'rgba(255,255,249,.9)':'rgba(255,255,255,.76)');ctx.fillStyle=isSelf?'#397b5c':'#52728f';ctx.textAlign='center';ctx.fillText(name,px+10,py-7);}
  }
  function draw(){const w=gameArea.clientWidth,h=gameArea.clientHeight;drawSky(w,h);
    cameraX=Math.max(0,Math.min(WORLD_W*TILE-w,player.x-w*.46));cameraY=Math.max(0,Math.min(WORLD_H*TILE-h,player.y-h*.55));
    const fromX=Math.max(0,Math.floor(cameraX/TILE)-1),toX=Math.min(WORLD_W-1,Math.ceil((cameraX+w)/TILE)+1),fromY=Math.max(0,Math.floor(cameraY/TILE)-1),toY=Math.min(WORLD_H-1,Math.ceil((cameraY+h)/TILE)+1);
    for(let y=fromY;y<=toY;y++)for(let x=fromX;x<=toX;x++){const t=cell(x,y);if(t)drawTile(t,x,y,x,y);}
    // gentle grass blades
    for(let x=fromX;x<=toX;x++){if(cell(x,Math.floor((player.y+player.h)/TILE))==='grass'){const px=x*TILE-cameraX;ctx.fillStyle='rgba(80,171,103,.55)';ctx.fillRect(px+7,Math.floor((player.y+player.h)/TILE)*TILE-cameraY-3,2,4);}}
    for(const p of remotePlayers.values())if(Date.now()-p.time<9000)drawCharacter(p.x,p.y,p.face,p.name,false,performance.now()/90);
    drawCharacter(player.x,player.y,player.face,playerName,true,player.frame);
    if(target){const tx=target.x*TILE-cameraX,ty=target.y*TILE-cameraY;ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.strokeRect(tx+2,ty+2,TILE-4,TILE-4);ctx.setLineDash([]);}
  }
  function collides(x,y){const l=Math.floor((x+2)/TILE),r=Math.floor((x+player.w-2)/TILE),t=Math.floor((y+1)/TILE),b=Math.floor((y+player.h-1)/TILE);for(let yy=t;yy<=b;yy++)for(let xx=l;xx<=r;xx++)if(isSolid(xx,yy))return true;return false;}
  function step(dt){const speed=205;if(moveLeft){player.vx=-speed;player.face=-1}else if(moveRight){player.vx=speed;player.face=1}else player.vx*=Math.pow(.001,dt);player.x+=player.vx*dt;if(collides(player.x,player.y))player.x-=player.vx*dt;player.x=Math.max(0,Math.min(WORLD_W*TILE-player.w,player.x));
    player.vy=Math.min(700,player.vy+1500*dt);player.y+=player.vy*dt;if(collides(player.x,player.y)){if(player.vy>0){player.grounded=true;player.vy=0;player.y=Math.floor((player.y+player.h)/TILE)*TILE-player.h;}else player.vy=0;}else player.grounded=false;
    if(player.y>WORLD_H*TILE){player.y=0;player.vy=0;}player.frame+=dt*14;
  }
  function loop(now){const dt=Math.min(.04,(now-lastTime)/1000||0);lastTime=now;step(dt);draw();requestAnimationFrame(loop);}
  function toast(text){const el=document.createElement('div');el.className='toast';el.textContent=text;document.querySelector('#toast-stack').append(el);setTimeout(()=>el.remove(),2500);}
  function say(text){const el=document.querySelector('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2100);}
  function addChat(name,text){const feed=document.querySelector('#chat-feed'),el=document.createElement('div');el.className='chat-message';el.innerHTML=`<b>${escapeHTML(name)}</b><span>${escapeHTML(text)}</span>`;feed.append(el);while(feed.children.length>4)feed.firstChild.remove();setTimeout(()=>{if(el.parentNode)el.remove()},12000);}
  function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function drawHotbar(){const bar=document.querySelector('#hotbar');bar.innerHTML='';const slots=['grass','dirt','stone','wood','flower'];slots.forEach((type,i)=>{const el=document.createElement('button');el.className='slot'+(selected===type?' selected':'');el.dataset.type=type;el.innerHTML=`<span class="slot-label">${i+1}</span><span class="slot-icon">${defs[type].icon}</span><span class="slot-count">${inventory[type]||0}</span>`;el.title=defs[type].name;el.onclick=()=>{selected=type;drawHotbar();};bar.append(el);});}
  function refreshInventory(){drawHotbar();document.querySelector('#quest-count').textContent=`${inventory.wood||0}/5`;document.querySelector('#quest-fill').style.width=`${Math.min(100,(inventory.wood||0)*20)}%`;document.querySelector('#quest-text').textContent=inventory.wood>=5?'Plant a seed nearby!':'Gather 5 wood';}
  function getTarget(e){const rect=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-rect.left+cameraX)/TILE),y=Math.floor((e.clientY-rect.top+cameraY)/TILE);if(inBounds(x,y)){target={x,y};setTimeout(()=>{if(target&&target.x===x&&target.y===y)target=null},2500);}}
  function closeEnough(x,y){const cx=player.x+player.w/2,cy=player.y+player.h/2;return Math.hypot((x*TILE+16-cx),(y*TILE+16-cy))<TILE*5.2;}
  function mine(){if(!target)return toast('Tap a block first');const{x,y}=target;if(!closeEnough(x,y))return toast('That is a little too far away');const type=cell(x,y);if(!type)return toast('There is nothing there');if(type==='leaf'&&Math.random()<.28)inventory.seed=(inventory.seed||0)+1;else inventory[type]=(inventory[type]||0)+1;world[tileIndex(x,y)]=null;persistWorld();broadcast({type:'tile',x,y,value:null});refreshInventory();toast(`+1 ${defs[type].name.toLowerCase()}`);}
  function place(){if(!target)return toast('Tap a spot first');const{x,y}=target;if(!closeEnough(x,y))return toast('That is a little too far away');if(cell(x,y))return toast('That spot is already taken');if(!(inventory[selected]>0))return toast(`No ${defs[selected].name.toLowerCase()} in your pockets`);if(selected==='flower')return toast('Flowers grow wild — try planting a seed!');if(selected==='seed'){world[tileIndex(x,y)]='flower';inventory.seed--; }else{world[tileIndex(x,y)]=selected;inventory[selected]--;}persistWorld();broadcast({type:'tile',x,y,value:world[tileIndex(x,y)]});refreshInventory();toast(`${defs[selected].name} placed!`);}
  canvas.addEventListener('pointerdown',e=>{getTarget(e);if(e.pointerType==='mouse'&&e.button===2){e.preventDefault();place()}else if(e.pointerType==='mouse'&&e.button===0)mine();});canvas.addEventListener('contextmenu',e=>e.preventDefault());
  document.querySelector('#mine-btn').onclick=mine;document.querySelector('#place-btn').onclick=place;
  document.querySelector('#send-chat').onclick=sendChat;document.querySelector('#chat-input').addEventListener('keydown',e=>{if(e.key==='Enter')sendChat();});
  function sendChat(){const input=document.querySelector('#chat-input'),text=input.value.trim();if(!text)return;addChat(playerName,text);broadcast({type:'chat',name:playerName,text});input.value='';}
  function holdButton(id,down,up){const el=document.querySelector(id);el.addEventListener('pointerdown',e=>{e.preventDefault();down();el.setPointerCapture(e.pointerId)});el.addEventListener('pointerup',e=>{e.preventDefault();up()});el.addEventListener('pointercancel',up);el.addEventListener('lostpointercapture',up);}
  holdButton('#left-btn',()=>moveLeft=true,()=>moveLeft=false);holdButton('#right-btn',()=>moveRight=true,()=>moveRight=false);holdButton('#jump-btn',()=>jump(),()=>{});
  function jump(){if(player.grounded){player.vy=-570;player.grounded=false;}}
  window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp',' ','a','d','w'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft'||e.key==='a')moveLeft=true;if(e.key==='ArrowRight'||e.key==='d')moveRight=true;if(e.key===' '||e.key==='ArrowUp'||e.key==='w')jump();if('12345'.includes(e.key)){const types=['grass','dirt','stone','wood','flower'];selected=types[Number(e.key)-1];drawHotbar();}if(e.key==='e')place();if(e.key==='q')mine();});window.addEventListener('keyup',e=>{if(e.key==='ArrowLeft'||e.key==='a')moveLeft=false;if(e.key==='ArrowRight'||e.key==='d')moveRight=false;});
  function showModal(title,description,content){const modal=document.querySelector('#modal');modal.innerHTML=`<button class="modal-close" aria-label="Close">×</button><h2>${title}</h2><p>${description}</p>${content}`;document.querySelector('#modal-backdrop').classList.remove('hidden');modal.querySelector('.modal-close').onclick=closeModal;}
  function closeModal(){document.querySelector('#modal-backdrop').classList.add('hidden');}document.querySelector('#modal-backdrop').addEventListener('click',e=>{if(e.target.id==='modal-backdrop')closeModal()});
  document.querySelector('#help-btn').onclick=()=>{showModal('A tiny world, together','Grow a little world at your own pace. Other Sprout players in the same browser can visit your world in another tab.',`<div class="help-list"><div class="help-row"><b>Move</b> — A / D or ← → (touch: left buttons)</div><div class="help-row"><b>Jump</b> — Space / ↑ (touch: green button)</div><div class="help-row"><b>Gather</b> — tap a block, then mine (Q on keyboard)</div><div class="help-row"><b>Build</b> — select a pocket, tap a spot, then place (E)</div><div class="help-row"><b>Say hello</b> — send a chat message to visitors in your world</div></div><button class="primary-btn modal-done">Let's play</button>`);document.querySelector('.modal-done').onclick=closeModal;};
  document.querySelector('#rename-btn').onclick=()=>{showModal('What should we call you?','Pick a name for your little gardener.',`<input id="name-input" maxlength="16" value="${escapeHTML(playerName)}" placeholder="Your name"><button class="primary-btn" id="save-name">Save my name</button>`);document.querySelector('#save-name').onclick=()=>{playerName=document.querySelector('#name-input').value.trim()||'little sprout';localStorage.setItem('sproutName',playerName);document.querySelector('#player-name').textContent=playerName;closeModal();toast(`Hello, ${playerName}!`);};};
  document.querySelector('#inventory-btn').onclick=()=>{const slots=kinds.map(k=>`<button class="slot" data-kind="${k}" title="${defs[k].name}"><span class="slot-icon">${defs[k].icon}</span><span class="slot-count">${inventory[k]||0}</span></button>`).join('');showModal('Your pockets','All the lovely things you have found.',`<div class="inventory-grid">${slots}</div><button class="secondary-btn modal-done">Back to my world</button>`);document.querySelectorAll('.inventory-grid .slot').forEach(el=>el.onclick=()=>{selected=el.dataset.kind;drawHotbar();closeModal();});document.querySelector('.modal-done').onclick=closeModal;};
  document.querySelector('#history-btn').onclick=()=>{showModal('Little conversations','The latest messages from visitors in this world.',`<div class="help-list">${[...document.querySelector('#chat-feed').children].map(el=>`<div class="help-row">${el.innerHTML}</div>`).join('')||'<div class="help-row">It is quiet here. Say hello!</div>'}</div><button class="primary-btn modal-done">Close</button>`);document.querySelector('.modal-done').onclick=closeModal;};
  document.querySelector('#sound-btn').onclick=()=>toast('A peaceful world — sound is off');
  // World names can be entered directly from the world badge.
  document.querySelector('.world-title').style.cursor='pointer';document.querySelector('.world-title').onclick=()=>showModal('Visit a world','Choose a cozy world name. Friends using another tab can join by entering the same name.',`<input id="world-input" maxlength="20" value="${escapeHTML(worldName.toLowerCase().replaceAll(' ','-'))}" placeholder="world-name"><button class="primary-btn" id="visit-world">Travel to this world</button><button class="secondary-btn" id="home-world">Sunny Meadow</button>`);
  document.querySelector('#modal').addEventListener('click',e=>{if(e.target.id==='visit-world'){const n=document.querySelector('#world-input').value.trim().replace(/[^a-z0-9 -]/gi,'').replace(/\s+/g,' ').toUpperCase()||'SUNNY MEADOW';closeModal();generateWorld(n);}if(e.target.id==='home-world'){closeModal();generateWorld('SUNNY MEADOW');}});
  document.querySelector('#player-name').textContent=playerName;
  setInterval(()=>{broadcast({type:'move',x:player.x,y:player.y,name:playerName,face:player.face});updatePlayerCount();for(const[id,p]of remotePlayers)if(Date.now()-p.time>9000)remotePlayers.delete(id);},1500);
  generateWorld('SUNNY MEADOW');refreshInventory();requestAnimationFrame(loop);
})();
