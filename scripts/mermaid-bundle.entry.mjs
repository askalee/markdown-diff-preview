import mermaid from 'mermaid';
import elkLayouts from '@mermaid-js/layout-elk';

// Register ELK layouts (elk, elk.stress, elk.force, elk.mrtree,
// elk.sporeOverlap) on the shared instance so diagrams requesting
// `"layout": "elk"` render instead of throwing
// "Unknown layout algorithm: elk".
mermaid.registerLayoutLoaders(elkLayouts);

globalThis.mermaid = mermaid;
if (typeof window !== 'undefined') {
    window.mermaid = mermaid;
}
