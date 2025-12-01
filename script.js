(() => {
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const parseList = (str) => (str || "").split(",").map(s => s.trim()).filter(Boolean);

  const statesInput = $("states-input");
  const alphaInput = $("alpha-input");
  const transInput = $("trans-input");
  const startInput = $("start-input");
  const finalInput = $("final-input");

  const btnGenerate = $("btn-generate");
  const btnArrange = $("btn-arrange");
  const btnClear = $("btn-clear");

  const errorBox = $("error");
  const diagram = $("diagram");
  const diagramContent = $("diagram-content");

  const tableHead = $("dfa-table").querySelector("thead");
  const tableBody = $("dfa-table").querySelector("tbody");

  const NODE_R = 30;
  const svgNS = "http://www.w3.org/2000/svg";

  let model = { states: [], alpha: [], transitions: [], start: null, finals: new Set() };
  let nodeElems = new Map();
  let pathElems = [];

  const svg = document.createElementNS(svgNS, "svg");
  svg.classList.add("svg-overlay");
  diagramContent.appendChild(svg);

  const marker = document.createElementNS(svgNS, "marker");
  marker.setAttribute("id", "arrow");
  marker.setAttribute("markerWidth", "10");
  marker.setAttribute("markerHeight", "10");
  marker.setAttribute("refX", "8");
  marker.setAttribute("refY", "5");
  marker.setAttribute("orient", "auto");

  const arrowHead = document.createElementNS(svgNS, "path");
  arrowHead.setAttribute("d", "M0,0 L10,5 L0,10 z");
  arrowHead.setAttribute("fill", "#999");

  marker.appendChild(arrowHead);
  const defs = document.createElementNS(svgNS, "defs");
  defs.appendChild(marker);
  svg.appendChild(defs);

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove("hidden");
  }

  function clearError() {
    errorBox.classList.add("hidden");
  }

  function parseTransitions(text) {
    return text
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(line => {
        const parts = line.split(",");
        return { from: parts[0].trim(), symbol: parts[1].trim(), to: parts[2].trim() };
      });
  }

  function buildModel() {
    clearError();

    const states = parseList(statesInput.value);
    const alpha = parseList(alphaInput.value);
    const transitions = parseTransitions(transInput.value);
    const start = startInput.value.trim();
    const finals = new Set(parseList(finalInput.value));

    model = {
      states: states.map((id, i) => ({ id, x: 100 + i * 90, y: 150 })),
      alpha,
      transitions,
      start,
      finals
    };

    return model;
  }

  function renderStates() {
    model.states.forEach(s => {
      let el = nodeElems.get(s.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "state";
        el.textContent = s.id;

        let drag = null;

        el.addEventListener("pointerdown", e => {
          e.stopPropagation();
          el.setPointerCapture(e.pointerId);
          drag = { startX: e.clientX, startY: e.clientY, origX: s.x, origY: s.y };
        });

        document.addEventListener("pointermove", e => {
          if (!drag) return;
          s.x = drag.origX + (e.clientX - drag.startX);
          s.y = drag.origY + (e.clientY - drag.startY);
          el.style.left = s.x + "px";
          el.style.top = s.y + "px";
          updatePaths();
        });

        el.addEventListener("pointerup", () => (drag = null));

        diagramContent.appendChild(el);
        nodeElems.set(s.id, el);
      }

      el.style.left = s.x + "px";
      el.style.top = s.y + "px";
      el.classList.toggle("start", model.start === s.id);
      el.classList.toggle("final", model.finals.has(s.id));
    });
  }

  function drawTransitions() {
    svg.innerHTML = "";
    svg.appendChild(defs);
    pathElems = [];

    model.transitions.forEach(t => {
      const g = document.createElementNS(svgNS, "g");
      const path = document.createElementNS(svgNS, "path");
      path.classList.add("arrow");
      path.setAttribute("marker-end", "url(#arrow)");

      const label = document.createElementNS(svgNS, "text");
      label.classList.add("label-text");
      label.textContent = t.symbol;

      g.appendChild(path);
      g.appendChild(label);
      svg.appendChild(g);

      pathElems.push({ g, path, label, t });
    });

    updatePaths();
  }

  function updatePaths() {
    pathElems.forEach(p => {
      const from = model.states.find(s => s.id === p.t.from);
      const to = model.states.find(s => s.id === p.t.to);

      const fx = from.x + NODE_R;
      const fy = from.y + NODE_R;
      const tx = to.x + NODE_R;
      const ty = to.y + NODE_R;

      const dx = tx - fx;
      const dy = ty - fy;
      const cx = (fx + tx) / 2 - dy * 0.1;
      const cy = (fy + ty) / 2 + dx * 0.1;

      p.path.setAttribute("d", `M${fx},${fy} Q${cx},${cy} ${tx},${ty}`);

      p.label.setAttribute("x", cx);
      p.label.setAttribute("y", cy);
    });
  }

  function renderTable() {
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";

    const hr = document.createElement("tr");
    hr.innerHTML = "<th>State</th>" + model.alpha.map(a => `<th>${a}</th>`).join("");
    tableHead.appendChild(hr);

    model.states.forEach(s => {
      const tr = document.createElement("tr");
      const label = `${model.start === s.id ? "→ " : ""}${s.id}${model.finals.has(s.id) ? " *" : ""}`;
      tr.innerHTML = `<th>${label}</th>` + model.alpha.map(a => {
        const t = model.transitions.find(x => x.from === s.id && x.symbol === a);
        return `<td>${t ? t.to : "-"}</td>`;
      }).join("");
      tableBody.appendChild(tr);
    });
  }

  function generate() {
    buildModel();
    renderStates();
    drawTransitions();
    renderTable();
  }

  btnGenerate.addEventListener("click", generate);
  btnArrange.addEventListener("click", () => { model.states.forEach((s,i)=>{ s.x=100+i*120; s.y=150; }); renderStates(); updatePaths(); });
  btnClear.addEventListener("click", () => location.reload());

  // Default example
  statesInput.value = "q0,q1,q2";
  alphaInput.value = "0,1";
  transInput.value = "q0,0,q1\nq0,1,q0\nq1,0,q1\nq1,1,q2\nq2,0,q1\nq2,1,q0";
  startInput.value = "q0";
  finalInput.value = "q2";
  generate();
})();
