/* Simple DFA tool script
   - Parses inputs: states, alphabet, transitions (from,symbol,to per line), start, final
   - Generates draggable state circles and an SVG overlay for transitions
   - Efficient dragging: only updates transition paths while moving (requestAnimationFrame)
   - Curved edges for bidirectional, clean self-loops, centered labels
*/

(() => {
  'use strict';

  // Helpers
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const parseList = str => (str||'').split(',').map(s=>s.trim()).filter(Boolean);

  // Geometry helpers
  const dist = (ax,ay,bx,by) => Math.hypot(bx-ax, by-ay);
  const angle = (ax,ay,bx,by) => Math.atan2(by-ay,bx-ax);
  // compute point on circle boundary given center, radius and target angle
  const circlePoint = (cx,cy,r,theta) => ({x: cx + Math.cos(theta)*r, y: cy + Math.sin(theta)*r});

  // DOM refs
  const statesInput = $('states-input');
  const alphaInput = $('alpha-input');
  const transInput = $('trans-input');
  const startInput = $('start-input');
  const finalInput = $('final-input');
  const btnGenerate = $('btn-generate');
  const btnClear = $('btn-clear');
  const btnArrange = $('btn-arrange');
  const diagram = $('diagram');
  const errorBox = $('error');
  const transTableBody = $('trans-table').querySelector('tbody');

  // State
  let model = {states: [], transitions: [], start: null, finals: new Set()};
  let nodeElems = new Map();
  const NODE_R = 32; // radius

  // SVG overlay
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS,'svg');
  svg.classList.add('svg-overlay');
  diagram.appendChild(svg);
  // defs and marker
  const defs = document.createElementNS(svgNS,'defs'); svg.appendChild(defs);
  const marker = document.createElementNS(svgNS,'marker');
  marker.setAttribute('id','arrow'); marker.setAttribute('markerWidth','8'); marker.setAttribute('markerHeight','8');
  marker.setAttribute('refX','6'); marker.setAttribute('refY','4'); marker.setAttribute('orient','auto');
  marker.setAttribute('markerUnits','strokeWidth');
  const mpath = document.createElementNS(svgNS,'path'); mpath.setAttribute('d','M0,0 L8,4 L0,8 z'); mpath.setAttribute('fill','#334155');
  marker.appendChild(mpath); defs.appendChild(marker);

  // Keep path elements keyed by transition index
  let pathElems = [];

  // Validation
  function showError(msg){ errorBox.textContent = msg; errorBox.classList.remove('hidden'); }
  function clearError(){ errorBox.textContent=''; errorBox.classList.add('hidden'); }

  // Parse transitions textarea: each line -> from,symbol,to
  function parseTransitions(text){
    const lines = (text||'').split('\n').map(l=>l.trim()).filter(Boolean);
    const out = [];
    for (const line of lines){
      const parts = line.split(',').map(p=>p.trim());
      if (parts.length < 3) throw new Error(`Bad transition line: ${line}`);
      out.push({from:parts[0], symbol:parts[1], to:parts[2]});
    }
    return out;
  }

  // Build model from inputs
  function buildModel(){
    clearError();
    const states = parseList(statesInput.value);
    const alpha = parseList(alphaInput.value);
    let transitions;
    try{ transitions = parseTransitions(transInput.value); } catch(e){ showError(e.message); return null; }
    const start = (startInput.value||'').trim();
    const finals = new Set(parseList(finalInput.value));

    if (!states.length){ showError('Please enter at least one state.'); return null; }
    if (start && !states.includes(start)){ showError('Start state not in states list.'); return null; }

    // validate transitions refer to known states and alphabet (not strict)
    for (const t of transitions){
      if (!states.includes(t.from) || !states.includes(t.to)){
        showError(`Transition refers to unknown state: ${t.from} -> ${t.to}`); return null;
      }
      // don't crash on unknown symbols; just warn later
    }

    model = {states: states.map((id,i)=>({id, x:50 + i*100, y:80, idx:i})), transitions, start: start || null, finals};
    return model;
  }

  // Create DOM nodes for states (or reuse)
  function renderStates(){
    // remove nodes not in model
    const keep = new Set(model.states.map(s=>s.id));
    for (const [id,el] of nodeElems) if (!keep.has(id)){ el.remove(); nodeElems.delete(id); }

    model.states.forEach(s => {
      if (!nodeElems.has(s.id)){
        const el = document.createElement('div'); el.className = 'state'; el.dataset.id = s.id;
        const name = document.createElement('div'); name.className = 'name'; name.textContent = s.id; el.appendChild(name);
        if (model.finals.has(s.id)) el.classList.add('final');
        // pointer dragging
        let dragging = null;
        el.addEventListener('pointerdown', e => {
          el.setPointerCapture(e.pointerId);
          dragging = {startX:e.clientX, startY:e.clientY, origX: s.x, origY: s.y};
        });
        document.addEventListener('pointermove', e => {
          if (!dragging) return;
          const dx = e.clientX - dragging.startX; const dy = e.clientY - dragging.startY;
          s.x = clamp(dragging.origX + dx, 4, diagram.clientWidth - NODE_R*2 - 4);
          s.y = clamp(dragging.origY + dy, 4, diagram.clientHeight - NODE_R*2 - 4);
          // move element directly
          el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
          // schedule redraw of transitions only
          scheduleRedraw();
        });
        document.addEventListener('pointerup', e => { if (dragging) { el.releasePointerCapture(e.pointerId); dragging = null; } });

        diagram.appendChild(el); nodeElems.set(s.id, el);
      }
      const el = nodeElems.get(s.id);
      el.style.left = (s.x) + 'px'; el.style.top = (s.y) + 'px';
      // mark start
      el.querySelector('.name').textContent = s.id + (model.start === s.id ? ' ▶' : '');
      if (model.finals.has(s.id)) el.classList.add('final'); else el.classList.remove('final');
    });
  }

  // Draw transitions (efficient: only paths and labels updated)
  function clearPaths(){ pathElems.forEach(p=>p.g.remove()); pathElems = []; }

  function drawAllTransitions(){
    clearPaths();
    svg.setAttribute('width', diagram.clientWidth); svg.setAttribute('height', diagram.clientHeight);
    // for quick lookup of bidirectional pairs
    const pairCount = {};
    model.transitions.forEach((t,i)=>{
      const key = t.from < t.to ? t.from+'|'+t.to : t.to+'|'+t.from;
      pairCount[key] = (pairCount[key]||0) + 1;
    });

    model.transitions.forEach((t,i)=>{
      const from = model.states.find(s=>s.id===t.from);
      const to = model.states.find(s=>s.id===t.to);
      if (!from || !to) return;
      const g = document.createElementNS(svgNS,'g');
      const path = document.createElementNS(svgNS,'path'); path.classList.add('arrow');
      path.setAttribute('marker-end','url(#arrow)');
      const text = document.createElementNS(svgNS,'text'); text.classList.add('label-text'); text.setAttribute('text-anchor','middle');

      svg.appendChild(g); g.appendChild(path); g.appendChild(text);
      pathElems.push({g,path,text,t});
    });
    updatePaths();
  }

  // compute path for a transition element
  function computePath(from,to,offsetIndex=0,totalParallel=1){
    // centers
    const fx = from.x + NODE_R; const fy = from.y + NODE_R;
    const tx = to.x + NODE_R; const ty = to.y + NODE_R;
    if (from.id === to.id){
      // self-loop: draw circular loop to the top-right
      const cx = fx + NODE_R; const cy = fy - NODE_R;
      const r = NODE_R * 0.9 + offsetIndex*6;
      // use cubic bezier loop
      const start = {x: fx, y: fy - NODE_R};
      const d = `M ${start.x} ${start.y} C ${cx + r} ${cy - r} ${cx - r} ${cy - r} ${start.x} ${start.y}`;
      const labelPos = {x: start.x + 0, y: start.y - r - 6};
      return {d, labelPos};
    }
    const dx = tx - fx; const dy = ty - fy; const theta = Math.atan2(dy,dx);
    // offset for parallel edges
    const key = from.id < to.id ? from.id+'|'+to.id : to.id+'|'+from.id;
    const baseOffset = (offsetIndex - (totalParallel-1)/2) * 18;
    const midx = (fx+tx)/2; const midy = (fy+ty)/2;
    const ox = -Math.sin(theta) * baseOffset; const oy = Math.cos(theta) * baseOffset;
    const cx = midx + ox; const cy = midy + oy;

    // compute border intersection to start/end the arrow at the perimeter
    const distCenter = dist(fx,fy,tx,ty);
    const fromEdge = circlePoint(fx,fy,NODE_R,theta);
    const toEdge = circlePoint(tx,ty,NODE_R,theta + Math.PI);
    const d = `M ${fromEdge.x} ${fromEdge.y} Q ${cx} ${cy} ${toEdge.x} ${toEdge.y}`;
    // label at t = 0.5
    // approximate using quadratic bezier midpoint formula
    const t = 0.5;
    const x = (1-t)*(1-t)*fromEdge.x + 2*(1-t)*t*cx + t*t*toEdge.x;
    const y = (1-t)*(1-t)*fromEdge.y + 2*(1-t)*t*cy + t*t*toEdge.y;
    return {d, labelPos:{x,y}};
  }

  function updatePaths(){
    // group parallel transitions to compute offsets
    const pairs = {};
    model.transitions.forEach((t,i)=>{
      const key = t.from < t.to ? t.from+'|'+t.to : t.to+'|'+t.from;
      pairs[key] = pairs[key] || []; pairs[key].push(i);
    });

    pathElems.forEach((pe, idx) => {
      const {t,path,text} = pe;
      const from = model.states.find(s=>s.id===t.from);
      const to = model.states.find(s=>s.id===t.to);
      if (!from || !to) return;
      const key = t.from < t.to ? t.from+'|'+t.to : t.to+'|'+t.from;
      const list = pairs[key] || [];
      const posInList = list.indexOf(idx);
      const total = list.length || 1;
      const offsetIndex = posInList>=0 ? posInList : 0;
      const {d,labelPos} = computePath(from,to,offsetIndex,total);
      path.setAttribute('d', d);
      // label
      text.textContent = t.symbol;
      text.setAttribute('x', labelPos.x);
      text.setAttribute('y', labelPos.y);
    });
  }

  // Throttled redraw using rAF
  let raf = null;
  function scheduleRedraw(){ if (raf) return; raf = requestAnimationFrame(()=>{ raf=null; updatePaths(); }); }

  // Public actions
  function generate(){
    const m = buildModel(); if (!m) return;
    // reset layout: circular arrange by default
    arrangeCircular();
    renderStates();
    drawAllTransitions();
    renderTable();
  }

  function clearAll(){
    // clear model and DOM
    model = {states:[], transitions:[], start:null, finals:new Set()};
    for (const el of nodeElems.values()) el.remove(); nodeElems.clear();
    clearPaths(); transTableBody.innerHTML = '';
    clearError();
  }

  function arrangeCircular(){
    const n = model.states.length; if (!n) return;
    const cx = diagram.clientWidth/2 - NODE_R; const cy = diagram.clientHeight/2 - NODE_R;
    const r = Math.min(diagram.clientWidth, diagram.clientHeight)/2 - 80;
    model.states.forEach((s,i)=>{
      const theta = (i / n) * Math.PI * 2 - Math.PI/2;
      s.x = cx + Math.cos(theta) * r; s.y = cy + Math.sin(theta) * r;
      const el = nodeElems.get(s.id); if (el){ el.style.left = s.x+'px'; el.style.top = s.y+'px'; }
    });
    scheduleRedraw();
  }

  function renderTable(){ transTableBody.innerHTML = ''; model.transitions.forEach(t=>{
    const tr = document.createElement('tr'); tr.innerHTML = `<td>${t.from}</td><td>${t.symbol}</td><td>${t.to}</td>`; transTableBody.appendChild(tr);
  }); }

  // Bind buttons
  btnGenerate.addEventListener('click', generate);
  btnClear.addEventListener('click', clearAll);
  btnArrange.addEventListener('click', ()=>{ arrangeCircular(); renderStates(); });

  // initialize with a small sample in inputs
  statesInput.value = 'q0,q1'; alphaInput.value = 'a,b'; transInput.value = 'q0,a,q1\nq1,b,q1'; startInput.value = 'q0'; finalInput.value = 'q1';
  // auto-generate
  generate();

  // handle window resize: update svg size and redraw labels
  window.addEventListener('resize', ()=>{ svg.setAttribute('width', diagram.clientWidth); svg.setAttribute('height', diagram.clientHeight); scheduleRedraw(); });

})();
