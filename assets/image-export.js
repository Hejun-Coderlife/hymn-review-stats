/* ══════════════════════════════════════════════════════════════
   导出品牌图片 — 把当前这张表画成一张赫眉风格的图

   风格完全对齐 hymn-douyin-board/设计稿-看板.html：
     · 骨白纸 #FDFCFA，不是纯白（纯白大面积会发冷发廉价）
     · 没有卡片、没有圆角、没有阴影、没有填充色块
       分区只靠三样：留白、0.5px 发丝线、字号反差
     · 极端字号层级：标签 9px / 正文 12px / 主数字 120px
     · 品牌粉只出现三次（logo 下那条线、差评数字、差评格子），
       面积极小但位置关键 —— 奢侈品是靠位置用色，不是靠面积
     · 数字走 Didot，中文标题走宋体，小标签走 Optima / 苹方

   不用 html2canvas：表格结构简单，直接画 canvas 更可控、更锐利，
   也不用多背 200KB 的库。logo 走内联 data URI（assets/logo-data.js），
   所以本地双击打开也不会污染画布导致导不出图。
   ══════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var C={ paper:'#FDFCFA', ink:'#16140F', ink2:'#4A453C', dim:'#9C958A',
        hair:'#E3DFD6', hair2:'#F0EDE6', pink:'#A56B79', pinkDeep:'#A56B79' };
var F={ serif:'Didot,"Bodoni 72","Songti SC",Georgia,serif',
        song:'"Songti SC","STSong",Didot,serif',
        sans:'"Optima","PingFang SC",-apple-system,sans-serif' };

var PAD=30;        /* 页面左右留白：手机上看，留白让位给字号 */
var MINW=560;      /* 画面窄 = 手机上按宽度铺满时字更大，这是手机可读性的关键 */
var DPR=2;         /* 出 2 倍图，投屏和打印都不虚 */

/* ── 画笔小工具 ───────────────────────────────────────────── */
function set(ctx,o){
  ctx.font=(o.weight||400)+' '+o.size+'px '+(o.fam||F.sans);
  ctx.fillStyle=o.color||C.ink;
  ctx.textAlign=o.align||'left';
  ctx.textBaseline=o.baseline||'alphabetic';
  if('letterSpacing' in ctx) ctx.letterSpacing=o.ls||'0px';
}
function mw(ctx,s,o){ set(ctx,o); return ctx.measureText(String(s)).width }
function tx(ctx,s,x,y,o){ set(ctx,o); ctx.fillText(String(s),x,y) }
function hr(ctx,x1,x2,y,color,th){
  ctx.strokeStyle=color; ctx.lineWidth=th||0.5;
  ctx.beginPath(); ctx.moveTo(x1,y+0.25); ctx.lineTo(x2,y+0.25); ctx.stroke();
}
/* 按字符贪心折行（中文为主，不做西文断词） */
function wrap(ctx,s,maxw,o){
  s=String(s||''); if(!s) return [];
  set(ctx,o);
  if(ctx.measureText(s).width<=maxw) return [s];
  var out=[],cur='';
  for(var i=0;i<s.length;i++){
    var t=cur+s.charAt(i);
    if(cur && ctx.measureText(t).width>maxw){ out.push(cur); cur=s.charAt(i) }
    else cur=t;
  }
  if(cur) out.push(cur);
  return out;
}

/* ── 从页面上把当前这张表原样取下来 ───────────────────────── */
function grab(){
  var t=document.querySelector('#tableHost table');
  if(!t) return null;
  var head=[].map.call(t.querySelectorAll('thead th'),function(x){ return x.textContent.trim() });
  var rows=[].map.call(t.querySelectorAll('tbody tr'),function(tr){
    return [].map.call(tr.children,function(td){
      return { t:td.textContent.trim(), cls:td.className||'' };
    });
  });
  if(!head.length||!rows.length) return null;
  var kpis=[].map.call(document.querySelectorAll('#kpis .kpi'),function(k){
    var q=function(s){ var e=k.querySelector(s); return e?e.textContent.trim():'' };
    return { k:q('.k'), v:q('.v'), s:q('.s') };
  });
  /* 一排三个：日期区间 · 新增好评数量 · 差评总数。
     中间那个是这张图的主角 —— 字号翻倍、用品牌粉，靠位置和体量压场。
     只选了一个日期、没有区间时，中间退回好评总数，免得中间空着。 */
  var pick=function(n){ for(var k=0;k<kpis.length;k++) if(kpis[k].k===n) return kpis[k]; return null };
  var strip=[];
  var push=function(n,o){ var k=pick(n); if(k) strip.push(Object.assign({k:k.k,v:k.v,s:k.s},o||{})) };
  push('日期区间',{size:30});
  push('新增好评数量',{size:72,pink:true});
  if(!pick('新增好评数量')) push('好评总数',{size:72,pink:true});
  push('差评总数');

  var tab=document.querySelector('.tab.on');
  var lead=document.querySelector('#resultLead');
  return {
    head:head, rows:rows, kpis:strip,
    title:tab?tab.textContent.trim():'统计结果',
    lead:lead?lead.textContent.trim():'',
    cover:[]   /* 数据覆盖/口径那几行不上图，按要求去掉了 */
  };
}

/* ── 列模型：全是数字的列右对齐走 Didot，其余左对齐 ───────── */
var NUMRE=/^[+\-]?[\d,]+(\.\d+)?%?$/;
/* 手机上看：字号顶上去、留白和列间距压下来。
   关键不是绝对字号，是"字号 ÷ 画面宽度"—— 间距固定时字号越大这个比例越高，
   手机按宽度铺满后字就越大。 */
var HEAD={size:14,fam:F.sans,color:C.dim,ls:'.04em'};
var STACK_SIZE=15, STACK_LH=20;   /* 差评格叠两行：字号缩到能塞进单行行高里 */
function isMix(cell){ return !!cell && /\bmix\b/.test(cell.cls) }
function colFont(col,cell){
  if(isMix(cell)) return {size:STACK_SIZE,fam:F.sans,color:cellColor(cell)};
  if(cell && /\bmgr\b/.test(cell.cls)) return {size:17,fam:F.sans,color:C.ink2};
  if(col.num) return {size:28,fam:F.serif,color:cellColor(cell)};
  if(col.idx===0) return {size:28,fam:F.song,color:C.ink,ls:'.02em'};
  return {size:19,fam:F.sans,color:cellColor(cell)};
}
function cellColor(cell){
  if(!cell) return C.ink;
  if(/\bbad\b/.test(cell.cls) && cell.t!=='0') return C.pinkDeep;
  if(/\bzero\b/.test(cell.cls)) return C.dim;
  return C.ink;
}
function layout(ctx,d){
  var cols=d.head.map(function(h,i){
    var numeric=false,seen=false;
    for(var r=0;r<d.rows.length;r++){
      var c=d.rows[r][i]; if(!c) continue;
      var v=c.t; if(v===''||v==='—') continue;
      if(!seen){ seen=true; numeric=true }
      if(!NUMRE.test(v)){ numeric=false; break }
    }
    var forcedRight=d.rows.some(function(row){
      var c=row[i]; return c && /\br\b/.test(c.cls);
    });
    return { key:h, idx:i, num:numeric, right:numeric||forcedRight };
  });
  cols.forEach(function(col){
    var cap=col.num?220:(col.idx===0?320:460);
    var gap=col.num?22:18;
    var max=mw(ctx,col.key,HEAD);
    d.rows.forEach(function(row){
      var cell=row[col.idx]; if(!cell) return;
      /* 叠两行的格子按最宽那一行量，不按整串 */
      var parts=isMix(cell)?cell.t.split('/'):[cell.t];
      parts.forEach(function(t){
        var wpx=mw(ctx,t,colFont(col,cell));
        if(wpx>max) max=wpx;
      });
    });
    col.w=Math.min(max,cap)+gap;
    col.cap=cap;
  });
  /* 右对齐的那几列（美团好评 / 抖音好评 / 差评）统一成同一个宽度，
     不然列间距一列宽一列窄，看着就是没对齐 */
  var eq=0;
  cols.forEach(function(c){ if(c.right && c.w>eq) eq=c.w });
  if(eq) cols.forEach(function(c){ if(c.right) c.w=eq });
  /* 折行后每行有多高 */
  d.rowLines=d.rows.map(function(row){
    var n=1;
    cols.forEach(function(col){
      var cell=row[col.idx];
      if(col.num || !cell || isMix(cell)) return;   /* 叠两行的格子不撑高行高 */
      var ls=wrap(ctx,cell.t,col.cap,colFont(col,cell));
      if(ls.length>n) n=ls.length;
    });
    return n;
  });
  d.cols=cols;
  d.tableW=cols.reduce(function(a,c){ return a+c.w },0);
  var W=Math.max(MINW,Math.ceil(d.tableW)+PAD*2);
  /* 不再把富余宽度均摊撑满版心 —— 列少的时候那样会把列拉得老远、
     每格里一个孤零零的数字。宁可让表窄一点、居中放。 */
  return W;
}

/* ── 排版 + 绘制。dry=true 时只量高度，不真画 ─────────────── */
function compose(ctx,d,W,logo,dry){
  var L=PAD, R=W-PAD, mid=W/2, y=0;
  var on=function(){ return !dry };
  var dateTxt=(window.HYMN_IMG_DATE||new Date().toISOString().slice(0,10)).replace(/-/g,' / ');

  if(on()){ ctx.fillStyle=C.paper; ctx.fillRect(0,0,W,1e5) }

  /* 页眉：居中 logo + 一行极小英文 + 一段 34px 的品牌粉 */
  y+=66;
  var lw=132, lh=logo?lw*logo.naturalHeight/logo.naturalWidth:32;
  if(on()&&logo) ctx.drawImage(logo,mid-lw/2,y,lw,lh);
  y+=lh+28;
  if(on()) tx(ctx,'REVIEW STATISTICS',mid,y,{size:12,color:C.dim,ls:'.38em',align:'center'});
  y+=18;
  if(on()){ ctx.fillStyle=C.pink; ctx.fillRect(mid-17,y,34,1) }
  y+=1;

  /* 标题块（日期 + 页名 + 共 N 家门店）按要求去掉了，logo 下面直接进数字 */
  y+=52;
  if(on()) hr(ctx,L,R,y,C.hair);

  /* 其余几个数：没有卡片，只有发丝线分栏 */
  var rest=d.kpis;
  if(rest.length){
    var per=Math.min(3,rest.length);       /* 窄版心里一排最多三个，再多就挤成蚂蚁 */
    var cw=(R-L)/per, cellH=150;
    y+=58;
    rest.forEach(function(k,i){
      var r=Math.floor(i/per), c=i%per;
      var base=y+r*cellH, x=L+cw*c, inner=x+(c?34:0);
      if(on()&&c) hr2(ctx,x,base-16,base+104,C.hair);
      /* 标签、数字、副标都可能比栏宽长，一律按格子宽度自动缩一档，
         否则会压过分栏的那条发丝线、串到隔壁去 */
      var room=x+cw-inner-10, cx=inner+room/2;
      var fit=function(t,o){
        o.align='center';                /* 数字和下面那行小字居中对齐 */
        var w=mw(ctx,t,o);
        if(w>room) o.size=Math.floor(o.size*room/w);
        return o;
      };
      tx0(ctx,dry,k.k,cx,base,fit(k.k,{size:13,color:C.dim,ls:'.22em'}));
      tx0(ctx,dry,k.v,cx,base+74,fit(k.v,{size:k.size||46,fam:F.serif,
        color:k.pink||/差评/.test(k.k)?C.pinkDeep:C.ink}));
      tx0(ctx,dry,k.s,cx,base+100,fit(k.s,{size:15,color:C.ink2,ls:'.02em'}));
    });
    y+=(Math.ceil(rest.length/per)-1)*cellH+100+40;
    if(on()) hr(ctx,L,R,y,C.hair);
  }

  /* 表格：一样没有底色，靠发丝线和字号把行分开 */
  y+=62;
  var x0=Math.round((W-d.tableW)/2), cx=x0;
  d.cols.forEach(function(col){ col.x=cx; cx+=col.w });
  var HEADH=52;
  d.cols.forEach(function(col){
    var o=Object.assign({},HEAD);
    if(col.right){ o.align='right'; tx0(ctx,dry,col.key,col.x+col.w-2,y+HEADH-16,o) }
    else tx0(ctx,dry,col.key,col.x,y+HEADH-16,o);
  });
  y+=HEADH;
  if(on()) hr(ctx,x0,x0+d.tableW,y,C.hair);
  d.rows.forEach(function(row,ri){
    var lines=d.rowLines[ri], h=38+lines*26;
    var by=y+h/2+9;
    d.cols.forEach(function(col){
      var cell=row[col.idx]; if(!cell) return;
      var o=colFont(col,cell);
      if(isMix(cell)){
        /* 美团X个 / 抖音X个 拆成两行，在这一行的高度里居中 —— 行高不变 */
        o.align='right';
        var ps=cell.t.split('/'), ly=y+h/2-((ps.length-1)*STACK_LH)/2+5;
        ps.forEach(function(t){ tx0(ctx,dry,t,col.x+col.w-2,ly,o); ly+=STACK_LH });
      }
      else if(col.right){ o.align='right'; tx0(ctx,dry,cell.t,col.x+col.w-2,by,o) }
      else {
        var ls=wrap(ctx,cell.t,col.cap,o), ly=y+h/2-((ls.length-1)*26)/2+9;
        ls.forEach(function(s){ tx0(ctx,dry,s,col.x,ly,o); ly+=26 });
      }
    });
    y+=h;
    if(on()) hr(ctx,x0,x0+d.tableW,y,ri===d.rows.length-1?C.hair:C.hair2);
  });

  /* 页脚 */
  y+=56;
  if(on()) hr(ctx,L,R,y,C.hair);
  y+=54;
  if(on()&&logo){
    /* 不降透明度：降了就是另一个粉，页眉页脚会看出两种颜色 */
    var fw=76, fh=fw*logo.naturalHeight/logo.naturalWidth;
    ctx.drawImage(logo,mid-fw/2,y,fw,fh);
    y+=fh;
  }
  y+=22;
  if(on()) tx(ctx,'赫眉 HYMN · '+dateTxt,mid,y,{size:12,color:C.dim,ls:'.3em',align:'center'});
  y+=54;
  return Math.ceil(y);
}
function tx0(ctx,dry,s,x,y,o){ if(!dry) tx(ctx,s,x,y,o) }
function hr2(ctx,x,y1,y2,color){
  ctx.strokeStyle=color; ctx.lineWidth=.5;
  ctx.beginPath(); ctx.moveTo(x+0.25,y1); ctx.lineTo(x+0.25,y2); ctx.stroke();
}

/* ── 入口 ─────────────────────────────────────────────────── */
function loadLogo(){
  return new Promise(function(res){
    if(!window.HYMN_LOGO) return res(null);
    var img=new Image();
    img.onload=function(){ res(tint(img)) };
    img.onerror=function(){ res(null) };
    img.src=window.HYMN_LOGO;
  });
}
/* 把 logo 染成品牌粉：拿 PNG 的透明通道当遮罩填色，
   页面上的 logo 走 CSS mask 做的是同一件事，两边颜色因此始终一致 */
function tint(img){
  var c=document.createElement('canvas');
  c.width=img.naturalWidth; c.height=img.naturalHeight;
  var x=c.getContext('2d');
  x.drawImage(img,0,0);
  x.globalCompositeOperation='source-in';
  x.fillStyle=C.pink; x.fillRect(0,0,c.width,c.height);
  c.naturalWidth=c.width; c.naturalHeight=c.height;   /* compose() 按 natural* 算宽高比 */
  return c;
}
var LOGO=null, LAST=null;   /* 预览和下载共用同一张画布，别画两遍 */

async function build(){
  var d=grab(); if(!d) return null;
  if(document.fonts&&document.fonts.ready) try{ await document.fonts.ready }catch(e){}
  if(!LOGO) LOGO=await loadLogo();
  window.HYMN_IMG_DATE=today();

  var probe=document.createElement('canvas').getContext('2d');
  var W=layout(probe,d);
  var H=compose(probe,d,W,LOGO,true);

  var cv=document.createElement('canvas');
  cv.width=W*DPR; cv.height=H*DPR;
  var ctx=cv.getContext('2d');
  ctx.scale(DPR,DPR);
  ctx.fillStyle=C.paper; ctx.fillRect(0,0,W,H);
  compose(ctx,d,W,LOGO,false);

  var mgr=document.querySelector('#mgrFilter');
  var mgrTxt=(mgr&&mgr.selectedIndex>0)?('_'+mgr.options[mgr.selectedIndex].text):'';
  LAST={cv:cv, name:'赫眉-'+d.title+mgrTxt+'-'+today()+'.png'};
  return LAST;
}

/* 页面上「统计结果」里显示的就是这张图本身 —— 所见即所得，
   下载下来的和屏幕上看到的是同一张画布，不存在两套样式各画各的。 */
window.renderPreview=async function(){
  var host=document.querySelector('#preview'); if(!host) return;
  var r=await build();
  if(!r){ host.innerHTML=''; return }
  var img=new Image();
  img.alt='导出图预览';
  img.src=r.cv.toDataURL('image/png');
  host.innerHTML=''; host.appendChild(img);
};

window.exportImage=async function(){
  var r=LAST||await build();
  if(!r){ toast('先统计出结果再下载图片'); return }
  r.cv.toBlob(function(blob){
    saveBlob(blob,r.name);
    toast('已下载图片','success');
  },'image/png');
};
})();
