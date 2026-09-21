/* ══════════════════════════════════════════════════════════════
   自绘下拉框

   原生 <select> 展开后那个弹层是操作系统画的（macOS 上带一条蓝色高亮），
   CSS 够不着，跟这张骨白纸完全不是一回事。所以在外面套一层自己的下拉：

     · 原来的 <select> 原封不动留在 DOM 里，只是不显示 —— 它继续是
       唯一的数据源和事件源，页面里所有 $('#xxx').value / .onchange
       一行都不用改；
     · 选中后写回 select.value 再派发一次 change，行为和原生一致；
     · 选项被 JS 重建过（比如区域经理那个）由 MutationObserver 兜住，
       自动重画面板。
   ══════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var OPEN=null;

function build(sel){
  if(sel.dataset.enhanced) return;
  sel.dataset.enhanced='1';

  var wrap=document.createElement('div');
  wrap.className='sel';
  sel.parentNode.insertBefore(wrap,sel);
  wrap.appendChild(sel);

  var btn=document.createElement('button');
  btn.type='button'; btn.className='sel-btn';
  var panel=document.createElement('div');
  panel.className='sel-panel hidden';
  wrap.appendChild(btn); wrap.appendChild(panel);

  function paint(){
    var o=sel.options[sel.selectedIndex];
    btn.textContent=o?o.text:'';
    panel.innerHTML='';
    [].forEach.call(sel.options,function(opt,i){
      var row=document.createElement('div');
      row.className='sel-opt'+(i===sel.selectedIndex?' on':'');
      row.innerHTML='<i class="tick"></i>'+opt.text.replace(/&/g,'&amp;').replace(/</g,'&lt;');
      row.onclick=function(e){
        e.stopPropagation();
        sel.selectedIndex=i;
        sel.dispatchEvent(new Event('change',{bubbles:true}));
        close(); paint();
      };
      panel.appendChild(row);
    });
  }
  /* 面板用 position:fixed 并按按钮的位置摆放 —— 它挂在工具栏里，
     任何一个祖先设了 overflow 都会把它裁掉，fixed 谁也裁不到。
     下方放不下就往上翻。 */
  function place(){
    var r=btn.getBoundingClientRect();
    panel.style.left=r.left+'px';
    panel.style.width=r.width+'px';
    panel.style.top=''; panel.style.bottom='';
    var h=panel.offsetHeight;
    if(r.bottom+h>window.innerHeight-12 && r.top-h>12){
      panel.style.top=(r.top-h+1)+'px';        /* 下面放不下，往上翻 */
    }else{
      panel.style.top=(r.bottom-1)+'px';
    }
  }
  function open(){
    if(OPEN&&OPEN!==close) OPEN();
    wrap.classList.add('open'); panel.classList.remove('hidden'); OPEN=close;
    place();
  }
  function close(){
    wrap.classList.remove('open'); panel.classList.add('hidden');
    if(OPEN===close) OPEN=null;
  }
  btn.onclick=function(e){
    e.stopPropagation();
    panel.classList.contains('hidden') ? open() : close();
  };
  sel.addEventListener('change',paint);
  window.addEventListener('resize',function(){ if(OPEN===close) place() });
  window.addEventListener('scroll',function(){ if(OPEN===close) close() },true);
  /* 选项被别处重建（区域经理列表）或值被程序改过，都要跟着重画 */
  new MutationObserver(paint).observe(sel,{childList:true,subtree:true,attributes:true});
  paint();
}

function enhanceAll(){ document.querySelectorAll('select').forEach(build) }

document.addEventListener('click',function(){ if(OPEN) OPEN() });
document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&OPEN) OPEN() });

window.enhanceSelects=enhanceAll;
enhanceAll();
})();
