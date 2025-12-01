// Diagram drawing: single overlay SVG that draws transitions
export class Diagram {
  constructor(container) {
    this.container = container;
    this.svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    this.svg.classList.add('overlay');
    this.svg.setAttribute('preserveAspectRatio','xMinYMin');
    this.container.appendChild(this.svg);
    this.defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
    this.svg.appendChild(this.defs);
    this.markerId = 'arrowhead';
    this._createMarkers();
    this.paths = new Map();
    this._pending = false;
    this._cache = {rect:null};
  }

  _createMarkers(){
    const m = document.createElementNS('http://www.w3.org/2000/svg','marker');
    m.setAttribute('id',this.markerId);
    m.setAttribute('markerWidth','10'); m.setAttribute('markerHeight','8');
    m.setAttribute('refX','8'); m.setAttribute('refY','4'); m.setAttribute('orient','auto');
    const p = document.createElementNS('http://www.w3.org/2000/svg','path');
    p.setAttribute('d','M0,0 L8,4 L0,8 z'); p.setAttribute('fill','#334155');
    m.appendChild(p); this.defs.appendChild(m);
  }

  scheduleDraw(states, transitions) {
    if (this._pending) return;
    this._pending = true;
    requestAnimationFrame(()=>{ this._pending=false; this.draw(states, transitions); });
  }

  draw(statesMap, transitions) {
    // cache container rect
    const rect = this.container.getBoundingClientRect();
    this._cache.rect = rect;
    this.svg.setAttribute('width',rect.width); this.svg.setAttribute('height',rect.height);
    // clear contents except defs
    while (this.svg.childNodes.length>1) this.svg.removeChild(this.svg.lastChild);

    // compute mapping from id -> center coords
    const coords = new Map();
    for (const s of statesMap.values()) coords.set(s.id, {x:s.x, y:s.y, w:72, h:72});

    // group parallel edges by unordered pair
    const buckets = new Map();
    transitions.forEach(t=>{
      const key = `${t.from}__${t.to}`;
      if (!buckets.has(key)) buckets.set(key,[]);
      buckets.get(key).push(t);
    });

    // draw each transition
    for (const [key, arr] of buckets) {
      for (let i=0;i<arr.length;i++){
        const t = arr[i];
        const p = this._drawTransition(coords, t, i, arr.length);
        this.svg.appendChild(p);
      }
    }
  }

  _drawTransition(coords, t, index, total) {
    const from = coords.get(t.from); const to = coords.get(t.to);
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns,'g');
    const path = document.createElementNS(ns,'path');
    path.classList.add('transition');
    if ([...t.symbols].includes('ε')) path.classList.add('epsilon');
    path.setAttribute('marker-end',`url(#${this.markerId})`);

    // compute path
    const dx = to.x - from.x; const dy = to.y - from.y;
    const dist = Math.hypot(dx,dy);
    let sx = from.x + 36; let sy = from.y + 36; // center
    let tx = to.x + 36; let ty = to.y + 36;
    if (t.from === t.to) {
      // self loop: circular arc
      const r = 28 + 8*index;
      const d = `M ${sx} ${sy - 36} C ${sx + r} ${sy - 80} ${sx - r} ${sy - 80} ${sx} ${sy - 36}`;
      path.setAttribute('d', d);
    } else {
      // offset curve for parallel edges
      const normx = dx/dist; const normy = dy/dist;
      const midx = (sx+tx)/2; const midy = (sy+ty)/2;
      const offset = (index - (total-1)/2) * 18; // spread
      const cx = midx - normy*offset; const cy = midy + normx*offset;
      const d = `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;
      path.setAttribute('d',d);
    }

    // label
    const label = document.createElementNS(ns,'text');
    label.classList.add('label');
    const labelPos = this._labelAt(path);
    label.setAttribute('x', labelPos.x); label.setAttribute('y', labelPos.y);
    label.textContent = [...t.symbols].join(',');

    g.appendChild(path);
    g.appendChild(label);
    return g;
  }

  _labelAt(path){
    // naive: use path bbox center
    try{
      const bbox = path.getBBox();
      return {x: bbox.x + bbox.width/2, y: bbox.y + bbox.height/2 - 6};
    }catch(e){
      return {x:0,y:0};
    }
  }
}
