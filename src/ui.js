import {Diagram} from './diagram.js';
import {DFA} from './dfa.js';

export class UI {
  constructor(container, options={}){
    this.container = container;
    this.template = document.getElementById('state-template');
    this.diagram = new Diagram(container);
    this.dfa = new DFA();
    this.stateElems = new Map();
    this.dragging = null;
    this.transitionStart = null;
    this._raf = null;
    this._resizeTimer = null;
    this._setupEvents();
  }

  _setupEvents(){
    window.addEventListener('resize', ()=>{
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(()=> this.diagram.scheduleDraw(this.dfa.states, this.dfa.transitions), 120);
    });
  }

  addStateAt(x,y,opts={}){
    const id = this.dfa.addState({x,y,...opts});
    const node = this._createStateElement(this.dfa.states.get(id));
    this.container.appendChild(node);
    this.stateElems.set(id,node);
    this._applyStatePosition(id);
    this.diagram.scheduleDraw(this.dfa.states,this.dfa.transitions);
    return id;
  }

  _createStateElement(state){
    const tpl = this.template.content.firstElementChild.cloneNode(true);
    tpl.dataset.id = state.id;
    tpl.querySelector('.state-name').textContent = state.name;
    if (state.final) tpl.classList.add('final');
    if (state.start) tpl.classList.add('start');

    // pointer events for dragging
    const onPointerDown = (ev) => {
      tpl.setPointerCapture(ev.pointerId);
      this.dragging = {id: state.id, startX: ev.clientX, startY: ev.clientY, origX: state.x, origY: state.y};
    };
    tpl.addEventListener('pointerdown', onPointerDown);

    const handle = tpl.querySelector('.handle');
    handle.addEventListener('pointerdown', (ev)=>{
      ev.stopPropagation();
      // start transition creation
      this.transitionStart = {from: state.id, startX: ev.clientX, startY: ev.clientY};
      // capture pointer on container to follow
      this.container.setPointerCapture(ev.pointerId);
    });

    return tpl;
  }

  _applyStatePosition(id){
    const s = this.dfa.states.get(id);
    const el = this.stateElems.get(id);
    if (!s || !el) return;
    el.style.left = `${s.x}px`; el.style.top = `${s.y}px`;
  }

  attachPointerHandlers(){
    // global pointermove/up for drag and transition create
    document.addEventListener('pointermove', (ev)=>{
      if (this.dragging) {
        const d = this.dragging;
        const nx = Math.max(4, Math.min(this.container.clientWidth-76, d.origX + (ev.clientX - d.startX)));
        const ny = Math.max(4, Math.min(this.container.clientHeight-76, d.origY + (ev.clientY - d.startY)));
        this.dfa.updateStatePos(d.id, nx, ny);
        this._applyStatePosition(d.id);
        this.diagram.scheduleDraw(this.dfa.states,this.dfa.transitions);
      }
      if (this.transitionStart) {
        // not drawing live edge for simplicity — just placeholder could be added
      }
    });

    document.addEventListener('pointerup', (ev)=>{
      if (this.dragging) { this.dragging = null; }
      if (this.transitionStart) {
        // determine target element under pointer
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const target = el && el.closest && el.closest('.state');
        const toId = target ? target.dataset.id : null;
        const fromId = this.transitionStart.from;
        // prompt for symbols
        const input = prompt('Enter symbol(s) for transition (comma separated). Use ε for epsilon.');
        if (input!=null) {
          const syms = input.split(',').map(s=>s.trim()).filter(Boolean);
          if (toId) {
            this.dfa.addTransition(fromId, toId, syms);
          } else {
            // if released on empty area, create new state and connect
            const rect = this.container.getBoundingClientRect();
            const nx = ev.clientX - rect.left - 36; const ny = ev.clientY - rect.top - 36;
            const newId = this.addStateAt(nx,ny);
            this.dfa.addTransition(fromId, newId, syms);
          }
        }
        this.transitionStart = null;
        this.diagram.scheduleDraw(this.dfa.states,this.dfa.transitions);
      }
    });
  }

  importFromJSON(obj){ this.dfa.fromJSON(obj); this._rebuildDOM(); }

  exportJSON(){ return this.dfa.toJSON(); }

  _rebuildDOM(){
    // clear existing state elements
    for (const el of this.stateElems.values()) el.remove();
    this.stateElems.clear();
    for (const s of this.dfa.states.values()){ this._createAndAppendState(s); }
    this.diagram.scheduleDraw(this.dfa.states,this.dfa.transitions);
  }

  _createAndAppendState(s){ const el = this._createStateElement(s); this.container.appendChild(el); this.stateElems.set(s.id,el); this._applyStatePosition(s.id); }

  highlightTrace(trace){
    // clear
    this.stateElems.forEach((el)=>el.classList.remove('selected'));
    for (const id of trace) {
      const el = this.stateElems.get(id); if (el) el.classList.add('selected');
    }
  }
}
