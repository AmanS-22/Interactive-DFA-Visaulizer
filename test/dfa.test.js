import { describe, it, expect } from 'vitest';
import { DFA } from '../src/dfa.js';

describe('DFA basic', () => {
  it('simulates simple accept', () => {
    const d = new DFA();
    d.addState({id:'q0',start:true}); d.addState({id:'q1',final:true});
    d.addTransition('q0','q1',['a']); d.addTransition('q1','q1',['b']);
    const r = d.simulate('ab');
    expect(r.accept).toBe(false);
    const r2 = d.simulate('abb');
    expect(r2.accept).toBe(true);
  });

  it('detects determinism conflicts', () => {
    const d = new DFA(); d.addState({id:'q0',start:true}); d.addState({id:'q1'});
    d.addTransition('q0','q1',['a']); d.addTransition('q0','q1',['a']);
    const conflicts = d.validateDeterminism();
    expect(conflicts.length).toBe(1);
  });
});
