// DFA data model, validation and simulation
export class DFA {
  constructor() {
    this.states = new Map(); // id -> {id,name,x,y,start,final}
    this.transitions = []; // {from,to,symbols: Set}
    this.nextId = 0;
  }

  addState({id, name, x = 80, y = 80, start = false, final = false} = {}) {
    const sid = id ?? `q${this.nextId++}`;
    this.states.set(sid, {id: sid, name: name ?? sid, x, y, start, final});
    return sid;
  }

  updateStatePos(id, x, y) {
    const s = this.states.get(id);
    if (s) { s.x = x; s.y = y; }
  }

  setStart(id) {
    for (const st of this.states.values()) st.start = false;
    const s = this.states.get(id); if (s) s.start = true;
  }

  addTransition(from, to, symbols) {
    const set = new Set((Array.isArray(symbols) ? symbols : [symbols]).map(s => s.trim()).filter(Boolean));
    if (!set.size) return;
    // merge if same from->to
    const existing = this.transitions.find(t => t.from === from && t.to === to);
    if (existing) {
      for (const sym of set) existing.symbols.add(sym);
      return existing;
    }
    const t = {from, to, symbols: new Set(set)};
    this.transitions.push(t);
    return t;
  }

  removeTransition(t) {
    const i = this.transitions.indexOf(t);
    if (i >= 0) this.transitions.splice(i, 1);
  }

  getOutgoing(stateId) {
    return this.transitions.filter(t => t.from === stateId);
  }

  validateDeterminism() {
    // returns list of conflicts: {state, symbol, transitions}
    const conflicts = [];
    for (const [id] of this.states) {
      const out = this.getOutgoing(id);
      const map = new Map();
      for (const t of out) {
        for (const s of t.symbols) {
          if (!map.has(s)) map.set(s, []);
          map.get(s).push(t);
        }
      }
      for (const [sym, lst] of map) {
        if (lst.length > 1 && sym !== 'ε') conflicts.push({state:id, symbol:sym, transitions:lst});
      }
    }
    return conflicts;
  }

  findStart() {
    for (const s of this.states.values()) if (s.start) return s.id;
    return null;
  }

  simulate(input) {
    // returns {accept, trace: [stateId], path: [{from,to,symbol}]}
    const trace = [];
    const path = [];
    let cur = this.findStart();
    if (!cur) return {accept:false, trace, path};
    trace.push(cur);
    for (const ch of input) {
      // choose outgoing with symbol matching ch
      const outs = this.getOutgoing(cur);
      let taken = null;
      for (const t of outs) {
        if (t.symbols.has(ch)) { taken = t; break; }
      }
      if (!taken) return {accept:false, trace, path};
      path.push({from:taken.from,to:taken.to,symbol:[...taken.symbols].join(',')});
      cur = taken.to; trace.push(cur);
    }
    const accept = !!this.states.get(cur)?.final;
    return {accept, trace, path};
  }

  toJSON() {
    return {
      states: [...this.states.values()],
      transitions: this.transitions.map(t => ({from:t.from,to:t.to,symbols:[...t.symbols]}))
    };
  }

  fromJSON(obj) {
    this.states.clear(); this.transitions.length = 0; this.nextId = 0;
    for (const s of obj.states||[]) {
      this.states.set(s.id, {...s});
      const n = parseInt(s.id.replace(/^q/,''));
      if (!Number.isNaN(n)) this.nextId = Math.max(this.nextId, n+1);
    }
    for (const t of obj.transitions||[]) this.transitions.push({from:t.from,to:t.to,symbols:new Set(t.symbols||[])});
  }
}
