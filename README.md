# Interactive DFA Visualizer

Small vanilla JS single-page app to build and simulate DFAs. Refactored to use ES modules, a single overlay SVG for transitions, and modern pointer events.

Quick start

1. Install dev deps:

```powershell
npm install
```

2. Run dev server:

```powershell
npm run dev
```

3. Run tests:

```powershell
npm test
```

Usage

- Open `index.html` (or run dev server). Add states with the "Add State" button or press N (planned). Drag states to reposition. Drag from the small handle on a state to another state to create a labeled transition (prompt will appear).
- Use `Run`, `Step`, and `Reset` to simulate input from the `Input` box. The trace will highlight visited states.
- Use `Import JSON`/`Export JSON` to save/load the DFA structure.
