// src/pages/MonsterGamePage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../services/database';
import { speechService } from '../services/speech';
import { Word, WordGroup } from '../types';

type GameState = 'select' | 'playing' | 'result';
type InputLang = 'en' | 'vi';

interface Monster {
  id: number; word: Word; x: number; y: number; speed: number;
  hp: number; maxHp: number;
  monsterIdx: number;
  tier: 0 | 1 | 2;
  frame: number; frameTimer: number;
}
interface Particle {
  id: number; x: number; y: number; vx: number; vy: number;
  text?: string; color: string; size: number; life: number; maxLife: number;
  type: 'text'|'spark'|'star';
}

// ─── 6 Beast Data ─────────────────────────────────────────────────────────────
const MONSTERS_DATA = [
  { id:'wolf',  emoji:'🐺', fps:130,
    tiers:[{name:'Sói Hoang',color:'#94a3b8',dark:'#334155',accent:'#cbd5e1'},{name:'Sói Đen',color:'#3b82f6',dark:'#1d4ed8',accent:'#93c5fd'},{name:'Sói Địa Ngục',color:'#dc2626',dark:'#7f1d1d',accent:'#fca5a5'}]},
  { id:'bear',  emoji:'🐻', fps:180,
    tiers:[{name:'Gấu Rừng',color:'#92400e',dark:'#451a03',accent:'#fcd34d'},{name:'Gấu Tuyết',color:'#cbd5e1',dark:'#64748b',accent:'#ffffff'},{name:'Gấu Địa Ngục',color:'#7c3aed',dark:'#3b0764',accent:'#c4b5fd'}]},
  { id:'shark', emoji:'🦈', fps:120,
    tiers:[{name:'Cá Mập Xanh',color:'#0284c7',dark:'#0c4a6e',accent:'#7dd3fc'},{name:'Cá Mập Búa',color:'#0f766e',dark:'#042f2e',accent:'#5eead4'},{name:'Hải Quái',color:'#312e81',dark:'#1e1b4b',accent:'#818cf8'}]},
  { id:'tiger', emoji:'🐯', fps:115,
    tiers:[{name:'Hổ Vằn',color:'#d97706',dark:'#78350f',accent:'#fde68a'},{name:'Hổ Trắng',color:'#e2e8f0',dark:'#1e293b',accent:'#f8fafc'},{name:'Hổ Lửa',color:'#ef4444',dark:'#450a0a',accent:'#fbbf24'}]},
  { id:'eagle', emoji:'🦅', fps:100,
    tiers:[{name:'Đại Bàng',color:'#78350f',dark:'#1c0701',accent:'#fcd34d'},{name:'Phượng Hoàng',color:'#f97316',dark:'#7c2d12',accent:'#fef08a'},{name:'Đại Bàng Sấm',color:'#7c3aed',dark:'#2e1065',accent:'#fbbf24'}]},
  { id:'snake', emoji:'🐍', fps:150,
    tiers:[{name:'Rắn Độc',color:'#16a34a',dark:'#14532d',accent:'#86efac'},{name:'Rắn Hổ Chúa',color:'#ca8a04',dark:'#713f12',accent:'#fde68a'},{name:'Bạch Xà Thần',color:'#e2e8f0',dark:'#1e293b',accent:'#818cf8'}]},
];
const TIER_CONFIG = [
  {label:'Thường',  hpMult:1, sizeMult:1.0, glowColor:'',       speedMult:1.0},
  {label:'Elite',   hpMult:2, sizeMult:1.25, glowColor:'#22d3ee',speedMult:1.1},
  {label:'Boss',    hpMult:3, sizeMult:1.6,  glowColor:'#f59e0b',speedMult:0.82},
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
type Ctx = CanvasRenderingContext2D;
function aura(ctx:Ctx, tier:number, glowColor:string, r:number){
  if(tier===0) return;
  ctx.strokeStyle=glowColor; ctx.lineWidth=tier===2?2.5:1.5;
  ctx.globalAlpha=0.35+Math.sin(Date.now()/300)*0.18;
  ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
  if(tier===2){ctx.fillStyle=glowColor;ctx.globalAlpha=0.08+Math.sin(Date.now()/450)*0.05;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;
}
function crown(ctx:Ctx, cy:number, jewel='#ef4444'){
  ctx.fillStyle='#fbbf24';
  ctx.beginPath();
  ctx.moveTo(-12,cy);ctx.lineTo(-12,cy-10);ctx.lineTo(-6,cy-6);ctx.lineTo(0,cy-14);ctx.lineTo(6,cy-6);ctx.lineTo(12,cy-10);ctx.lineTo(12,cy);
  ctx.closePath();ctx.fill();
  ctx.fillStyle=jewel;ctx.beginPath();ctx.arc(0,cy-14,2.8,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#60a5fa';ctx.beginPath();ctx.arc(-12,cy-10,1.8,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(12,cy-10,1.8,0,Math.PI*2);ctx.fill();
}

// ─── WOLF ─────────────────────────────────────────────────────────────────────
function drawWolf(ctx:Ctx, tier:number, frame:number, cx:number, cy:number, sz:number){
  const t=MONSTERS_DATA[0].tiers[tier]; const f=frame%8; const s=sz/56;
  const sway=Math.sin(f*0.8)*(tier===2?3:1.5);
  ctx.save();ctx.translate(cx+sway,cy);ctx.scale(s,s);
  aura(ctx,tier,TIER_CONFIG[tier].glowColor,42+tier*6);
  // shadow
  ctx.fillStyle='rgba(0,0,0,0.28)';ctx.beginPath();ctx.ellipse(0,32,20+tier*3,5,0,0,Math.PI*2);ctx.fill();
  // tail
  const tw=Math.sin(f*1.1)*20;
  ctx.strokeStyle=t.dark;ctx.lineWidth=6+tier*1.5;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(18,8);ctx.bezierCurveTo(28,-2,32+tw*0.3,-8+tw,28,-14+tw);ctx.stroke();
  ctx.strokeStyle=t.color;ctx.lineWidth=4+tier;
  ctx.beginPath();ctx.moveTo(18,8);ctx.bezierCurveTo(28,-2,32+tw*0.3,-8+tw,28,-14+tw);ctx.stroke();
  if(tier===2){ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.arc(28,-14+tw,5,0,Math.PI*2);ctx.fill();}
  // body
  const bw=16+tier*5,bh=12+tier*4;
  ctx.fillStyle=t.dark;ctx.beginPath();ctx.ellipse(0,8,bw+2,bh+2,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=t.color;ctx.beginPath();ctx.ellipse(0,8,bw,bh,0,0,Math.PI*2);ctx.fill();
  // fur lines
  ctx.strokeStyle=t.dark;ctx.lineWidth=0.9;
  [[-8,2],[-2,4],[6,2],[10,6]].forEach(([fx,fy])=>{ctx.beginPath();ctx.moveTo(fx,fy);ctx.lineTo(fx-1,fy+4);ctx.stroke();});
  // tier2 spikes on back
  if(tier===2){ctx.fillStyle='#1e293b';[[-4,0],[-1,-2],[2,0]].forEach(([sx,sy])=>{ctx.beginPath();ctx.moveTo(sx,sy+4);ctx.lineTo(sx-2,sy-8);ctx.lineTo(sx+2,sy-8);ctx.fill();});}
  // neck+head
  ctx.fillStyle=t.dark;ctx.beginPath();ctx.ellipse(-10,-2,10,9,-0.3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=t.color;ctx.beginPath();ctx.ellipse(-10,-2,8,7,-0.3,0,Math.PI*2);ctx.fill();
  const hSz=13+tier*2;
  ctx.fillStyle=t.dark;ctx.beginPath();ctx.ellipse(-18,-8,hSz+2,hSz,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=t.color;ctx.beginPath();ctx.ellipse(-18,-8,hSz,hSz-1,0,0,Math.PI*2);ctx.fill();
  // muzzle
  ctx.fillStyle=tier===2?'#7f1d1d':t.dark;ctx.beginPath();ctx.ellipse(-26,-5,7,5,-0.2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=tier===2?'#450a0a':t.accent;ctx.beginPath();ctx.ellipse(-26,-5,5,3.5,-0.2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#0f0f1a';ctx.beginPath();ctx.ellipse(-30,-6,3,2.5,0,0,Math.PI*2);ctx.fill();
  // panting mouth tier2
  if(tier===2&&f%4<2){ctx.fillStyle='#ef4444';ctx.beginPath();ctx.moveTo(-28,-2);ctx.arc(-26,-2,4,0,Math.PI);ctx.fill();ctx.strokeStyle='#fca5a5';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-26,-2);ctx.lineTo(-26,3);ctx.stroke();}
  // ears
  const earH=10+tier*3;
  ctx.fillStyle=t.dark;ctx.beginPath();ctx.moveTo(-24,-16);ctx.lineTo(-20,-16-earH);ctx.lineTo(-14,-14);ctx.fill();
  ctx.beginPath();ctx.moveTo(-12,-16);ctx.lineTo(-8,-16-earH*0.8);ctx.lineTo(-4,-15);ctx.fill();
  ctx.fillStyle=tier===2?'#7f1d1d':'#fda4af';
  ctx.beginPath();ctx.moveTo(-22,-15);ctx.lineTo(-19,-15-earH*0.7);ctx.lineTo(-15,-14);ctx.fill();
  // eyes
  const eyeC=tier===2?'#ef4444':tier===1?'#93c5fd':'#f8fafc';
  ctx.fillStyle=eyeC;ctx.beginPath();ctx.arc(-20,-10,3+tier,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#0f0f1a';ctx.beginPath();ctx.arc(-20,-10,1.5,0,Math.PI*2);ctx.fill();
  if(tier>=1){ctx.strokeStyle=eyeC;ctx.lineWidth=1;ctx.globalAlpha=0.45;ctx.beginPath();ctx.arc(-20,-10,6+tier,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  // legs
  const la=[0,3,0,-3][f%4],legW=5+tier,legH=8+tier*2;
  ctx.fillStyle=t.dark;
  ctx.fillRect(-8,18,legW,legH+la);ctx.fillRect(0,18,legW,legH-la);ctx.fillRect(8,18,legW,legH+la);
  ctx.fillStyle=tier===2?'#dc2626':t.dark;
  ctx.beginPath();ctx.ellipse(-6,26+la,legW,3.5,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(2,26-la,legW,3.5,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(10,26+la,legW,3.5,0,0,Math.PI*2);ctx.fill();
  if(tier===2) crown(ctx,-26,'#ef4444');
  ctx.restore();
}

// ─── BEAR ─────────────────────────────────────────────────────────────────────
function drawBear(ctx:Ctx, tier:number, frame:number, cx:number, cy:number, sz:number){
  const t=MONSTERS_DATA[1].tiers[tier]; const f=frame%6; const s=sz/62;
  const bob=Math.sin(f*0.5)*(tier===2?4:2);
  ctx.save();ctx.translate(cx,cy+bob);ctx.scale(s,s);
  aura(ctx,tier,TIER_CONFIG[tier].glowColor,48+tier*8);
  ctx.fillStyle='rgba(0,0,0,0.28)';ctx.beginPath();ctx.ellipse(0,38,28+tier*5,6,0,0,Math.PI*2);ctx.fill();
  const bSz=20+tier*7;
  ctx.fillStyle=t.dark;ctx.beginPath();ctx.ellipse(0,10,bSz+3,bSz,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=t.color;ctx.beginPath();ctx.ellipse(0,10,bSz,bSz-2,0,0,Math.PI*2);ctx.fill();
  // belly
  ctx.fillStyle=tier===2?'#4c1d95':t.accent;ctx.globalAlpha=0.4;
  ctx.beginPath();ctx.ellipse(0,14,bSz*0.55,bSz*0.6,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  // runes tier2
  if(tier===2){ctx.strokeStyle='#c4b5fd';ctx.lineWidth=1.5;ctx.globalAlpha=0.6;ctx.beginPath();ctx.moveTo(-8,5);ctx.lineTo(0,-5);ctx.lineTo(8,5);ctx.stroke();ctx.beginPath();ctx.moveTo(-5,8);ctx.lineTo(5,8);ctx.stroke();ctx.globalAlpha=1;}
  const hSz=18+tier*4;
  ctx.fillStyle=t.dark;ctx.beginPath();ctx.arc(0,-14,hSz+2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=t.color;ctx.beginPath();ctx.arc(0,-14,hSz,0,Math.PI*2);ctx.fill();
  const earR=7+tier*2;
  ctx.fillStyle=t.dark;ctx.beginPath();ctx.arc(-18-tier,-26-tier*2,earR+1,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(18+tier,-26-tier*2,earR+1,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=tier===2?'#6d28d9':t.color;ctx.beginPath();ctx.arc(-18-tier,-26-tier*2,earR-1,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(18+tier,-26-tier*2,earR-1,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fda4af';ctx.beginPath();ctx.arc(-18-tier,-26-tier*2,3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(18+tier,-26-tier*2,3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=tier===2?'#4c1d95':t.dark;ctx.beginPath();ctx.ellipse(0,-9,8,6,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#0f0f1a';ctx.beginPath();ctx.ellipse(0,-11,4,3,0,0,Math.PI*2);ctx.fill();
  const eyeC=tier===2?'#a78bfa':tier===1?'#bfdbfe':'#fff';
  ctx.fillStyle=eyeC;ctx.beginPath();ctx.arc(-8,-17,4+tier,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(8,-17,4+tier,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#0f0f1a';ctx.beginPath();ctx.arc(-8,-17,2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(8,-17,2,0,Math.PI*2);ctx.fill();
  if(tier>=1){ctx.strokeStyle=eyeC;ctx.lineWidth=1;ctx.globalAlpha=0.4;ctx.beginPath();ctx.arc(-8,-17,8,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(8,-17,8,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  const la=[0,4,0,-4][f%4];
  ctx.fillStyle=t.dark;
  ctx.beginPath();ctx.ellipse(-bSz-2,8+la,7+tier,10+tier,0.3,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(bSz+2,8-la,7+tier,10+tier,-0.3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=t.color;
  ctx.beginPath();ctx.ellipse(-bSz-1,8+la,6+tier,9+tier,0.3,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(bSz+1,8-la,6+tier,9+tier,-0.3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=tier===2?'#6d28d9':'#1e293b';
  [-4,-1,2].forEach(ox=>{ctx.beginPath();ctx.moveTo(-bSz-1+ox,16+la);ctx.lineTo(-bSz-1+ox-1,22+la);ctx.lineTo(-bSz-1+ox+1,22+la);ctx.fill();ctx.beginPath();ctx.moveTo(bSz+1+ox,16-la);ctx.lineTo(bSz+1+ox-1,22-la);ctx.lineTo(bSz+1+ox+1,22-la);ctx.fill();});
  ctx.fillStyle=t.dark;ctx.fillRect(-12,28,10,12+la);ctx.fillRect(2,28,10,12-la);
  if(tier===2) crown(ctx,-36,'#a78bfa');
  ctx.restore();
}

// ─── SHARK ────────────────────────────────────────────────────────────────────
function drawShark(ctx:Ctx, tier:number, frame:number, cx:number, cy:number, sz:number){
  const t=MONSTERS_DATA[2].tiers[tier]; const f=frame%8; const s=sz/60;
  const swim=Math.sin(f*0.9)*(tier===2?5:3);
  const tilt=Math.sin(f*0.9)*0.07;
  ctx.save();ctx.translate(cx,cy+swim);ctx.rotate(tilt);ctx.scale(s,s);
  aura(ctx,tier,TIER_CONFIG[tier].glowColor,46+tier*6);
  // tail
  const tw=Math.sin(f*1.1)*12;
  ctx.fillStyle=t.dark;ctx.beginPath();ctx.moveTo(28,0);ctx.lineTo(44,-10+tw);ctx.lineTo(44,10+tw*0.5);ctx.closePath();ctx.fill();
  ctx.fillStyle=t.color;ctx.beginPath();ctx.moveTo(28,0);ctx.lineTo(42,-8+tw);ctx.lineTo(42,8+tw*0.5);ctx.closePath();ctx.fill();
  const bLen=26+tier*5,bH=10+tier*3;
  ctx.fillStyle=t.dark;ctx.beginPath();ctx.ellipse(0,0,bLen+2,bH+2,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=t.color;ctx.beginPath();ctx.ellipse(0,0,bLen,bH,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=tier===2?'#312e81':'#e2e8f0';ctx.globalAlpha=0.45;
  ctx.beginPath();ctx.ellipse(0,3,bLen*0.7,bH*0.45,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  ctx.strokeStyle=t.dark;ctx.lineWidth=1.5;
  [-4,-1,2].forEach(gx=>{ctx.beginPath();ctx.moveTo(gx*2,-bH*0.5);ctx.lineTo(gx*2,bH*0.5);ctx.stroke();});
  // electric tier2
  if(tier===2&&f%3===0){ctx.strokeStyle='#818cf8';ctx.lineWidth=1;ctx.globalAlpha=0.7;ctx.beginPath();ctx.moveTo(-8,-bH);ctx.lineTo(-4,-bH-5);ctx.lineTo(0,-bH-2);ctx.lineTo(4,-bH-7);ctx.stroke();ctx.globalAlpha=1;}
  // dorsal fin
  ctx.fillStyle=t.dark;ctx.beginPath();ctx.moveTo(-8,-bH);ctx.lineTo(-4,-bH-18-tier*6);ctx.lineTo(4,-bH);ctx.fill();
  ctx.fillStyle=tier===2?'#312e81':t.color;ctx.beginPath();ctx.moveTo(-7,-bH+1);ctx.lineTo(-4,-bH-15-tier*5);ctx.lineTo(3,-bH+1);ctx.fill();
  // pec fins
  const finAng=Math.sin(f*0.7)*5;
  ctx.fillStyle=t.dark;
  ctx.beginPath();ctx.moveTo(-4,4);ctx.lineTo(-18,12+finAng);ctx.lineTo(-6,bH*0.8);ctx.fill();
  ctx.beginPath();ctx.moveTo(-4,4);ctx.lineTo(-18,-12-finAng);ctx.lineTo(-6,-bH*0.8);ctx.fill();
  // head jaw
  ctx.fillStyle=t.dark;ctx.beginPath();ctx.moveTo(-bLen,0);ctx.lineTo(-bLen+8,-bH);ctx.lineTo(-6,-bH);ctx.lineTo(-6,0);ctx.fill();
  ctx.fillStyle=tier===2?'#1e1b4b':t.dark;ctx.beginPath();ctx.moveTo(-bLen,0);ctx.lineTo(-bLen+8,bH);ctx.lineTo(-6,bH);ctx.lineTo(-6,0);ctx.fill();
  ctx.fillStyle='#f8fafc';
  const tc=3+tier;
  for(let i=0;i<tc;i++){const tx=-bLen+6+i*(bLen*0.5/tc);ctx.beginPath();ctx.moveTo(tx,-3);ctx.lineTo(tx+2,-8-tier);ctx.lineTo(tx+4,-3);ctx.fill();}
  const eyeC=tier===2?'#818cf8':tier===1?'#5eead4':'#f8fafc';
  ctx.fillStyle=eyeC;ctx.beginPath();ctx.arc(-bLen+10,-3,4+tier,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#0f0f1a';ctx.beginPath();ctx.arc(-bLen+10,-3,2,0,Math.PI*2);ctx.fill();
  if(tier>=1){ctx.strokeStyle=eyeC;ctx.lineWidth=1;ctx.globalAlpha=0.5;ctx.beginPath();ctx.arc(-bLen+10,-3,7,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  // tentacles boss
  if(tier===2){ctx.strokeStyle='#4338ca';ctx.lineWidth=3;ctx.lineCap='round';[5,10,16].forEach((ox,i)=>{const wave=Math.sin(f*0.8+i)*8;ctx.beginPath();ctx.moveTo(ox,bH);ctx.bezierCurveTo(ox,bH+10,ox+wave,bH+18,ox+wave*1.5,bH+25);ctx.stroke();});}
  if(tier===2){ctx.save();ctx.translate(-bLen+6,-bH-4);crown(ctx,-10,'#818cf8');ctx.restore();}
  ctx.restore();
}

// ─── TIGER ────────────────────────────────────────────────────────────────────
function drawTiger(ctx:Ctx, tier:number, frame:number, cx:number, cy:number, sz:number){
  const t=MONSTERS_DATA[3].tiers[tier]; const f=frame%8; const s=sz/58;
  const prowl=Math.sin(f*0.7)*(tier===2?3.5:2);
  ctx.save();ctx.translate(cx+prowl,cy);ctx.scale(s,s);
  aura(ctx,tier,TIER_CONFIG[tier].glowColor,44+tier*7);
  ctx.fillStyle='rgba(0,0,0,0.24)';ctx.beginPath();ctx.ellipse(0,34,24+tier*4,5,0,0,Math.PI*2);ctx.fill();
  // tail
  const tw=Math.sin(f*1.0)*20;
  ctx.strokeStyle=t.dark;ctx.lineWidth=6+tier*2;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(20,8);ctx.bezierCurveTo(30,0,32+tw*0.4,-8+tw,28,-14+tw);ctx.stroke();
  ctx.strokeStyle=t.color;ctx.lineWidth=4+tier;
  ctx.beginPath();ctx.moveTo(20,8);ctx.bezierCurveTo(30,0,32+tw*0.4,-8+tw,28,-14+tw);ctx.stroke();
  if(tier===2){ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.arc(28,-14+tw,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f97316';ctx.beginPath();ctx.arc(28,-14+tw,3,0,Math.PI*2);ctx.fill();}
  // body
  const bW=18+tier*5,bH=12+tier*3;
  ctx.fillStyle=t.dark;ctx.beginPath();ctx.ellipse(2,8,bW+2,bH+2,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=t.color;ctx.beginPath();ctx.ellipse(2,8,bW,bH,0,0,Math.PI*2);ctx.fill();
  // stripes
  ctx.strokeStyle=t.dark;ctx.lineWidth=2+tier;ctx.lineCap='round';
  [-6,0,6,12].forEach(sx=>{ctx.beginPath();ctx.moveTo(sx,0);ctx.lineTo(sx-1,16);ctx.stroke();});
  if(tier===2){ctx.strokeStyle='#f97316';ctx.lineWidth=1;ctx.globalAlpha=0.55;[-6,0,6,12].forEach(sx=>{ctx.beginPath();ctx.moveTo(sx,0);ctx.lineTo(sx-1,16);ctx.stroke();});ctx.globalAlpha=1;}
  // fire mane tier2
  if(tier===2){ctx.fillStyle='#f97316';ctx.globalAlpha=0.8;[-8,-4,0,4].forEach((ox,i)=>{const fh=10+i*3;ctx.beginPath();ctx.moveTo(-16+ox,-12);ctx.lineTo(-16+ox+2,-12-fh);ctx.lineTo(-16+ox+4,-12);ctx.fill();});ctx.globalAlpha=1;}
  // neck head
  ctx.fillStyle=t.dark;ctx.beginPath();ctx.ellipse(-10,-2,12,10,-0.2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=t.color;ctx.beginPath();ctx.ellipse(-10,-2,10,8,-0.2,0,Math.PI*2);ctx.fill();
  const hSz=13+tier*2;
  ctx.fillStyle=t.dark;ctx.beginPath();ctx.arc(-20,-9,hSz+2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=t.color;ctx.beginPath();ctx.arc(-20,-9,hSz,0,Math.PI*2);ctx.fill();
  // head stripes
  ctx.strokeStyle=t.dark;ctx.lineWidth=1.5;
  [[-24,-16],[-18,-17],[-12,-16]].forEach(([sx,sy])=>{ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+1,sy+6);ctx.stroke();});
  ctx.fillStyle=tier===2?'#450a0a':t.dark;ctx.beginPath();ctx.ellipse(-28,-6,7,5.5,-0.1,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=tier===1?'#f1f5f9':tier===2?'#fca5a5':'#fef3c7';ctx.beginPath();ctx.ellipse(-28,-6,5,4,-0.1,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#0f0f1a';ctx.beginPath();ctx.ellipse(-32,-7,3,2.5,0,0,Math.PI*2);ctx.fill();
  const earH=10+tier*3;
  ctx.fillStyle=t.dark;ctx.beginPath();ctx.moveTo(-27,-18);ctx.lineTo(-24,-18-earH);ctx.lineTo(-16,-16);ctx.fill();
  ctx.beginPath();ctx.moveTo(-14,-18);ctx.lineTo(-11,-18-earH*0.8);ctx.lineTo(-4,-17);ctx.fill();
  ctx.fillStyle='#fda4af';ctx.beginPath();ctx.moveTo(-25,-17);ctx.lineTo(-23,-17-earH*0.65);ctx.lineTo(-17,-16);ctx.fill();
  const eyeC=tier===2?'#f97316':tier===1?'#bfdbfe':'#fef9c3';
  ctx.fillStyle=eyeC;ctx.beginPath();ctx.arc(-22,-11,3.5+tier,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#0f0f1a';ctx.beginPath();ctx.arc(-22,-11,1.8,0,Math.PI*2);ctx.fill();
  if(tier>=1){ctx.strokeStyle=eyeC;ctx.lineWidth=1;ctx.globalAlpha=0.45;ctx.beginPath();ctx.arc(-22,-11,7+tier,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  const la=[0,3,0,-3][f%4];
  ctx.fillStyle=t.dark;
  ctx.fillRect(-10,18,6+tier,9+la);ctx.fillRect(-2,18,6+tier,9-la);ctx.fillRect(6,18,6+tier,9+la);ctx.fillRect(14,18,6+tier,9-la);
  ctx.fillStyle=tier===2?'#ef4444':'#0f0f1a';
  [-1,2].forEach(cx2=>{ctx.beginPath();ctx.moveTo(cx2,26+la);ctx.lineTo(cx2-1,30+la);ctx.lineTo(cx2+1,30+la);ctx.fill();});
  if(tier===2) crown(ctx,-24,'#ef4444');
  ctx.restore();
}

// ─── EAGLE ────────────────────────────────────────────────────────────────────
function drawEagle(ctx:Ctx, tier:number, frame:number, cx:number, cy:number, sz:number){
  const t=MONSTERS_DATA[4].tiers[tier]; const f=frame%8; const s=sz/60;
  const wingFlap=[0,-4,-8,-10,-12,-10,-8,-4][f];
  const bob=Math.sin(f*0.7)*2;
  ctx.save();ctx.translate(cx,cy+bob);ctx.scale(s,s);
  aura(ctx,tier,TIER_CONFIG[tier].glowColor,54+tier*8);
  const wSpan=28+tier*8;
  ctx.fillStyle=t.dark+'aa';
  ctx.beginPath();ctx.moveTo(-6,-4);ctx.lineTo(-wSpan-8,-16+wingFlap);ctx.lineTo(-wSpan,14);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(6,-4);ctx.lineTo(wSpan+8,-16+wingFlap);ctx.lineTo(wSpan,14);ctx.closePath();ctx.fill();
  ctx.fillStyle=t.color;
  ctx.beginPath();ctx.moveTo(-6,-4);ctx.lineTo(-wSpan,-14+wingFlap);ctx.lineTo(-wSpan+4,12);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(6,-4);ctx.lineTo(wSpan,-14+wingFlap);ctx.lineTo(wSpan-4,12);ctx.closePath();ctx.fill();
  ctx.fillStyle=tier===2?'#7c3aed':t.accent;ctx.globalAlpha=0.5;
  ctx.beginPath();ctx.moveTo(-6,-2);ctx.lineTo(-wSpan*0.7,-10+wingFlap);ctx.lineTo(-wSpan*0.65,10);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(6,-2);ctx.lineTo(wSpan*0.7,-10+wingFlap);ctx.lineTo(wSpan*0.65,10);ctx.closePath();ctx.fill();
  ctx.globalAlpha=1;
  ctx.strokeStyle=t.dark;ctx.lineWidth=1;
  for(let i=0;i<4+tier;i++){const r=0.4+i*0.15;ctx.beginPath();ctx.moveTo(-wSpan*r,(-14+wingFlap)*r);ctx.lineTo(-wSpan*r,14*r);ctx.stroke();ctx.beginPath();ctx.moveTo(wSpan*r,(-14+wingFlap)*r);ctx.lineTo(wSpan*r,14*r);ctx.stroke();}
  if(tier===2){ctx.strokeStyle='#fbbf24';ctx.lineWidth=1.5;ctx.globalAlpha=0.7;ctx.beginPath();ctx.moveTo(-wSpan*0.5,-10+wingFlap*0.5);ctx.lineTo(-wSpan*0.6,-4);ctx.lineTo(-wSpan*0.4,-8);ctx.stroke();ctx.beginPath();ctx.moveTo(wSpan*0.5,-10+wingFlap*0.5);ctx.lineTo(wSpan*0.6,-4);ctx.lineTo(wSpan*0.4,-8);ctx.stroke();ctx.globalAlpha=1;}
  ctx.fillStyle=t.dark;ctx.beginPath();ctx.ellipse(0,8,13,18,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=t.color;ctx.beginPath();ctx.ellipse(0,8,11,16,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=t.accent;ctx.globalAlpha=0.55;ctx.beginPath();ctx.ellipse(0,10,7,10,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  const hSz=11+tier*2;
  ctx.fillStyle=t.dark;ctx.beginPath();ctx.arc(0,-10,hSz+2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=t.color;ctx.beginPath();ctx.arc(0,-10,hSz,0,Math.PI*2);ctx.fill();
  if(tier===1){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,-10,hSz*0.7,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.moveTo(9,-12);ctx.lineTo(18,-10);ctx.lineTo(16,-6);ctx.lineTo(11,-8);ctx.closePath();ctx.fill();
  ctx.fillStyle='#b45309';ctx.beginPath();ctx.moveTo(9,-10);ctx.lineTo(17,-9);ctx.lineTo(16,-7);ctx.lineTo(11,-8);ctx.closePath();ctx.fill();
  const eyeC=tier===2?'#fbbf24':tier===1?'#f97316':'#fef9c3';
  ctx.fillStyle=eyeC;ctx.beginPath();ctx.arc(5,-12,3.5+tier,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#0f0f1a';ctx.beginPath();ctx.arc(5,-12,2,0,Math.PI*2);ctx.fill();
  if(tier>=1){ctx.strokeStyle=eyeC;ctx.lineWidth=1;ctx.globalAlpha=0.5;ctx.beginPath();ctx.arc(5,-12,7,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  const la=[0,3,0,-3][f%4];
  ctx.fillStyle='#fbbf24';ctx.fillRect(-8,22,4,8+la);ctx.fillRect(4,22,4,8-la);
  ctx.fillStyle=t.dark;
  [[-10,30+la],[-7,30+la],[-4,30+la],[2,30-la],[5,30-la],[8,30-la]].forEach(([tx2,ty2])=>{ctx.beginPath();ctx.moveTo(tx2,ty2);ctx.lineTo(tx2-1,ty2+5);ctx.lineTo(tx2+1,ty2+5);ctx.fill();});
  if(tier===2){ctx.strokeStyle='#fbbf24';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-6,-22);ctx.lineTo(-2,-30);ctx.lineTo(2,-24);ctx.lineTo(6,-32);ctx.lineTo(4,-22);ctx.stroke();ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.arc(6,-32,3,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}

// ─── SNAKE ────────────────────────────────────────────────────────────────────
function drawSnake(ctx:Ctx, tier:number, frame:number, cx:number, cy:number, sz:number){
  const t=MONSTERS_DATA[5].tiers[tier]; const f=frame%8; const s=sz/54;
  const phase=(f/8)*Math.PI*2;
  ctx.save();ctx.translate(cx,cy);ctx.scale(s,s);
  aura(ctx,tier,TIER_CONFIG[tier].glowColor,50+tier*7);
  const segs=11+tier*2, segSpacing=60/segs, amp=8+tier*3;
  for(let i=segs;i>=0;i--){
    const bx=-28+i*segSpacing, by=Math.sin(phase+i*0.5)*amp;
    const r=(3+tier*1.5)*(1+(segs-i)/(segs*2));
    ctx.fillStyle=t.dark;ctx.beginPath();ctx.arc(bx,by+5,r+1.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=i%3===0&&tier>0?t.accent:t.color;ctx.beginPath();ctx.arc(bx,by+5,r,0,Math.PI*2);ctx.fill();
  }
  if(tier===2){const tx=28+segs*segSpacing*0.1,ty=Math.sin(phase+segs*0.5)*amp+5;ctx.fillStyle='#ca8a04';[0,1,2].forEach(i=>{ctx.beginPath();ctx.arc(tx+i*4,ty,3-i*0.5,0,Math.PI*2);ctx.fill();});}
  const hx=-28, hy=Math.sin(phase)*amp+5, hW=12+tier*3, hH=8+tier*2;
  ctx.fillStyle=t.dark;ctx.beginPath();ctx.ellipse(hx-4,hy,hW+2,hH+2,-0.2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=tier===2?'#1e293b':t.dark;ctx.beginPath();ctx.ellipse(hx-4,hy,hW,hH,-0.2,0,Math.PI*2);ctx.fill();
  if(tier>=1){ctx.fillStyle=t.color;ctx.globalAlpha=0.55;ctx.beginPath();ctx.ellipse(hx-4,hy,hW*1.6,hH*1.4,-0.2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
  if(tier===2){ctx.fillStyle='#e2e8f0';ctx.globalAlpha=0.2;ctx.beginPath();ctx.ellipse(hx-4,hy,hW*2,hH*1.8,-0.2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
  const eyeC=tier===2?'#f8fafc':tier===1?'#fde68a':'#facc15';
  ctx.fillStyle=eyeC;ctx.beginPath();ctx.arc(hx-2,hy-3,2.5+tier,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#0f0f1a';ctx.beginPath();ctx.arc(hx-2,hy-3,1.2,0,Math.PI*2);ctx.fill();
  if(tier>=1){ctx.strokeStyle=eyeC;ctx.lineWidth=1;ctx.globalAlpha=0.5;ctx.beginPath();ctx.arc(hx-2,hy-3,6+tier,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  if(f%4<2){ctx.strokeStyle=tier===2?'#e2e8f0':'#f43f5e';ctx.lineWidth=1.5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(hx-14,hy);ctx.lineTo(hx-20,hy-2);ctx.moveTo(hx-20,hy-2);ctx.lineTo(hx-24,hy-5);ctx.moveTo(hx-20,hy-2);ctx.lineTo(hx-24,hy+1);ctx.stroke();}
  ctx.fillStyle='#f8fafc';
  ctx.beginPath();ctx.moveTo(hx-12,hy-hH);ctx.lineTo(hx-10,hy-hH-5-tier);ctx.lineTo(hx-8,hy-hH);ctx.fill();
  ctx.beginPath();ctx.moveTo(hx-6,hy-hH);ctx.lineTo(hx-4,hy-hH-4-tier);ctx.lineTo(hx-2,hy-hH);ctx.fill();
  if(tier===2){ctx.fillStyle='#818cf8';ctx.beginPath();ctx.arc(hx-10,hy-hH-5,1.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(hx-4,hy-hH-4,1.5,0,Math.PI*2);ctx.fill();}
  if(tier===2){ctx.save();ctx.translate(hx-4,hy-hH-4);crown(ctx,-12,'#818cf8');ctx.restore();}
  ctx.restore();
}

const DRAW_FNS = [drawWolf, drawBear, drawShark, drawTiger, drawEagle, drawSnake];

function drawMonster(ctx:Ctx, monsterIdx:number, tier:number, frame:number, x:number, y:number, baseSize:number){
  DRAW_FNS[monsterIdx](ctx, tier, frame, x, y, baseSize * TIER_CONFIG[tier].sizeMult);
}

// ─── Background ───────────────────────────────────────────────────────────────
function drawBgFar(ctx:Ctx, w:number, h:number, off:number){
  const pts=[40,120,200,310,430,520,610,70,260,390,560];
  ctx.fillStyle='#6366f1';
  pts.forEach((px,i)=>{const tx=((px-off*0.08)%(w+40)+w+40)%(w+40)-20;ctx.globalAlpha=0.15+Math.sin(Date.now()/900+i)*0.08;ctx.beginPath();ctx.arc(tx,20+(i%5)*14,1.5,0,Math.PI*2);ctx.fill();});
  ctx.globalAlpha=1;
  for(let x=((-(off*0.12))%160+160)%160-40;x<w+40;x+=160){
    ctx.fillStyle='#1a1a35';ctx.fillRect(x,0,50,h);
    ctx.fillStyle='#22224a';ctx.fillRect(x+3,0,44,h);
    for(let y=15;y<h;y+=18){ctx.fillStyle='#2a2a52';ctx.fillRect(x+3,y,44,1.5);}
  }
}
function drawBgMid(ctx:Ctx, w:number, h:number, off:number){
  const torchOff=((-(off*0.45))%200+200)%200;
  for(let x=torchOff-40;x<w+40;x+=200){
    ctx.fillStyle='#374151';ctx.fillRect(x-3,h*0.18,6,24);ctx.fillRect(x-8,h*0.18,16,6);
    const flicker=Math.sin(Date.now()/120)*2;
    ctx.globalAlpha=0.9;ctx.fillStyle='#f97316';
    ctx.beginPath();ctx.moveTo(x-5,h*0.18-2);ctx.quadraticCurveTo(x-8+flicker,h*0.18-18,x,h*0.18-22+flicker);ctx.quadraticCurveTo(x+8-flicker,h*0.18-18,x+5,h*0.18-2);ctx.fill();
    ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.moveTo(x-3,h*0.18-2);ctx.quadraticCurveTo(x+flicker,h*0.18-14,x,h*0.18-18+flicker);ctx.quadraticCurveTo(x-flicker,h*0.18-14,x+3,h*0.18-2);ctx.fill();
    ctx.fillStyle='#f97316';ctx.globalAlpha=0.07+Math.sin(Date.now()/200)*0.03;ctx.beginPath();ctx.ellipse(x,h*0.18-10,40,30,0,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
    ctx.fillStyle='#312e81';ctx.fillRect(x-30,h*0.55,60,16);
    ctx.fillStyle='#4338ca';ctx.fillRect(x-28,h*0.55,56,5);
    ctx.fillStyle='#1e1b4b';ctx.fillRect(x-28,h*0.55+11,56,5);
  }
}
function drawBgNear(ctx:Ctx, w:number, h:number, off:number){
  ctx.fillStyle='#1e1b4b';ctx.fillRect(0,h-28,w,28);
  const tileOff=((-off)%64+64)%64;
  for(let x=tileOff-32;x<w+32;x+=64){ctx.fillStyle='#23204f';ctx.fillRect(x,h-28,62,12);ctx.fillStyle='#2d2a5e';ctx.fillRect(x+1,h-27,60,4);ctx.fillStyle='#1e1b4b';ctx.fillRect(x,h-16,62,16);}
  ctx.fillStyle='#111827';
  for(let x=((-(off*1.4))%280+280)%280-60;x<w+60;x+=280){ctx.fillRect(x,0,30,h-28);ctx.fillStyle='#1f2937';ctx.fillRect(x+2,0,5,h-28);ctx.fillStyle='#111827';}
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MonsterGamePage(){
  const [gameState,setGameState]=useState<GameState>('select');
  const [groups,setGroups]=useState<WordGroup[]>([]);
  const [selectedGroups,setSelectedGroups]=useState<number[]>([]);
  const [inputLang,setInputLang]=useState<InputLang>('en');
  const [score,setScore]=useState(0);
  const [lives,setLives]=useState(3);
  const [level,setLevel]=useState(1);
  const [killed,setKilled]=useState(0);
  const [combo,setCombo]=useState(0);
  const [input,setInput]=useState('');
  const [shakeField,setShakeField]=useState(false);
  const [levelUpFlash,setLevelUpFlash]=useState(false);

  const canvasRef=useRef<HTMLCanvasElement>(null);
  const inputRef=useRef<HTMLInputElement>(null);
  const frameRef=useRef<number>(0);
  const monstersRef=useRef<Monster[]>([]);
  const particlesRef=useRef<Particle[]>([]);
  const wordsRef=useRef<Word[]>([]);
  const idCounter=useRef(0);
  const spawnTimer=useRef<any>(null);
  const livesRef=useRef(3);
  const levelRef=useRef(1);
  const killedRef=useRef(0);
  const scoreRef=useRef(0);
  const comboRef=useRef(0);
  const bgOffsetRef=useRef(0);
  const canvasSizeRef=useRef({w:800,h:500});

  useEffect(()=>{db.getGroups().then(res=>{if(res.success)setGroups(res.data||[]);});return()=>{cleanup();};},[]);
  const cleanup=()=>{cancelAnimationFrame(frameRef.current);if(spawnTimer.current)clearInterval(spawnTimer.current);};

  const spawnParticles=(x:number,y:number,pts:number,cmb:number,mIdx:number,tier:number)=>{
    const {w,h}=canvasSizeRef.current;
    const px=x/100*w,py=y/100*h;
    const tc=MONSTERS_DATA[mIdx].tiers[tier];
    const newP:Particle[]=[];
    newP.push({id:Date.now(),x:px,y:py,vx:0,vy:-2.5,text:`+${pts}`,color:cmb>=5?'#fbbf24':tc.color,size:cmb>=5?22:18,life:60,maxLife:60,type:'text'});
    const cols=[tc.color,tc.accent,'#fbbf24','#a78bfa','#60a5fa'];
    for(let i=0;i<14;i++){const ang=(i/14)*Math.PI*2+Math.random()*0.3,spd=2+Math.random()*4;newP.push({id:Date.now()+i+1,x:px,y:py,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-1,color:cols[i%cols.length],size:3+Math.random()*4,life:35+Math.random()*20,maxLife:55,type:'spark'});}
    if(cmb>=3){for(let i=0;i<6;i++){const ang=(i/6)*Math.PI*2;newP.push({id:Date.now()+100+i,x:px,y:py,vx:Math.cos(ang)*1.8,vy:Math.sin(ang)*1.8-2,color:'#fbbf24',size:9,life:50,maxLife:50,type:'star'});}}
    particlesRef.current=[...particlesRef.current,...newP];
  };

  const spawnDamageParticles=(x:number,y:number)=>{
    const {w,h}=canvasSizeRef.current;const px=x/100*w,py=y/100*h;
    const newP:Particle[]=[{id:Date.now(),x:px,y:py,vx:0,vy:-2,text:'-1 ❤️',color:'#ef4444',size:18,life:55,maxLife:55,type:'text'}];
    for(let i=0;i<8;i++){const ang=(i/8)*Math.PI*2;newP.push({id:Date.now()+i+1,x:px,y:py,vx:Math.cos(ang)*2.5,vy:Math.sin(ang)*2.5,color:'#ef4444',size:4,life:30,maxLife:30,type:'spark'});}
    particlesRef.current=[...particlesRef.current,...newP];
  };

  const renderCanvas=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const {w,h}=canvasSizeRef.current;
    ctx.clearRect(0,0,w,h);
    const grad=ctx.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,'#0d0d1a');grad.addColorStop(0.7,'#0f0f22');grad.addColorStop(1,'#1a0a0a');
    ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
    drawBgFar(ctx,w,h,bgOffsetRef.current);
    drawBgMid(ctx,w,h,bgOffsetRef.current);
    drawBgNear(ctx,w,h,bgOffsetRef.current);
    const dGrad=ctx.createLinearGradient(0,h-32,0,h);
    dGrad.addColorStop(0,'rgba(239,68,68,0)');dGrad.addColorStop(1,`rgba(239,68,68,${0.12+Math.sin(Date.now()/400)*0.06})`);
    ctx.fillStyle=dGrad;ctx.fillRect(0,h-80,w,80);

    monstersRef.current.forEach(m=>{
      const px=(m.x/100)*w,py=(m.y/100)*h;
      const baseSize=44;
      const tc2=TIER_CONFIG[m.tier];
      const mSize=baseSize*tc2.sizeMult;
      const md=MONSTERS_DATA[m.monsterIdx];
      const td=md.tiers[m.tier];
      // word bubble
      const wordText=inputLang==='en'?m.word.Vietnamese:m.word.English;
      ctx.font='bold 13px "Space Grotesk",sans-serif';
      const tw=ctx.measureText(wordText).width;
      const bw=tw+20,bh=26,bx=px-bw/2,by=py+mSize*0.55+6;
      const bubbleBorder=m.tier===2?'rgba(245,158,11,0.8)':m.tier===1?'rgba(34,211,238,0.65)':'rgba(99,102,241,0.5)';
      ctx.fillStyle='rgba(6,6,20,0.88)';ctx.beginPath();ctx.roundRect(bx,by,bw,bh,6);ctx.fill();
      ctx.strokeStyle=bubbleBorder;ctx.lineWidth=1;ctx.stroke();
      if(m.tier>0){const tLabel=m.tier===2?'BOSS':'ELITE';const tColor=m.tier===2?'#f59e0b':'#22d3ee';ctx.font='bold 9px "Space Grotesk",sans-serif';ctx.fillStyle=tColor;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(tLabel,px,by-8);}
      ctx.font='bold 13px "Space Grotesk",sans-serif';
      ctx.fillStyle=td.accent;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(wordText,px,by+bh/2);
      if(m.maxHp>1){const bpx=px-24,bpy=by+bh+4;ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(bpx,bpy,48,5);ctx.fillStyle=m.tier===2?'#f59e0b':'#22d3ee';ctx.fillRect(bpx,bpy,48*(m.hp/m.maxHp),5);}
      drawMonster(ctx,m.monsterIdx,m.tier,m.frame,px,py,baseSize);
    });

    particlesRef.current=particlesRef.current.filter(p=>p.life>0);
    particlesRef.current.forEach(p=>{
      const alpha=p.life/p.maxLife;ctx.globalAlpha=alpha;
      if(p.type==='text'&&p.text){ctx.font=`bold ${p.size}px "Space Grotesk",sans-serif`;ctx.fillStyle=p.color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor=p.color;ctx.shadowBlur=12;ctx.fillText(p.text,p.x,p.y);ctx.shadowBlur=0;}
      else if(p.type==='star'){ctx.fillStyle=p.color;const sz=p.size*(0.5+alpha*0.5);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Date.now()/200);ctx.beginPath();for(let i=0;i<5;i++){const a=(i/5)*Math.PI*2-Math.PI/2,ia=a+Math.PI/5;i===0?ctx.moveTo(Math.cos(a)*sz,Math.sin(a)*sz):ctx.lineTo(Math.cos(a)*sz,Math.sin(a)*sz);ctx.lineTo(Math.cos(ia)*sz*0.4,Math.sin(ia)*sz*0.4);}ctx.closePath();ctx.fill();ctx.restore();}
      else{ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size*alpha,0,Math.PI*2);ctx.fill();}
      p.x+=p.vx;p.y+=p.vy;p.vy+=0.12;p.life--;
    });
    ctx.globalAlpha=1;
  },[inputLang]);

  const startGame=async()=>{
    const res=selectedGroups.length>0?await db.getWordsByGroups(selectedGroups):await db.getWords();
    if(!res.success||!res.data?.length){alert('Không có từ nào!');return;}
    const words=[...res.data].sort(()=>Math.random()-0.5);
    wordsRef.current=words;
    monstersRef.current=[];particlesRef.current=[];
    setInput('');setScore(0);setLives(3);setLevel(1);setKilled(0);setCombo(0);setShakeField(false);setLevelUpFlash(false);
    livesRef.current=3;levelRef.current=1;killedRef.current=0;scoreRef.current=0;comboRef.current=0;bgOffsetRef.current=0;
    setGameState('playing');
    setTimeout(()=>inputRef.current?.focus(),100);

    const pickMonster=():{monsterIdx:number;tier:0|1|2}=>{
      const lv=levelRef.current,r=Math.random();
      const bossChance=lv>=8?0.10:lv>=5?0.05:0;
      const eliteChance=lv>=6?0.35:lv>=3?0.20:0;
      const tier:0|1|2=r<bossChance?2:r<bossChance+eliteChance?1:0;
      // unlock monsters progressively: start with wolf, +1 every 2 levels
      const unlocked=Math.min(6,1+Math.floor(lv/2));
      const monsterIdx=Math.floor(Math.random()*unlocked);
      return{monsterIdx,tier};
    };

    const spawn=()=>{
      if(livesRef.current<=0)return;
      const pool=wordsRef.current;if(!pool.length)return;
      const word=pool[Math.floor(Math.random()*pool.length)];
      const{monsterIdx,tier}=pickMonster();
      const tc=TIER_CONFIG[tier];
      const newM:Monster={id:++idCounter.current,word,x:Math.random()*74+8,y:-10,speed:(0.024+levelRef.current*0.007)*tc.speedMult,hp:tc.hpMult,maxHp:tc.hpMult,monsterIdx,tier,frame:0,frameTimer:0};
      monstersRef.current=[...monstersRef.current,newM];
      speechService.speak(word.English);
    };

    spawnTimer.current=setInterval(spawn,2800);spawn();

    const levelCheck=setInterval(()=>{
      const newLv=Math.floor(killedRef.current/10)+1;
      if(newLv!==levelRef.current){levelRef.current=newLv;setLevel(newLv);setLevelUpFlash(true);setTimeout(()=>setLevelUpFlash(false),1200);clearInterval(spawnTimer.current);spawnTimer.current=setInterval(spawn,Math.max(900,2800-(newLv-1)*230));}
    },1000);

    let lastTime=performance.now();
    const gameLoop=(now:number)=>{
      if(livesRef.current<=0)return;
      const delta=now-lastTime;lastTime=now;
      monstersRef.current=monstersRef.current.map(m=>{
        const fps=MONSTERS_DATA[m.monsterIdx].fps*(m.tier===2?0.7:m.tier===1?0.85:1);
        let ft=m.frameTimer+delta,fr=m.frame;
        if(ft>=fps){fr=(fr+1)%8;ft=0;}
        return{...m,frame:fr,frameTimer:ft};
      });
      monstersRef.current=monstersRef.current.map(m=>({...m,y:m.y+m.speed+levelRef.current*0.003}));
      bgOffsetRef.current+=0.6+levelRef.current*0.1;
      const reached=monstersRef.current.filter(m=>m.y>=88);
      const remaining=monstersRef.current.filter(m=>m.y<88);
      if(reached.length>0){
        reached.forEach(m=>spawnDamageParticles(m.x,82));
        livesRef.current=Math.max(0,livesRef.current-reached.length);setLives(livesRef.current);
        monstersRef.current=remaining;setShakeField(true);setTimeout(()=>setShakeField(false),500);
        if(livesRef.current<=0){clearInterval(levelCheck);cleanup();renderCanvas();setTimeout(()=>{db.saveGameScore({gameType:'monster',score:scoreRef.current,level:levelRef.current,wordsTyped:killedRef.current,accuracy:killedRef.current>0?100:0,duration:0});setGameState('result');},600);return;}
      }
      renderCanvas();
      frameRef.current=requestAnimationFrame(gameLoop);
    };
    frameRef.current=requestAnimationFrame(gameLoop);
  };

  const checkAnswer=()=>{
    if(!input.trim()||!monstersRef.current.length)return;
    const ans=input.trim().toLowerCase();
    const matchIdx=monstersRef.current.findIndex(m=>{const target=inputLang==='en'?m.word.English.toLowerCase():m.word.Vietnamese.toLowerCase();return ans===target;});
    if(matchIdx!==-1){
      const hit=monstersRef.current[matchIdx];
      const newHp=hit.hp-1;
      if(newHp>0){monstersRef.current=monstersRef.current.map((m,i)=>i===matchIdx?{...m,hp:newHp}:m);}
      else{
        const newCombo=comboRef.current+1;comboRef.current=newCombo;setCombo(newCombo);
        const tierBonus=hit.tier===2?35:hit.tier===1?18:0;
        const pts=10+tierBonus+(newCombo>=5?15:newCombo>=3?5:0)+levelRef.current*2;
        scoreRef.current+=pts;setScore(scoreRef.current);killedRef.current+=1;setKilled(killedRef.current);
        spawnParticles(hit.x,hit.y,pts,newCombo,hit.monsterIdx,hit.tier);
        monstersRef.current=monstersRef.current.filter((_,i)=>i!==matchIdx);
      }
    }else{comboRef.current=0;setCombo(0);}
    setInput('');inputRef.current?.focus();
  };

  const toggleGroup=(id:number)=>setSelectedGroups(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  useEffect(()=>{
    if(gameState!=='playing')return;
    const resize=()=>{const canvas=canvasRef.current;if(!canvas)return;const rect=canvas.parentElement!.getBoundingClientRect();canvas.width=rect.width;canvas.height=rect.height;canvasSizeRef.current={w:rect.width,h:rect.height};};
    resize();window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);
  },[gameState]);

  // ─── SELECT ──────────────────────────────────────────────────────────────────
  if(gameState==='select') return (
    <div style={{paddingBottom:32}}>
      <div className="page-header"><div><h1 className="page-title">Đánh Quái ⚔️</h1><p className="page-subtitle">6 quái thú tiến hóa 3 cấp — gõ đúng từ để tiêu diệt!</p></div></div>
      <div style={{padding:'24px 32px'}}>
        <div className="card" style={{maxWidth:520}}>
          <h3 style={{marginBottom:20}}>⚙️ Cài Đặt</h3>
          <div className="form-group" style={{marginBottom:16}}>
            <label className="form-label">Ngôn ngữ gõ</label>
            <div style={{display:'flex',gap:8}}>
              {(['en','vi'] as InputLang[]).map(lang=>(<button key={lang} onClick={()=>setInputLang(lang)} style={{flex:1,padding:10,borderRadius:8,fontFamily:'inherit',fontSize:14,cursor:'pointer',border:`1px solid ${inputLang===lang?'var(--accent)':'var(--border)'}`,background:inputLang===lang?'rgba(99,102,241,0.12)':'var(--bg-secondary)',color:inputLang===lang?'var(--accent-bright)':'var(--text-secondary)'}}>{lang==='en'?'🇺🇸 Gõ Tiếng Anh':'🇻🇳 Gõ Tiếng Việt'}</button>))}
            </div>
          </div>
          <div className="form-group" style={{marginBottom:20}}>
            <label className="form-label">Nhóm từ (bỏ trống = tất cả)</label>
            <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:180,overflowY:'auto'}}>
              {groups.map(g=>(<button key={g.Id} onClick={()=>toggleGroup(g.Id)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',cursor:'pointer',borderRadius:8,fontFamily:'inherit',fontSize:13,textAlign:'left',border:`1px solid ${selectedGroups.includes(g.Id)?g.Color:'var(--border)'}`,background:selectedGroups.includes(g.Id)?`${g.Color}18`:'var(--bg-secondary)',color:'var(--text-primary)'}}><span>{g.Icon}</span><span>{g.Name}</span><span style={{fontSize:11,color:'var(--text-muted)',marginLeft:'auto'}}>{g.WordCount} từ</span>{selectedGroups.includes(g.Id)&&<span style={{color:'var(--green)'}}>✓</span>}</button>))}
            </div>
          </div>
          <div style={{background:'var(--bg-secondary)',borderRadius:8,padding:14,marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:600,marginBottom:10}}>👾 Quái Thú (mở khóa dần theo cấp)</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              {MONSTERS_DATA.map((m,i)=>(
                <div key={i} style={{padding:'8px',borderRadius:8,background:'rgba(99,102,241,0.06)',border:'1px solid rgba(99,102,241,0.15)',textAlign:'center'}}>
                  <div style={{fontSize:20,marginBottom:4}}>{m.emoji}</div>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--text-primary)'}}>{m.tiers[0].name}</div>
                  <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>→ {m.tiers[2].name}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{background:'var(--bg-secondary)',borderRadius:8,padding:14,marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>⚡ Hệ Tiến Hóa</div>
            <div style={{display:'flex',gap:8}}>
              {[['Thường','#6b7280','1 lần','Nhỏ'],['Elite','#22d3ee','2 lần','To hơn · +18đ'],['Boss','#f59e0b','3 lần','Khổng lồ · +35đ']].map(([t,c,h,d])=>(
                <div key={t} style={{flex:1,textAlign:'center',padding:'8px 4px',borderRadius:6,background:`${c}14`,border:`1px solid ${c}44`}}>
                  <div style={{fontSize:11,fontWeight:700,color:c}}>{t}</div>
                  <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>{h} · {d}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{background:'var(--bg-secondary)',borderRadius:8,padding:14,marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:600,marginBottom:6}}>📜 Luật chơi</div>
            {['Quái thú rơi xuống — gõ đúng từ vựng + Enter','Combo 3+: bonus điểm, combo 5+: bonus lớn','Quái chạm đáy → mất 1 mạng (3 mạng)','Mỗi 10 quái diệt: level up, xuất hiện quái mới','Elite & Boss từ level 3+ — to hơn, máu hơn'].map(r=>(<div key={r} style={{fontSize:11,color:'var(--text-secondary)',padding:'2px 0'}}>• {r}</div>))}
          </div>
          <button className="btn btn-primary btn-lg w-full" onClick={startGame}>⚔️ Bắt Đầu Chiến!</button>
        </div>
      </div>
    </div>
  );

  // ─── RESULT ──────────────────────────────────────────────────────────────────
  if(gameState==='result') return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'80vh',padding:32}}>
      <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:20,padding:40,maxWidth:420,width:'100%',textAlign:'center'}}>
        <div style={{fontSize:64,marginBottom:8}}>💀</div>
        <h2 style={{fontSize:24,fontWeight:700,marginBottom:8}}>Game Over!</h2>
        <p style={{color:'var(--text-secondary)',fontSize:14,marginBottom:28}}>{killed>=30?'🔥 Huyền Thoại!':killed>=15?'⚔️ Chiến Binh Dũng Cảm!':'💪 Cố Lên Lần Sau!'}</p>
        <div style={{display:'flex',justifyContent:'center',gap:28,marginBottom:28}}>
          {([['Điểm',score,'#6366f1'],['Quái Diệt',killed,'#10b981'],['Cấp Độ',level,'#f59e0b']] as const).map(([l,v,c])=>(<div key={l} style={{display:'flex',flexDirection:'column',gap:4,alignItems:'center'}}><div style={{fontSize:36,fontWeight:700,color:c,fontFamily:'JetBrains Mono,monospace'}}>{v}</div><div style={{fontSize:12,color:'var(--text-secondary)'}}>{l}</div></div>))}
        </div>
        <div style={{display:'flex',gap:12,justifyContent:'center'}}>
          <button className="btn btn-secondary" onClick={()=>setGameState('select')}>← Menu</button>
          <button className="btn btn-primary" onClick={startGame}>🔄 Chơi lại</button>
        </div>
      </div>
    </div>
  );

  // ─── PLAYING ─────────────────────────────────────────────────────────────────
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 20px',background:'var(--bg-secondary)',borderBottom:'1px solid var(--border)',position:'relative',zIndex:10,minHeight:52}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:1}}>
          <span style={{fontSize:20,fontWeight:700,color:'var(--accent-bright)',fontFamily:'JetBrains Mono,monospace'}}>{score.toLocaleString()}</span>
          <span style={{fontSize:10,color:'var(--text-muted)',letterSpacing:'0.05em'}}>ĐIỂM</span>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
          <div style={{display:'flex',gap:4}}>{Array.from({length:3},(_,i)=>(<span key={i} style={{fontSize:18,opacity:i<lives?1:0.15,transition:'opacity 0.3s'}}>❤️</span>))}</div>
          <span style={{fontSize:10,color:'var(--text-muted)',letterSpacing:'0.05em'}}>{killed} QUÁI</span>
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:1}}>
          <span style={{fontSize:20,fontWeight:700,color:'#f59e0b',fontFamily:'JetBrains Mono,monospace',animation:levelUpFlash?'levelUp 0.4s ease 3':'none'}}>Lv.{level}</span>
          <span style={{fontSize:10,color:'var(--text-muted)',letterSpacing:'0.05em'}}>LEVEL</span>
        </div>
        {combo>=2&&<div style={{position:'absolute',left:'50%',transform:'translateX(-50%)',background:'rgba(245,158,11,0.18)',border:'1px solid rgba(245,158,11,0.45)',color:'#f59e0b',padding:'3px 14px',borderRadius:20,fontSize:13,fontWeight:700,animation:'pulse 0.5s ease infinite',whiteSpace:'nowrap'}}>🔥 ×{combo}</div>}
        {levelUpFlash&&<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(245,158,11,0.08)',pointerEvents:'none',fontSize:22,fontWeight:700,color:'#f59e0b',letterSpacing:2}}>⬆ LEVEL UP!</div>}
      </div>
      <div style={{flex:1,position:'relative',overflow:'hidden',animation:shakeField?'shake 0.4s ease':'none'}}>
        <canvas ref={canvasRef} style={{display:'block',width:'100%',height:'100%'}}/>
      </div>
      <div style={{display:'flex',gap:10,padding:'12px 20px',background:'var(--bg-secondary)',borderTop:'1px solid var(--border)'}}>
        <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&checkAnswer()} placeholder={inputLang==='en'?'⌨️ Gõ tiếng Anh rồi Enter...':'⌨️ Gõ nghĩa tiếng Việt rồi Enter...'} autoFocus spellCheck={false} autoComplete="off"
          style={{flex:1,padding:'12px 16px',background:'var(--bg-primary)',border:'2px solid var(--border)',borderRadius:8,color:'var(--text-primary)',fontFamily:'JetBrains Mono,monospace',fontSize:18,outline:'none',transition:'border-color 0.2s'}}
          onFocus={e=>e.currentTarget.style.borderColor='var(--accent)'}
          onBlur={e=>e.currentTarget.style.borderColor='var(--border)'}/>
        <button className="btn btn-primary" onClick={checkAnswer}>⚔️</button>
        <button className="btn btn-secondary" onClick={()=>{cleanup();setGameState('select');}}>✕</button>
      </div>
    </div>
  );
}
