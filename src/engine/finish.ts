// ============================================================================
// BASE_FINISH_CSS — the shared "beautiful finish" injected as mermaid themeCSS.
//
// Official mermaid + our themeVariables already reproduce ~85–90% of the custom
// look (colors, fonts, shapes). This CSS closes the remaining gap that themeVars
// can't express: node corner radius, edge-label chips, stroke weights, cluster
// (subgraph) treatment, and monospace member rows for class/ER diagrams.
//
// It is the SHARED base; a theme file's optional `css` is appended after this so
// individual identities can override or extend the look.
//
// Targets mermaid's base-theme SVG classes. We bias toward neutral, theme-driven
// values (var(--…) where mermaid exposes them) and avoid hard-coded colors so
// the finish stays correct across every palette.
// ============================================================================

export const BASE_FINISH_CSS = `
/* ── Nodes ─────────────────────────────────────────────────────────────── */
.node rect,
.node polygon,
.node path {
  rx: 6px;
  ry: 6px;
  stroke-width: 1.25px;
}
/* Stadium / pill nodes keep their full radius; don't fight mermaid here. */
.node .label,
.nodeLabel {
  font-weight: 500;
}

/* ── Edges ─────────────────────────────────────────────────────────────── */
.edgePath .path,
.flowchart-link {
  stroke-width: 1.5px;
}

/* Edge-label "chips": rounded, padded background behind the label text so
   Yes/No-style labels read as pills (matches the custom renderer). The fill
   comes from mermaid's edgeLabelBackground themeVariable. */
.edgeLabel rect,
.edgeLabels rect,
.edgeLabel .label-container {
  rx: 4px;
  ry: 4px;
}
.edgeLabel,
.edgeLabel p {
  font-size: 12px;
}

/* ── Clusters (subgraphs) ──────────────────────────────────────────────── */
.cluster rect {
  rx: 8px;
  ry: 8px;
  stroke-width: 1px;
}

/* ── Class / ER member rows → monospace (matches custom renderer) ──────── */
.classGroup .title,
.classTitle {
  font-weight: 600;
}
.classGroup text.classText,
.entityLabel,
.attributeBoxOdd text,
.attributeBoxEven text {
  font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace;
}
`
