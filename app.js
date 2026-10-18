/* Grandboard · playable offline with local AI; Stockfish 19 loads when internet is available. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const C=window.ChessCore;
const symbols={K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙',k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
const LEVELS={beginner:{label:'Beginner',elo:'~800',skill:0},intermediate:{label:'Intermediate',elo:'~1200',skill:3},senior:{label:'Senior',elo:'~1700',skill:8},master:{label:'Master',elo:'~2200',skill:15},grandmaster:{label:'Grandmaster',elo:'2800+',skill:20}};
const STORE='grandboard-chess-library-v1';
const COUNTER='grandboard-chess-game-counter';
let setup={mode:'computer',level:'senior',time:0,human:'w'};
let game=null,position=null,cursor=0,review=false,flipped=false,selection=null,hintSquares=[],pendingPromotion=null,thinking=false,computerTimer=null,clockStamp=0,saveStamp=0,resultShown=false;
let editorBoard=null,editorTool='P',editorOrigin='manual';
let aiTaskToken=0;
let storageWarning=false;
const own=x=>Object.prototype.hasOwnProperty.call(LEVELS,x)?x:'senior';
const colorName=s=>s==='w'?'White':'Black';
const sidePiece=p=>C.color(p);
function library(){try{const x=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(x)?x:[];}catch{storageWarning=true;return [];}}
function save(){if(!game)return;try{const arr=library();const found=arr.findIndex(x=>x.id===game.id);if(found>=0)arr[found]=game;else arr.push(game);localStorage.setItem(STORE,JSON.stringify(arr));storageWarning=false;}catch{storageWarning=true;notice('Your browser could not save this match. Export a PGN before closing the tab.');}renderLibrary();}
function nextID(){const all=library();const id=Math.max(Number((()=>{try{return localStorage.getItem(COUNTER);}catch{return 0;}})())||0,all.reduce((n,g)=>Math.max(n,Number(g.id)||0),0))+1;try{localStorage.setItem(COUNTER,String(id));}catch{}return id;}
function removeRecord(id){if(!confirm(`Delete Game ${id}? This cannot be undone.`))return;try{localStorage.setItem(STORE,JSON.stringify(library().filter(x=>x.id!==id)));}catch{notice('Could not delete this game from browser storage.');}renderLibrary();}
function renderLibrary(){const el=$('savedList');if(!el)return;el.innerHTML='';const arr=library().slice().sort((a,b)=>(Number(b.id)||0)-(Number(a.id)||0));if(!arr.length){el.innerHTML='<div class="empty-saved">Your games will appear here automatically.</div>';return;}
 for(const record of arr){const item=document.createElement('div');item.className='saved-item';const inf=document.createElement('div');inf.className='saved-info';const title=document.createElement('strong');title.textContent=`Game ${record.id}`;const small=document.createElement('small');small.textContent=`${record.mode==='computer'?'vs computer':record.mode==='manual'?'Custom position':'Two players'} · ${record.moves?.length||0} moves · ${record.result?.reason||'Saved'} · ${new Date(record.updated||record.created||Date.now()).toLocaleDateString()}`;inf.append(title,small);const open=document.createElement('button');open.textContent='Open ↗';open.setAttribute('aria-label',`Open Game ${record.id}`);open.addEventListener('click',()=>openSaved(record.id));const del=document.createElement('button');del.className='delete-saved';del.textContent='×';del.title=`Delete Game ${record.id}`;del.addEventListener('click',()=>removeRecord(record.id));item.append(inf,open,del);el.append(item);}
}
function showView(view){for(const name of ['setup','game','editor'])$(name+'View').classList.toggle('hidden',name!==view);window.scrollTo({top:0,behavior:'instant'});}
function notice(message){$('globalNotice').textContent=message;$('globalNotice').classList.remove('hidden');}
function clearNotice(){$('globalNotice').classList.add('hidden');}
function updateSetup(){
 document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===setup.mode;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
 document.querySelectorAll('[data-level]').forEach(b=>b.classList.toggle('selected',b.dataset.level===setup.level));
 document.querySelectorAll('[data-time]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.time)===setup.time));
 const local=setup.mode==='local',manual=setup.mode==='manual';
 $('computerLevels').classList.toggle('hidden',local||manual);
 $('localLevels').classList.toggle('hidden',!local);
 $('levelHeading').textContent=local?'Hint strength for each player':manual?'Arrange pieces your way':'Choose computer strength';
 $('eloHeader').textContent=manual?'POSITION EDITOR':'APPROX. ELO';
 $('colorControl').classList.toggle('hidden',setup.mode!=='computer');
 $('startBtn').firstElementChild.textContent=manual?'Open board editor':'Start playing';
}
function timeString(seconds){if(!game||!game.time)return '∞';const s=Math.max(0,Math.ceil(seconds));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function newRecord(initialFen,mode=setup.mode){const id=nextID(),clock=setup.time;return{id,mode,level:setup.level,whiteLevel:$('whiteLevel').value,blackLevel:$('blackLevel').value,allowHints:mode==='manual'?true:$('enableHints').checked,human:setup.human,time:clock,seconds:{w:clock,b:clock},snapshots:[{w:clock,b:clock}],initialFen,positions:[initialFen],moves:[],result:null,created:Date.now(),updated:Date.now()};}
function startGame(fen=C.START,mode=setup.mode){
 clearTimeout(computerTimer);aiTaskToken++;thinking=false;game=newRecord(fen,mode);position=new C(fen);cursor=0;review=false;flipped=mode==='computer'&&setup.human==='b';selection=null;hintSquares=[];resultShown=false;
 $('resultOverlay').classList.add('hidden');clearNotice();save();showView('game');render();startClock();scheduleComputer();
}
function openSaved(id){const saved=library().find(x=>x.id===id);if(!saved)return;clearTimeout(computerTimer);aiTaskToken++;thinking=false;
 game=JSON.parse(JSON.stringify(saved));if(!game.positions?.length){notice('Saved record is damaged.');return;}
 game.seconds=game.seconds||{w:game.time,b:game.time};game.snapshots=game.snapshots||[Object.assign({},game.seconds)];
 cursor=0;review=true;flipped=game.mode==='computer'&&game.human==='b';selection=null;hintSquares=[];resultShown=false;position=new C(game.positions[cursor]);
 $('resultOverlay').classList.add('hidden');clearNotice();showView('game');render();
}
function latest(){return game.positions.length-1;}
function startClock(){clockStamp=Date.now();}
function tick(){if(!game||review||game.result||!game.time||$('gameView').classList.contains('hidden')){clockStamp=Date.now();return;}
 const now=Date.now(),elapsed=Math.max(0,(now-clockStamp)/1000);clockStamp=now;
 if(!Number.isFinite(elapsed)||elapsed<=0)return;
 const side=position.turn;game.seconds[side]=Math.max(0,(game.seconds[side]??game.time)-elapsed);
 updateClocks();if(game.seconds[side]<=0){game.seconds[side]=0;game.result={over:true,title:'Time is up',reason:`${colorName(side==='w'?'b':'w')} wins on time.`};game.updated=Date.now();save();clearTimeout(computerTimer);render();finish();}
 else if(now-saveStamp>6000){game.updated=now;saveStamp=now;save();}
}
function updateClocks(){if(!game)return;
 const bottom=flipped?'b':'w',top=bottom==='w'?'b':'w';for(const [place,side] of [['top',top],['bottom',bottom]]){
  const el=$(place+'Clock');el.textContent=timeString(game.seconds[side]);el.classList.toggle('running',!review&&!game.result&&game.time>0&&side===position.turn);el.classList.toggle('low',game.time>0&&game.seconds[side]<30);
 }
}
function levelFor(side){if(game.mode==='computer'&&side!==game.human)return own(game.level);return game.mode==='local'?own(side==='w'?game.whiteLevel:game.blackLevel):'grandmaster';}
function labelFor(side){const level=LEVELS[levelFor(side)];return `${level.label.toUpperCase()} · ${level.elo} ELO (APPROX.)`;}
function renderPlayers(){const bottom=flipped?'b':'w',top=bottom==='w'?'b':'w';for(const [where,side] of [['top',top],['bottom',bottom]]){
 const cpu=game.mode==='computer'&&side!==game.human;
 $(where+'PlayerName').textContent=cpu?'Computer':game.mode==='computer'?'You':`${colorName(side)} player`;
 $(where+'PlayerRating').textContent=cpu?labelFor(side):game.mode==='local'?`HINTS · ${labelFor(side)}`:`${colorName(side).toUpperCase()} PIECES`;
 $(where+'Avatar').textContent=side==='w'?'♙':'♟';$(where+'Avatar').classList.toggle('light-avatar',side==='w');
 }updateClocks();
}
function renderBoard(){const board=$('board');board.innerHTML='';const turn=position.turn;const legal=selection?position.legalMoves().filter(m=>C.sqname(m.from)===selection):[];
 const last=cursor>0?game.moves[cursor-1]:null;
 for(let display=0;display<64;display++){
  const r=display>>3,c=display%8,realr=flipped?7-r:r,realc=flipped?7-c:c,idx=realr*8+realc,square=C.sqname(idx),piece=position.board[idx];
  const el=document.createElement('button');el.type='button';el.className='square '+((realr+realc)%2?'dark':'light');el.dataset.square=square;el.setAttribute('role','gridcell');el.setAttribute('aria-label',`${square}, ${piece?`${colorName(sidePiece(piece))} ${pieceName(piece)}`:'empty'}`);
  if(square===selection)el.classList.add('selected-square');
  if(last&&(last.from===square||last.to===square))el.classList.add('highlight');
  if(position.checked()&&piece===(turn==='w'?'K':'k'))el.classList.add('in-check');
  if(piece){const glyph=document.createElement('span');glyph.className='piece '+sidePiece(piece);glyph.textContent=symbols[piece];el.appendChild(glyph);el.draggable=!review&&(!thinking)&&(sidePiece(piece)===turn);el.addEventListener('dragstart',ev=>{if(review||thinking||!canHumanMove()){ev.preventDefault();return;}ev.dataTransfer.setData('text/plain',square);ev.dataTransfer.effectAllowed='move';selection=square;hintSquares=[];});}
  if(legal.some(m=>m.to===idx)){const mark=document.createElement('span');mark.className=piece?'capture-mark':'legal-dot';el.append(mark);}
  if(hintSquares.includes(square))el.classList.add('hint-square');
  if(c===0){const text=document.createElement('span');text.className='coord rank-coord';text.textContent=8-realr;el.append(text);}
  if(r===7){const text=document.createElement('span');text.className='coord file-coord';text.textContent='abcdefgh'[realc];el.append(text);}
  el.addEventListener('click',()=>squareClicked(square));el.addEventListener('dragover',ev=>{ev.preventDefault();});el.addEventListener('drop',ev=>{ev.preventDefault();const from=ev.dataTransfer.getData('text/plain');if(from&&from!==square){selection=from;attemptMove(from,square);}else squareClicked(square);});
  board.append(el);
 }
}
function pieceName(x){return {p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'}[x.toLowerCase()];}
function canHumanMove(){return !review&&!thinking&&!game.result&&(game.mode!=='computer'||position.turn===game.human);}
function squareClicked(square){if(!canHumanMove()){if(review)notice('You are reviewing a saved position. Select “Continue from this move” to play from here.');return;}
 const piece=position.piece(square);
 if(selection===square){selection=null;hintSquares=[];renderBoard();return;}
 if(selection&&attemptMove(selection,square))return;
 if(piece&&sidePiece(piece)===position.turn){selection=square;hintSquares=[];renderBoard();return;}
 selection=null;renderBoard();
}
function attemptMove(from,to){const choices=position.legalMoves().filter(m=>C.sqname(m.from)===from&&C.sqname(m.to)===to);if(!choices.length)return false;
 const promotions=choices.filter(m=>m.promotion);
 if(promotions.length){pendingPromotion={from,to};showPromotion();return true;}
 return makeMove({from,to});
}
function showPromotion(){const div=$('promotionChoices');div.innerHTML='';for(const letter of ['q','r','b','n']){const btn=document.createElement('button');btn.className='promotion-option';btn.textContent=symbols[position.turn==='w'?letter.toUpperCase():letter];btn.title=pieceName(letter);btn.addEventListener('click',()=>{const pending=pendingPromotion;pendingPromotion=null;$('promotionOverlay').classList.add('hidden');if(pending)makeMove({...pending,promotion:letter});});div.append(btn);}$('promotionOverlay').classList.remove('hidden');}
function makeMove(move){if(!game||review||game.result)return false;
 const made=position.play(move);if(!made)return false;
 game.moves.push({from:made.from,to:made.to,uci:made.uci,san:made.san});game.positions.push(position.fen());cursor=latest();game.snapshots.push({...game.seconds});game.updated=Date.now();game.result=position.outcome().over?position.outcome():null;
 selection=null;hintSquares=[];clearNotice();startClock();save();render();if(game.result)finish();else scheduleComputer();return true;
}
function finish(){if(!game?.result||review||resultShown)return;resultShown=true;$('resultTitle').textContent=game.result.title;$('resultReason').textContent=game.result.reason;$('resultOverlay').classList.remove('hidden');}
function renderMoves(){const box=$('moveList');box.innerHTML='';if(!game.moves.length){box.innerHTML='<div class="empty-moves">Your game’s story starts here.</div>';}else for(let i=0;i<game.moves.length;i+=2){const row=document.createElement('div');row.className='move-row';const num=document.createElement('span');num.className='move-number';num.textContent=String(i/2+1)+'.';row.append(num);for(let j=i;j<Math.min(i+2,game.moves.length);j++){const cell=document.createElement('span');cell.className='move-san';cell.textContent=game.moves[j].san;cell.title=`Jump to move ${j+1}`;cell.classList.toggle('current',cursor===j+1);cell.addEventListener('click',()=>goTo(j+1));row.append(cell);}box.append(row);}
 const n=latest();$('reviewPosition').textContent=review?`Move ${cursor} / ${n} · review`:`Move ${cursor} · live`;
 $('moveCount').textContent=String(game.moves.length).padStart(2,'0');
 $('firstMoveBtn').disabled=cursor===0;$('prevMoveBtn').disabled=cursor===0;$('nextMoveBtn').disabled=cursor===n;$('lastMoveBtn').disabled=cursor===n;
 $('continueBtn').classList.toggle('hidden',!review);$('undoBtn').disabled=thinking||(!game.moves.length)||review;
}
function render(){if(!game||!position)return;
 $('gameView').querySelector('.game-title').innerHTML=`Game ${game.id}<span class="accent">.</span>`;
 renderBoard();renderPlayers();renderMoves();
 const outcome=position.outcome(),end=review?null:(game.result||outcome.over&&outcome);
 $('turnText').textContent=review?`Review · ${colorName(position.turn)} to move`:end?end.title:`${colorName(position.turn)} to move${position.checked()?' · Check!':''}`;
 $('statusText').textContent=review?'Clocks paused during review':end?end.reason:thinking?'Thinking about the move…':game.mode==='computer'&&position.turn!==game.human?'Computer is thinking':'Game in progress';
 $('hintBtn').disabled=review||thinking||!game.allowHints||Boolean(game.result);
 $('hintBtn').querySelector('span:nth-child(2)').textContent=thinking?'Thinking…':!game.allowHints?'Hints disabled':'Hint · play best move';
 $('editPositionBtn').disabled=thinking;$('boardMessage').textContent=review?'Review moves with the arrow buttons, then continue or edit.':game.mode==='computer'&&position.turn!==game.human?'Computer is choosing a move…':'Click or drag a piece to move. Hints play a move for the side to move.';
 $('engineStatus').textContent=engineStatusText();$('engineDot').className='engine-dot '+(engine.ready?'ready':engine.failed?'problem':'');
}
function goTo(n){if(!game||thinking)return;cursor=Math.max(0,Math.min(latest(),n));review=true;position=new C(game.positions[cursor]);selection=null;hintSquares=[];if(game.snapshots[cursor])game.seconds={...game.snapshots[cursor]};startClock();$('resultOverlay').classList.add('hidden');resultShown=false;render();}
function continueFromReview(){if(!game||!review)return;game.moves=game.moves.slice(0,cursor);game.positions=game.positions.slice(0,cursor+1);game.snapshots=game.snapshots.slice(0,cursor+1);game.result=null;review=false;position=new C(game.positions[cursor]);selection=null;hintSquares=[];clearNotice();game.updated=Date.now();save();startClock();render();const out=position.outcome();if(out.over){game.result=out;save();finish();}else scheduleComputer();}
function undo(){if(!game||review||thinking||!game.moves.length)return;
 aiTaskToken++;clearTimeout(computerTimer);let n=1;if(game.mode==='computer'&&position.turn===game.human&&game.moves.length>=2)n=2;
 game.moves.splice(Math.max(0,game.moves.length-n),n);game.positions.splice(game.positions.length-n,n);game.snapshots.splice(game.snapshots.length-n,n);cursor=latest();position=new C(game.positions[cursor]);game.seconds={...(game.snapshots[cursor]||{w:game.time,b:game.time})};game.result=null;resultShown=false;selection=null;hintSquares=[];$('resultOverlay').classList.add('hidden');game.updated=Date.now();save();startClock();render();scheduleComputer();
}
function downloadPGN(){
 if(!game)return;
 let result='*';
 if(game.result){
  if(game.result.reason.startsWith('White wins'))result='1-0';
  else if(game.result.reason.startsWith('Black wins'))result='0-1';
  else if(game.result.title==='Draw')result='1/2-1/2';
 }
 const lines=[`[Event "Grandboard Game ${game.id}"]`,`[Site "Grandboard"]`,`[Date "${new Date(game.created).toISOString().slice(0,10).replaceAll('-','.')}"]`,`[White "${game.mode==='computer'&&game.human==='b'?'Stockfish / AI':'Player'}"]`,`[Black "${game.mode==='computer'&&game.human==='w'?'Stockfish / AI':'Player'}"]`,`[Result "${result}"]`];
 if(game.initialFen!==C.START)lines.push('[SetUp "1"]',`[FEN "${game.initialFen}"]`);
 const blackStarts=game.initialFen.split(' ')[1]==='b';
 const formatted=game.moves.map((m,i)=>{
  const ply=i+(blackStarts?1:0),moveNo=Math.floor(ply/2)+1;
  return ply%2===0?`${moveNo}. ${m.san}`:i===0?`${moveNo}... ${m.san}`:m.san;
 }).join(' ');
 const pgn=lines.join('\n')+'\n\n'+formatted+' '+result+'\n';
 const url=URL.createObjectURL(new Blob([pgn],{type:'application/x-chess-pgn'}));
 const a=document.createElement('a');a.href=url;a.download=`game-${game.id}.pgn`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
/* Stockfish 19 on an external CDN, with a local JS search fallback if blocked or offline. */
class StockfishBridge{
 constructor(){this.ready=false;this.failed=false;this.worker=null;this.inflight=null;this.queue=[];this.started=Date.now();this.load();}
 async load(){
  let local=false;
  if(location.protocol==='http:'||location.protocol==='https:'){
   try{const response=await fetch('./engine/stockfish-19-lite-single.js',{method:'HEAD'});local=response.ok;}catch{}
  }
  try{
   let worker;
   if(local){worker=new Worker('./engine/stockfish-19-lite-single.js');}
   else{const source='importScripts(\"https://cdn.jsdelivr.net/npm/stockfish@19.0.0/bin/stockfish-19-asm.js\");';
    const url=URL.createObjectURL(new Blob([source],{type:'application/javascript'}));worker=new Worker(url);URL.revokeObjectURL(url);}
   this.worker=worker;this.local=local;worker.onmessage=e=>this.message(String(e.data));worker.onerror=()=>this.fail(true);worker.postMessage('uci');
   setTimeout(()=>{if(!this.ready)this.fail(true);},14000);
  }catch{this.fail(true);}
 }
 fail(force=false){if(this.failed||this.ready&&!force)return;this.failed=true;this.ready=false;try{this.worker?.terminate();}catch{}this.worker=null;while(this.queue.length)this.queue.shift().resolve(null);if(this.inflight){clearTimeout(this.inflight.timeout);this.inflight.resolve(null);this.inflight=null;}if(game)render();}
 message(line){if(line.includes('uciok')){this.ready=true;this.failed=false;this.worker.postMessage('isready');if(game)render();return;}
  const m=line.match(/bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/);if(m&&this.inflight){const current=this.inflight;this.inflight=null;clearTimeout(current.timeout);current.resolve(m[1]);this.startNext();}}
 bestMove(fen,level){if(!this.ready)return Promise.resolve(null);return new Promise(resolve=>{this.queue.push({fen,level,resolve});this.startNext();});}
 startNext(){if(!this.ready||this.inflight||!this.queue.length)return;const job=this.queue.shift();this.inflight=job;const n=LEVELS[job.level]||LEVELS.senior;
  if(job.level==='grandmaster'){this.worker.postMessage('setoption name UCI_LimitStrength value false');this.worker.postMessage('setoption name Skill Level value 20');}
  else{this.worker.postMessage('setoption name UCI_LimitStrength value true');this.worker.postMessage('setoption name UCI_Elo value '+Math.max(1320,parseInt(n.elo.replace(/\D/g,''),10)||1600));this.worker.postMessage('setoption name Skill Level value '+n.skill);}
  this.worker.postMessage('position fen '+job.fen);this.worker.postMessage('go movetime '+(job.level==='grandmaster'?1600:job.level==='master'?950:450));
  job.timeout=setTimeout(()=>{if(this.inflight===job){this.inflight=null;job.resolve(null);this.fail(true);}},6500);
 }
}
let engine={ready:false,failed:false};
function engineStatusText(){return engine.ready?(engine.local?'Stockfish 19 WASM · strongest mode':'Stockfish 19 online · powerful AI'):engine.failed?'Offline AI active · weaker than Stockfish':'Connecting to Stockfish… offline AI is ready';}
function evalState(pos){const w=C.weight;let points=0;for(let i=0;i<64;i++){const p=pos.board[i];if(!p)continue;const side=sidePiece(p),sign=side===pos.turn?1:-1;const row=i>>3,col=i%8,central=3.5-(Math.abs(row-3.5)+Math.abs(col-3.5))/2;
  let bonus=central*(p.toLowerCase()==='n'?8:p.toLowerCase()==='b'?5:2);
  if(p.toLowerCase()==='p')bonus+=((side==='w'?6-row:row-1)*6);
  points+=sign*(w[p.toLowerCase()]+bonus);
 }return points;}
const TIMEOUT=Symbol('timeout');
function orderMoves(pos,moves){return moves.slice().sort((a,b)=>moveHeuristic(pos,b)-moveHeuristic(pos,a));}
function moveHeuristic(pos,m){return (m.capture?(C.weight[(pos.board[m.to]||'p').toLowerCase()]||100)*5:0)+(m.promotion?900:0)+(m.castle?50:0)+(4-Math.abs(m.to%8-3.5))*3;}
function mini(pos,depth,alpha,beta,deadline,nodes){nodes.n++;if((nodes.n&63)===0&&Date.now()>deadline)throw TIMEOUT;const choices=pos.legalMoves();if(!choices.length)return pos.checked()?-200000-depth:0;
 if(depth===0)return evalState(pos);
 let best=-Infinity;const sorted=orderMoves(pos,choices);for(const m of sorted){const copy=pos.clone();copy.applyRaw(m);const v=-mini(copy,depth-1,-beta,-alpha,deadline,nodes);best=Math.max(best,v);alpha=Math.max(alpha,v);if(alpha>=beta)break;}
 return best;
}
function localMove(pos,level){let moves=pos.legalMoves();if(!moves.length)return null;
 if(level==='beginner'){const captures=moves.filter(m=>m.capture);const set=Math.random()<0.5&&captures.length?captures:moves;return set[Math.floor(Math.random()*set.length)];}
 const deadline=Date.now()+(level==='grandmaster'?1600:level==='master'?1100:level==='senior'?650:300);const target=level==='intermediate'?2:level==='senior'?2:level==='master'?3:4;
 moves=orderMoves(pos,moves);let chosen=moves[0],maxD=Math.min(target,4),rng=(x)=>Math.random()*.001;
 for(let depth=1;depth<=maxD;depth++){
  try{let best=-Infinity,answer=null;const nodes={n:0};for(const m of moves){if(Date.now()>deadline)throw TIMEOUT;const copy=pos.clone();copy.applyRaw(m);let v=-mini(copy,depth-1,-Infinity,Infinity,deadline,nodes)+rng();if(v>best){best=v;answer=m;}}
   if(answer)chosen=answer;
  }catch(e){if(e!==TIMEOUT)console.warn(e);break;}
 }
 return chosen;
}
async function bestMoveForCurrent(){if(!game||!position)return null;const p=position.clone(),fen=p.fen(),level=levelFor(p.turn);
 if(engine.ready&&!['beginner','intermediate'].includes(level)){
  const uci=await engine.bestMove(fen,level);
  if(uci){const found=p.legalMoves().find(m=>C.sqname(m.from)+C.sqname(m.to)+(m.promotion||'')===uci);if(found)return{from:C.sqname(found.from),to:C.sqname(found.to),promotion:found.promotion||undefined};}
 }
 const fallback=localMove(p,level);return fallback?{from:C.sqname(fallback.from),to:C.sqname(fallback.to),promotion:fallback.promotion||undefined}:null;
}
async function playEngineMove(asHint=false){if(!game||review||game.result||thinking)return;const token=++aiTaskToken,fen=position.fen();thinking=true;selection=null;hintSquares=[];render();
 try{await new Promise(r=>setTimeout(r,75));const suggested=await bestMoveForCurrent();if(token!==aiTaskToken||!game||review||position.fen()!==fen)return;
  thinking=false;if(!suggested){notice('No legal suggestion is available in this position.');render();return;}
  if(asHint)notice(`Played suggested move ${suggested.from} → ${suggested.to} for ${colorName(position.turn)}.`);
  makeMove(suggested);
 }catch(err){thinking=false;notice('The engine could not analyze that position. Try again.');console.error(err);render();}
}
function scheduleComputer(){clearTimeout(computerTimer);if(!game||review||game.result||game.mode!=='computer'||position.turn===game.human)return;computerTimer=setTimeout(()=>playEngineMove(false),320);}
function editCurrent(){if(!game)return;openEditor(position.fen(),'review');}
function openEditor(fen=C.START,origin='manual'){editorBoard=new C(fen);editorOrigin=origin;editorTool='P';$('editorTurn').value=editorBoard.turn;$('editorError').classList.add('hidden');renderEditor();showView('editor');}
function renderEditor(){const board=$('editorBoard');board.innerHTML='';for(let i=0;i<64;i++){const name=C.sqname(i),piece=editorBoard.board[i],el=document.createElement('button');el.type='button';el.className='square '+(((i>>3)+i%8)%2?'dark':'light');el.setAttribute('aria-label',`Edit square ${name}`);
 if(piece){const span=document.createElement('span');span.className='piece '+sidePiece(piece);span.textContent=symbols[piece];el.append(span);}if(i%8===0){const s=document.createElement('span');s.className='coord rank-coord';s.textContent=8-(i>>3);el.append(s);}if((i>>3)===7){const s=document.createElement('span');s.className='coord file-coord';s.textContent='abcdefgh'[i%8];el.append(s);}
 el.addEventListener('click',()=>{editorBoard.board[i]=editorTool==='erase'?null:editorTool;renderEditor();});el.addEventListener('contextmenu',ev=>{ev.preventDefault();editorBoard.board[i]=null;renderEditor();});board.append(el);}
 const palette=$('editorPalette');palette.innerHTML='';for(const p of ['K','Q','R','B','N','P','k','q','r','b','n','p','erase']){const b=document.createElement('button');b.type='button';b.className='editor-piece '+(p==='erase'?'eraser':p===p.toLowerCase()?'blackpiece':'');b.classList.toggle('selected',p===editorTool);b.textContent=p==='erase'?'⌫ Erase selected square':symbols[p];b.title=p==='erase'?'Erase piece':`${p===p.toUpperCase()?'White':'Black'} ${pieceName(p)}`;b.setAttribute('aria-label',b.title);b.addEventListener('click',()=>{editorTool=p;renderEditor();});palette.append(b);}
}
function editorMessage(msg){$('editorError').textContent=msg;$('editorError').classList.remove('hidden');}
function startEdited(){const turn=$('editorTurn').value;editorBoard.turn=turn;const b=editorBoard.board;
 if(b.filter(x=>x==='K').length!==1||b.filter(x=>x==='k').length!==1){editorMessage('Put exactly one white king and one black king on the board.');return;}
 for(let c=0;c<8;c++)if(['p','P'].includes(b[c])||['p','P'].includes(b[56+c])){editorMessage('Pawns cannot start on ranks 1 or 8.');return;}
 let castle='';if(b[60]==='K'){if(b[63]==='R')castle+='K';if(b[56]==='R')castle+='Q';}if(b[4]==='k'){if(b[7]==='r')castle+='k';if(b[0]==='r')castle+='q';}
 editorBoard.castle=castle;editorBoard.ep=-1;editorBoard.halfmove=0;editorBoard.fullmove=1;
 if(editorBoard.checked(turn==='w'?'b':'w')){editorMessage('The player who just moved cannot already be in check. Adjust the pieces or change who moves next.');return;}
 const fen=editorBoard.fen();let check;try{check=new C(fen);}catch{editorMessage('This position is not valid. Please adjust your pieces.');return;}
 if(!check.legalMoves().length){editorMessage('There are no legal moves from this position. Please adjust the board.');return;}
 startGame(fen,'manual');if(editorOrigin==='review')notice('Created a new saved game from your edited position. Your original match is preserved.');
}
function returnHome(){clearTimeout(computerTimer);aiTaskToken++;thinking=false;selection=null;hintSquares=[];$('resultOverlay').classList.add('hidden');$('promotionOverlay').classList.add('hidden');if(game){game.updated=Date.now();save();}game=null;position=null;showView('setup');renderLibrary();}
function bind(){
 document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{setup.mode=b.dataset.mode;updateSetup();}));
 document.querySelectorAll('[data-level]').forEach(b=>b.addEventListener('click',()=>{setup.level=b.dataset.level;updateSetup();}));
 document.querySelectorAll('[data-time]').forEach(b=>b.addEventListener('click',()=>{setup.time=Number(b.dataset.time);updateSetup();}));
 $('humanColor').addEventListener('change',e=>setup.human=e.target.value);
 $('startBtn').addEventListener('click',()=>setup.mode==='manual'?openEditor():startGame());
 $('brandLink').addEventListener('click',e=>{e.preventDefault();returnHome();});
 $('backBtn').addEventListener('click',returnHome);
 $('editorBackBtn').addEventListener('click',returnHome);
 $('hintBtn').addEventListener('click',()=>playEngineMove(true));
 $('undoBtn').addEventListener('click',undo);
 $('flipBtn').addEventListener('click',()=>{flipped=!flipped;render();});
 $('firstMoveBtn').addEventListener('click',()=>goTo(0));$('prevMoveBtn').addEventListener('click',()=>goTo(cursor-1));$('nextMoveBtn').addEventListener('click',()=>goTo(cursor+1));$('lastMoveBtn').addEventListener('click',()=>goTo(latest()));
 $('continueBtn').addEventListener('click',continueFromReview);
 $('editPositionBtn').addEventListener('click',editCurrent);$('downloadBtn').addEventListener('click',downloadPGN);
 $('editorClearBtn').addEventListener('click',()=>{editorBoard.board.fill(null);editorBoard.castle='';renderEditor();});
 $('editorResetBtn').addEventListener('click',()=>{editorBoard=new C(C.START);$('editorTurn').value='w';renderEditor();});
 $('editorStartBtn').addEventListener('click',startEdited);
 $('rematchBtn').addEventListener('click',()=>startGame(game.initialFen,game.mode));
 $('resultNewBtn').addEventListener('click',returnHome);
 $('resultReviewBtn').addEventListener('click',()=>{$('resultOverlay').classList.add('hidden');});
 document.addEventListener('keydown',ev=>{if($('gameView').classList.contains('hidden')||ev.target.closest('input,select,textarea'))return;
  if(ev.key==='ArrowLeft'){ev.preventDefault();goTo(cursor-1);}if(ev.key==='ArrowRight'){ev.preventDefault();goTo(cursor+1);}if(ev.key==='Home'){ev.preventDefault();goTo(0);}if(ev.key==='End'){ev.preventDefault();goTo(latest());}
 });
 window.addEventListener('pagehide',()=>{if(game)save();});
}
bind();updateSetup();renderLibrary();engine=new StockfishBridge();setInterval(tick,250);
})();
