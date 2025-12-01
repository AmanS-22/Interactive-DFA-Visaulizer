import {UI} from './ui.js';

const container = document.getElementById('diagram');
const ui = new UI(container);
ui.attachPointerHandlers();

// wire top controls
document.getElementById('btn-add-state').addEventListener('click', ()=>{
  const x = 40 + Math.random()*400; const y = 40 + Math.random()*200;
  ui.addStateAt(x,y);
});
document.getElementById('btn-import').addEventListener('click', ()=>{
  const txt = prompt('Paste JSON');
  if (txt) try{ ui.importFromJSON(JSON.parse(txt)); }catch(e){ alert('Invalid JSON'); }
});
document.getElementById('btn-export').addEventListener('click', ()=>{
  const json = JSON.stringify(ui.exportJSON(),null,2);
  prompt('Copy JSON', json);
});

document.getElementById('btn-run').addEventListener('click', ()=>{
  const input = document.getElementById('input-string').value || '';
  const res = ui.dfa.simulate(input);
  ui.highlightTrace(res.trace);
  const msg = res.accept ? `Accept (ended in final state)` : `Reject`;
  const m = document.getElementById('message'); m.textContent = msg; m.className = res.accept ? 'msg-success' : 'msg-warning';
});

document.getElementById('btn-reset').addEventListener('click', ()=>{ ui.highlightTrace([]); document.getElementById('message').textContent=''; });

document.getElementById('btn-step').addEventListener('click', ()=>{
  // simple single-step: advance one symbol each click
  if (!window.__stepState) window.__stepState = {pos:0, cur: ui.dfa.findStart(), trace: [ui.dfa.findStart()] };
  const state = window.__stepState;
  const input = document.getElementById('input-string').value || '';
  if (state.pos >= input.length) return;
  const ch = input[state.pos];
  const outs = ui.dfa.getOutgoing(state.cur);
  const taken = outs.find(t => t.symbols.has(ch));
  if (!taken) { ui.highlightTrace(state.trace); document.getElementById('message').textContent = 'Reject'; return; }
  state.cur = taken.to; state.trace.push(state.cur); state.pos++;
  ui.highlightTrace(state.trace);
  if (state.pos >= input.length) {
    const accept = !!ui.dfa.states.get(state.cur)?.final;
    document.getElementById('message').textContent = accept ? 'Accept' : 'Reject';
  }
});

// sample DFA preserved as default
function loadSample(){
  // q0 start -> q1 on a; q1 final -> q1 on b
  ui.addStateAt(40,40,{name:'q0',start:true});
  ui.addStateAt(240,40,{name:'q1',final:true});
  ui.dfa.addTransition('q0','q1',['a']);
  ui.dfa.addTransition('q1','q1',['b']);
  ui.diagram.scheduleDraw(ui.dfa.states, ui.dfa.transitions);
}

loadSample();
