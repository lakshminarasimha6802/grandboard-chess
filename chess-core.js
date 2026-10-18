/* Grandboard rules engine: fully local chess rules, no dependency or account. */
(function(global){
'use strict';
const FILES='abcdefgh';
const START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const weight={p:100,n:320,b:335,r:500,q:900,k:20000};
const idx=(r,c)=>r*8+c;
const sqname=i=>FILES[i%8]+(8-Math.floor(i/8));
const sqidx=s=> { if(!/^[a-h][1-8]$/.test(s||''))return -1;return (8-Number(s[1]))*8+FILES.indexOf(s[0]);};
const color=p=>!p?null:p===p.toUpperCase()?'w':'b';
const flip=c=>c==='w'?'b':'w';
const same=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
const cloneM=m=>({...m});
class ChessCore{
 constructor(fen=START){this.load(fen);}
 load(fen){
  if(!this.setFEN(fen))throw Error('Invalid chess position');
 }
 setFEN(fen){
  try{
   const a=fen.trim().split(/\s+/); if(a.length<4)return false;
   const ranks=a[0].split('/');if(ranks.length!==8)return false;
   let b=[];for(const row of ranks){let width=0;for(const x of row){if(/[1-8]/.test(x)){const n=+x;width+=n;for(let k=0;k<n;k++)b.push(null);}else if(/[pnbrqkPNBRQK]/.test(x)){b.push(x);width++;}else return false;}if(width!==8)return false;}
   if(b.length!==64||!['w','b'].includes(a[1])||!/^(?:-|[KQkq]+)$/.test(a[2])||!(/^-$|^[a-h][36]$/.test(a[3])))return false;
   this.board=b;this.turn=a[1];this.castle=a[2]==='-'?'':a[2];this.ep=a[3]==='-'?-1:sqidx(a[3]);this.halfmove=Number(a[4])||0;this.fullmove=Math.max(1,Number(a[5])||1);return true;
  }catch{return false;}
 }
 fen(){let s='';for(let r=0;r<8;r++){let blank=0;for(let c=0;c<8;c++){const p=this.board[idx(r,c)];if(!p)blank++;else{if(blank)s+=blank;blank=0;s+=p;}}if(blank)s+=blank;if(r!==7)s+='/';}return [s,this.turn,this.castle||'-',this.ep<0?'-':sqname(this.ep),this.halfmove,this.fullmove].join(' ');}
 clone(){return new ChessCore(this.fen());}
 piece(square){return this.board[typeof square==='string'?sqidx(square):square]||null;}
 kingIndex(side){return this.board.indexOf(side==='w'?'K':'k');}
 attacked(square,by){
  if(square<0)return false;const r=Math.floor(square/8),c=square%8,b=this.board;
  const pawn=by==='w'?'P':'p',d=by==='w'?1:-1;
  for(const dc of [-1,1])if(same(r+d,c+dc)&&b[idx(r+d,c+dc)]===pawn)return true;
  const knight=by==='w'?'N':'n';for(const [dr,dc] of [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]])if(same(r+dr,c+dc)&&b[idx(r+dr,c+dc)]===knight)return true;
  const king=by==='w'?'K':'k';for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if((dr||dc)&&same(r+dr,c+dc)&&b[idx(r+dr,c+dc)]===king)return true;
  for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]){
   let nr=r+dr,nc=c+dc;while(same(nr,nc)){const p=b[idx(nr,nc)];if(p){if(color(p)===by){const v=p.toLowerCase();if(dr===0||dc===0){if(v==='r'||v==='q')return true;}else if(v==='b'||v==='q')return true;}break;}nr+=dr;nc+=dc;}
  }
  return false;
 }
 checked(side=this.turn){return this.attacked(this.kingIndex(side),flip(side));}
 pseudo(side=this.turn){
  const moves=[],b=this.board;
  const push=(from,to,opts={})=>{if(!b[to]||b[to].toLowerCase()!=='k')moves.push({from,to,...opts});};
  for(let i=0;i<64;i++){const p=b[i];if(!p||color(p)!==side)continue;const t=p.toLowerCase(),r=i>>3,c=i%8;
   if(t==='p'){
    const d=side==='w'?-1:1, nr=r+d, promote=nr===0||nr===7;
    const pawnPush=(to,opts={})=>{if(promote)for(const promotion of ['q','r','b','n'])push(i,to,{...opts,promotion});else push(i,to,opts);};
    if(same(nr,c)&&!b[idx(nr,c)]){pawnPush(idx(nr,c));if(r===(side==='w'?6:1)&&!b[idx(r+2*d,c)])push(i,idx(r+2*d,c),{double:true});}
    for(const dc of [-1,1])if(same(nr,c+dc)){const target=idx(nr,c+dc);if(b[target]&&color(b[target])!==side&&b[target].toLowerCase()!=='k')pawnPush(target,{capture:true});else if(target===this.ep)pawnPush(target,{capture:true,enpassant:true});}
   }else if(t==='n'){
    for(const [dr,dc] of [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]])if(same(r+dr,c+dc)){const j=idx(r+dr,c+dc);if(!b[j]||color(b[j])!==side)push(i,j,{capture:!!b[j]});}
   }else if(t==='k'){
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if((dr||dc)&&same(r+dr,c+dc)){const j=idx(r+dr,c+dc);if(!b[j]||color(b[j])!==side)push(i,j,{capture:!!b[j]});}
    const home=side==='w'?60:4,enemy=flip(side);
    if(i===home&&!this.checked(side)){
     if(this.castle.includes(side==='w'?'K':'k')&&b[home+3]===(side==='w'?'R':'r')&&!b[home+1]&&!b[home+2]&&!this.attacked(home+1,enemy)&&!this.attacked(home+2,enemy))push(i,home+2,{castle:'K'});
     if(this.castle.includes(side==='w'?'Q':'q')&&b[home-4]===(side==='w'?'R':'r')&&!b[home-1]&&!b[home-2]&&!b[home-3]&&!this.attacked(home-1,enemy)&&!this.attacked(home-2,enemy))push(i,home-2,{castle:'Q'});
    }
   }else{
    const dirs=t==='b'?[[-1,-1],[-1,1],[1,-1],[1,1]]:t==='r'?[[-1,0],[1,0],[0,-1],[0,1]]:[[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]];
    for(const [dr,dc] of dirs){let nr=r+dr,nc=c+dc;while(same(nr,nc)){const j=idx(nr,nc);if(b[j]){if(color(b[j])!==side)push(i,j,{capture:true});break;}push(i,j);nr+=dr;nc+=dc;}}
   }
  }
  return moves;
 }
 applyRaw(m){
  const b=this.board,p=b[m.from],side=color(p),r0=m.from>>3,r1=m.to>>3;
  const captured=m.enpassant?b[m.to+(side==='w'?8:-8)]:b[m.to];
  b[m.to]=m.promotion?(side==='w'?m.promotion.toUpperCase():m.promotion):p;b[m.from]=null;
  if(m.enpassant)b[m.to+(side==='w'?8:-8)]=null;
  if(m.castle){let rf,rt;if(m.castle==='K'){rf=m.from+3;rt=m.from+1;}else{rf=m.from-4;rt=m.from-1;}b[rt]=b[rf];b[rf]=null;}
  if(p.toLowerCase()==='k')this.castle=this.castle.replace(side==='w'?/[KQ]/g:/[kq]/g,'');
  const orig={a1:56,h1:63,a8:0,h8:7};for(const [name,index] of Object.entries(orig))if(m.from===index||m.to===index)this.castle=this.castle.replace(({a1:'Q',h1:'K',a8:'q',h8:'k'})[name],'');
  this.ep=p.toLowerCase()==='p'&&Math.abs(r1-r0)===2?Math.floor((m.from+m.to)/2):-1;
  this.halfmove=(captured||p.toLowerCase()==='p')?0:this.halfmove+1;
  if(this.turn==='b')this.fullmove++;
  this.turn=flip(this.turn);
  return captured;
 }
 legalMoves(side=this.turn){
  const result=[];
  for(const m of this.pseudo(side)){
   const c=this.clone();c.turn=side;c.applyRaw(m);
   if(!c.checked(side))result.push(m);
  }
  return result;
 }
 play(move){
  const from=typeof move.from==='string'?sqidx(move.from):move.from,to=typeof move.to==='string'?sqidx(move.to):move.to;
  const options=this.legalMoves();const m=options.find(a=>a.from===from&&a.to===to&&(a.promotion||'q')===(move.promotion||'q'));
  if(!m)return null;
  const piece=this.board[m.from],pieceType=piece.toLowerCase(),side=this.turn;
  let san='';
  if(m.castle)san=m.castle==='K'?'O-O':'O-O-O';
  else{
   if(pieceType!=='p'){
    san=pieceType.toUpperCase();const others=options.filter(x=>x.from!==m.from&&x.to===m.to&&this.board[x.from].toLowerCase()===pieceType);
    if(others.length){const f=sqname(m.from)[0],rank=sqname(m.from)[1];san+=others.some(x=>sqname(x.from)[0]===f)?(others.some(x=>sqname(x.from)[1]===rank)?f+rank:rank):f;}
   }else if(m.capture)san+=sqname(m.from)[0];
   if(m.capture)san+='x';san+=sqname(m.to);if(m.promotion)san+='='+m.promotion.toUpperCase();
  }
  const captured=this.applyRaw(m);
  if(this.checked())san+=this.legalMoves().length?'＋':'#';
  return {...cloneM(m),from:sqname(m.from),to:sqname(m.to),uci:sqname(m.from)+sqname(m.to)+(m.promotion||''),san:san.replace('＋','+'),piece:pieceType,captured:captured?captured.toLowerCase():null,color:side};
 }
 outcome(){
  if(this.kingIndex('w')<0||this.kingIndex('b')<0)return {over:true,title:'Invalid position',reason:'Both kings are required.'};
  const legal=this.legalMoves();if(!legal.length)return this.checked()?{over:true,title:'Checkmate',reason:(this.turn==='w'?'Black':'White')+' wins by checkmate.'}:{over:true,title:'Draw',reason:'Stalemate.'};
  if(this.halfmove>=100)return{over:true,title:'Draw',reason:'50-move rule.'};
  const men=this.board.filter(Boolean),nonKings=men.filter(p=>p.toLowerCase()!=='k');
  if(!nonKings.length||(nonKings.length===1&&['b','n'].includes(nonKings[0].toLowerCase())))return{over:true,title:'Draw',reason:'Insufficient mating material.'};
  return{over:false};
 }
 static get START(){return START;}
 static get weight(){return weight;}
 static sqidx(s){return sqidx(s);}
 static sqname(i){return sqname(i);}
 static color(p){return color(p);}
}
global.ChessCore=ChessCore;
})(typeof window!=='undefined'?window:globalThis);
