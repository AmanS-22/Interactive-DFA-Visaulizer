(() => {

const $ = id => document.getElementById(id);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const statesInput = $("states-input");
const alphaInput = $("alpha-input");
const transInput = $("trans-input");
const startInput = $("start-input");
const finalInput = $("final-input");

const btnGenerate = $("btn-generate");
const btnArrange = $("btn-arrange");
const btnClear = $("btn-clear");

const diagram = $("diagram");
const errorBox = $("error");

const thead = $("dfa-table").querySelector("thead");
const tbody = $("dfa-table").querySelector("tbody");

const NODE_R = 30;
const svgNS = "http://www.w3.org/2000/svg";

let model = null;
let nodeElems = new Map();
let pathElems = [];

const svg = document.createElementNS(svgNS, "svg");
svg.classList.add("svg-overlay");
diagram.appendChild(svg);

const defs = document.createElementNS(svgNS, "defs");
const marker = document.createElementNS(svgNS, "marker");
marker.setAttribute("id", "arrow");
marker.setAttribute("markerWidth", "10");
marker.setAttribute("markerHeight", "10");
marker.setAttribute("refX", "8");
marker.setAttribute("refY", "5");
marker.setAttribute("orient", "auto");
const head = document.createElementNS(svgNS, "path");
head.setAttribute("d", "M0,0 L10,5 L0,10 z");
head.setAttribute("fill", "#ccc");
marker.appendChild(head);
defs.appendChild(marker);
svg.appendChild(defs);

function parseList(s) {
  return (s || "").split(",").map(x => x.trim()).filter(Boolean);
}

function parseTransitions(text) {
  return text.split("\n").map(l => l.trim()).filter(Boolean)
    .map(line => {
      const [a,b,c] = line.split(",").map(x=>x.trim());
      return { from: a, symbol: b, to: c };
    });
}

function showError(msg){
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}

function clearError(){ errorBox.classList.add("hidden"); }

function buildModel(){
  clearError();

  const states = parseList(statesInput.value);
  const alpha = parseList(alphaInput.value);
  const start = startInput.value.trim();
  const finals = new Set(parseList(finalInput.value));

  if(!states.includes(start)){
    showError("Start state missing from states.");
    return null;
  }

  let transitions;
  try { transitions = parseTransitions(transInput.value); }
  catch(e){ showError(e.message); return null; }

  for(const t of transitions){
    if(!states.includes(t.from) || !states.includes(t.to)){
      showError("Invalid transition state.");
      return null;
    }
  }

  const stateObjs = states.map((id,i)=>({
    id,
    cx: 120+120*i,
    cy: 140
  }));

  return { states: stateObjs, alpha, transitions, start, finals };
}

function position(s, el){
  el.style.left = s.cx - NODE_R + "px";
  el.style.top  = s.cy - NODE_R + "px";
}

/* ====== RENDER STATES ====== */
function renderStates(){
  nodeElems.forEach(el=>el.remove());
  nodeElems.clear();

  model.states.forEach(s => {
    const el = document.createElement("div");
    el.className = "state";
    el.textContent = s.id;

    if(model.start === s.id) el.classList.add("start");
    if(model.finals.has(s.id)) el.classList.add("final");

    let drag = null;

    el.addEventListener("pointerdown", e=>{
      el.setPointerCapture(e.pointerId);
      drag = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: s.cx,
        origY: s.cy
      };
    });

    document.addEventListener("pointermove", e=>{
      if(!drag || drag.id!==e.pointerId) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      const rect = diagram.getBoundingClientRect();
      s.cx = clamp(drag.origX+dx, NODE_R, rect.width-NODE_R);
      s.cy = clamp(drag.origY+dy, NODE_R, rect.height-NODE_R);

      position(s, el);
      updatePaths();
    });

    document.addEventListener("pointerup", e=>{
      if(!drag || drag.id!==e.pointerId) return;
      el.releasePointerCapture(e.pointerId);
      drag = null;
    });

    diagram.appendChild(el);
    nodeElems.set(s.id, el);
    position(s, el);
  });
}

/* ====== TRANSITIONS ====== */
function clearPaths(){
  pathElems.forEach(p => p.g.remove());
  pathElems = [];
}

function computePath(from, to, parallelIndex, parallelCount){
  const fx = from.cx, fy = from.cy;
  const tx = to.cx, ty = to.cy;

  if(from.id === to.id){
    const R = NODE_R + 15;
    const sx = fx;
    const sy = fy - NODE_R;

    const c1x = fx - R;
    const c1y = fy - R*1.4;
    const c2x = fx + R;
    const c2y = fy - R*1.4;

    return {
      d: `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${sx} ${sy}`,
      label: { x: fx, y: fy - R*1.8 }
    };
  }

  const dx = tx - fx;
  const dy = ty - fy;
  const dist = Math.hypot(dx,dy);

  const ux = dx/dist;
  const uy = dy/dist;

  const px = -uy;
  const py =  ux;

  const sx = fx + ux*NODE_R;
  const sy = fy + uy*NODE_R;
  const ex = tx - ux*NODE_R;
  const ey = ty - uy*NODE_R;

  const base = Math.min(60, dist*0.35);

  let offset = 0;
  if(parallelCount > 1){
    const mid = (parallelCount-1)/2;
    offset = (parallelIndex - mid) * 25;
  }

  const cx = (sx+ex)/2 + px*(base + offset);
  const cy = (sy+ey)/2 + py*(base + offset);

  return {
    d: `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`,
    label: { x: cx, y: cy - 4 }
  };
}

function drawTransitions(){
  clearPaths();

  const groups = {};
  model.transitions.forEach((t,i)=>{
    const key = (t.from < t.to) ? `${t.from}|${t.to}` : `${t.to}|${t.from}`;
    if(!groups[key]) groups[key] = [];
    groups[key].push(i);
  });

  model.transitions.forEach((t,i)=>{
    const key = (t.from < t.to) ? `${t.from}|${t.to}` : `${t.to}|${t.from}`;
    const group = groups[key];
    const pIndex = group.indexOf(i);
    const pCount = group.length;

    const g = document.createElementNS(svgNS, "g");

    const path = document.createElementNS(svgNS, "path");
    path.classList.add("arrow");
    path.setAttribute("marker-end","url(#arrow)");

    const text = document.createElementNS(svgNS, "text");
    text.classList.add("label-text");
    text.textContent = t.symbol;

    g.appendChild(path);
    g.appendChild(text);
    svg.appendChild(g);

    pathElems.push({ g, path, text, t, pIndex, pCount });
  });

  updatePaths();
}

function updatePaths(){
  svg.setAttribute("width", diagram.clientWidth);
  svg.setAttribute("height", diagram.clientHeight);

  pathElems.forEach(p=>{
    const from = model.states.find(s=>s.id===p.t.from);
    const to   = model.states.find(s=>s.id===p.t.to);

    const out = computePath(from, to, p.pIndex, p.pCount);

    p.path.setAttribute("d", out.d);
    p.text.setAttribute("x", out.label.x);
    p.text.setAttribute("y", out.label.y);
  });
}

/* ====== TABLE ====== */
function renderTable(){
  thead.innerHTML = "";
  tbody.innerHTML = "";

  const hr = document.createElement("tr");
  hr.innerHTML = `<th>State</th>` + model.alpha.map(a=>`<th>${a}</th>`).join("");
  thead.appendChild(hr);

  model.states.forEach(s=>{
    const tr = document.createElement("tr");

    let name = s.id;
    if(model.start===s.id) name = "→ " + name;
    if(model.finals.has(s.id)) name += " *";

    let row = `<td style="text-align:left">${name}</td>`;
    model.alpha.forEach(sym=>{
      const t = model.transitions.find(x=>x.from===s.id && x.symbol===sym);
      row += `<td>${t ? t.to : "-"}</td>`;
    });

    tr.innerHTML = row;
    tbody.appendChild(tr);
  });
}

/* ====== ARRANGE ====== */
function arrange(){
  const rect = diagram.getBoundingClientRect();
  const cx = rect.width/2;
  const cy = rect.height/2;
  const n = model.states.length;

  const R = Math.min(rect.width, rect.height)/2 - 60;

  model.states.forEach((s,i)=>{
    const th = (i/n)*2*Math.PI - Math.PI/2;
    s.cx = cx + Math.cos(th)*R;
    s.cy = cy + Math.sin(th)*R;

    const el = nodeElems.get(s.id);
    position(s, el);
  });

  drawTransitions();
}

/* ====== BUTTONS ====== */
function generate(){
  const m = buildModel();
  if(!m) return;

  model = m;
  renderStates();
  drawTransitions();
  renderTable();
  btnArrange.disabled = false;
}

function clearAll(){
  model = null;
  nodeElems.forEach(el=>el.remove());
  nodeElems.clear();
  clearPaths();
  svg.appendChild(defs);
  thead.innerHTML = "";
  tbody.innerHTML = "";
  clearError();
  btnArrange.disabled = true;
}

btnGenerate.addEventListener("click", generate);
btnArrange.addEventListener("click", arrange);
btnClear.addEventListener("click", clearAll);
window.addEventListener("resize", updatePaths);

/* auto-grow textarea (and set initial height) */
document.querySelectorAll("textarea").forEach(t => {
  const grow = () => {
    t.style.height = "auto";
    t.style.height = t.scrollHeight + "px";
  };
  t.addEventListener("input", grow);
  grow(); // initial
});

/* DEFAULT EXAMPLE */
statesInput.value = "q0,q1,q2";
alphaInput.value = "0,1";
transInput.value =
`q0,0,q1
q0,1,q0
q1,0,q1
q1,1,q2
q2,0,q1
q2,1,q0`;
startInput.value = "q0";
finalInput.value = "q2";

})();
