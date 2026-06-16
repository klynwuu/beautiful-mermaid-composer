/**
 * Class diagram layout engine (ELK.js).
 *
 * Each class box has 3 compartments:
 *   1. Header (class name + optional annotation)
 *   2. Attributes section
 *   3. Methods section
 */

import type { ElkNode, ElkExtendedEdge } from 'elkjs'
import type { ClassDiagram, ClassNode, ClassMember, PositionedClassDiagram, PositionedClassNode, PositionedClassRelationship, PositionedClassNote } from './types.ts'
import type { RenderOptions, Point } from '../types.ts'
import { estimateTextWidth, estimateMonoTextWidth, FONT_SIZES, FONT_WEIGHTS } from '../styles.ts'
import { measureMultilineText } from '../text-metrics.ts'
import { elkLayoutSync } from '../elk-instance.ts'

/** Layout constants for class diagrams */
export const CLS = {
  padding: 40,
  boxPadX: 8,
  headerBaseHeight: 32,
  annotationHeight: 16,
  memberRowHeight: 20,
  sectionPadY: 8,
  emptySectionHeight: 8,
  minWidth: 120,
  memberFontSize: 11,
  memberFontWeight: 400,
  nodeSpacing: 40,
  layerSpacing: 60,
  notePadX: 10,
  notePadY: 7,
  noteMinWidth: 50,
} as const

/** Font used for note text (matches edge-label sizing) */
const NOTE_FONT_SIZE = FONT_SIZES.edgeLabel
const NOTE_FONT_WEIGHT = FONT_WEIGHTS.edgeLabel

/** Compute the rendered box size of a note from its (possibly multi-line) text. */
function noteSize(text: string): { width: number; height: number } {
  const metrics = measureMultilineText(text, NOTE_FONT_SIZE, NOTE_FONT_WEIGHT)
  return {
    width: Math.max(CLS.noteMinWidth, metrics.width + CLS.notePadX * 2),
    height: metrics.height + CLS.notePadY * 2,
  }
}

type ClassSizeMap = Map<string, { width: number; height: number; headerHeight: number; attrHeight: number; methodHeight: number }>

/** Build ELK graph and size map from a class diagram. */
function buildClassElkGraph(
  diagram: ClassDiagram,
  _options: RenderOptions
): { elkGraph: ElkNode; classSizes: ClassSizeMap } {
  const classSizes: ClassSizeMap = new Map()

  for (const cls of diagram.classes) {
    const headerHeight = cls.annotation
      ? CLS.headerBaseHeight + CLS.annotationHeight
      : CLS.headerBaseHeight

    const attrHeight = cls.attributes.length > 0
      ? cls.attributes.length * CLS.memberRowHeight + CLS.sectionPadY
      : CLS.emptySectionHeight

    const methodHeight = cls.methods.length > 0
      ? cls.methods.length * CLS.memberRowHeight + CLS.sectionPadY
      : CLS.emptySectionHeight

    const headerTextW = estimateTextWidth(cls.label, FONT_SIZES.nodeLabel, FONT_WEIGHTS.nodeLabel)
    const maxAttrW = maxMemberWidth(cls.attributes)
    const maxMethodW = maxMemberWidth(cls.methods)
    const width = Math.max(CLS.minWidth, headerTextW + CLS.boxPadX * 2, maxAttrW + CLS.boxPadX * 2, maxMethodW + CLS.boxPadX * 2)
    const height = headerHeight + attrHeight + methodHeight

    classSizes.set(cls.id, { width, height, headerHeight, attrHeight, methodHeight })
  }

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': String(CLS.nodeSpacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(CLS.layerSpacing),
      'elk.padding': `[top=${CLS.padding},left=${CLS.padding},bottom=${CLS.padding},right=${CLS.padding}]`,
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.edgeLabels.placement': 'CENTER',
    },
    children: [],
    edges: [],
  }

  for (const cls of diagram.classes) {
    const size = classSizes.get(cls.id)!
    elkGraph.children!.push({ id: cls.id, width: size.width, height: size.height })
  }

  for (let i = 0; i < diagram.relationships.length; i++) {
    const rel = diagram.relationships[i]!
    const edge: ElkExtendedEdge = { id: `e${i}`, sources: [rel.from], targets: [rel.to] }
    if (rel.label) {
      const metrics = measureMultilineText(rel.label, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel)
      edge.labels = [{ text: rel.label, width: metrics.width + 8, height: metrics.height + 6 }]
    }
    elkGraph.edges!.push(edge)
  }

  // Notes become extra nodes; attached notes also get a connector edge so ELK
  // reserves space for them and routes the dotted link to the class.
  for (const note of diagram.notes) {
    const size = noteSize(note.text)
    elkGraph.children!.push({ id: note.id, width: size.width, height: size.height })
    if (note.forClass) {
      elkGraph.edges!.push({
        id: `noteedge:${note.id}`,
        sources: [note.id],
        targets: [note.forClass],
      })
    }
  }

  return { elkGraph, classSizes }
}

/** Extract positioned classes and relationships from ELK result. */
function extractClassLayout(
  result: ElkNode,
  diagram: ClassDiagram,
  classSizes: ClassSizeMap
): PositionedClassDiagram {
  const classLookup = new Map<string, ClassNode>()
  for (const cls of diagram.classes) classLookup.set(cls.id, cls)

  const positionedClasses: PositionedClassNode[] = []
  for (const child of result.children ?? []) {
    const cls = classLookup.get(child.id)
    if (cls) {
      const size = classSizes.get(cls.id)!
      positionedClasses.push({
        id: cls.id,
        label: cls.label,
        annotation: cls.annotation,
        attributes: cls.attributes,
        methods: cls.methods,
        x: child.x ?? 0,
        y: child.y ?? 0,
        width: child.width ?? size.width,
        height: child.height ?? size.height,
        headerHeight: size.headerHeight,
        attrHeight: size.attrHeight,
        methodHeight: size.methodHeight,
      })
    }
  }

  // Index edges by id so relationships and note connectors can be matched
  // independently of ELK's output ordering.
  const edgeById = new Map<string, ElkExtendedEdge>()
  for (const e of result.edges ?? []) edgeById.set(e.id, e)

  const edgePoints = (elkEdge: ElkExtendedEdge | undefined): Point[] => {
    const points: Point[] = []
    if (elkEdge?.sections && elkEdge.sections.length > 0) {
      const section = elkEdge.sections[0]!
      points.push({ x: section.startPoint.x, y: section.startPoint.y })
      for (const bp of section.bendPoints ?? []) points.push({ x: bp.x, y: bp.y })
      points.push({ x: section.endPoint.x, y: section.endPoint.y })
    }
    return points
  }

  const relationships: PositionedClassRelationship[] = []
  for (let i = 0; i < diagram.relationships.length; i++) {
    const rel = diagram.relationships[i]!
    const elkEdge = edgeById.get(`e${i}`)
    const points = edgePoints(elkEdge)

    let labelPosition: Point | undefined
    if (elkEdge?.labels && elkEdge.labels.length > 0) {
      const label = elkEdge.labels[0]!
      if (label.x != null && label.y != null) {
        labelPosition = {
          x: label.x + (label.width ?? 0) / 2,
          y: label.y + (label.height ?? 0) / 2,
        }
      }
    }

    relationships.push({
      from: rel.from,
      to: rel.to,
      type: rel.type,
      markerAt: rel.markerAt,
      label: rel.label,
      fromCardinality: rel.fromCardinality,
      toCardinality: rel.toCardinality,
      points,
      labelPosition,
    })
  }

  // Notes: position from their layout nodes; attach connector points if present.
  const childById = new Map<string, ElkNode>()
  for (const child of result.children ?? []) childById.set(child.id, child)

  const notes: PositionedClassNote[] = []
  for (const note of diagram.notes) {
    const child = childById.get(note.id)
    if (!child) continue
    const connectorPoints = note.forClass ? edgePoints(edgeById.get(`noteedge:${note.id}`)) : undefined
    notes.push({
      id: note.id,
      text: note.text,
      x: child.x ?? 0,
      y: child.y ?? 0,
      width: child.width ?? 0,
      height: child.height ?? 0,
      connectorPoints: connectorPoints && connectorPoints.length >= 2 ? connectorPoints : undefined,
    })
  }

  return {
    width: result.width ?? 600,
    height: result.height ?? 400,
    classes: positionedClasses,
    relationships,
    notes,
  }
}

/**
 * Lay out a parsed class diagram using ELK.js (synchronous).
 */
export function layoutClassDiagramSync(
  diagram: ClassDiagram,
  options: RenderOptions = {}
): PositionedClassDiagram {
  if (diagram.classes.length === 0 && diagram.notes.length === 0) {
    return { width: 0, height: 0, classes: [], relationships: [], notes: [] }
  }

  const { elkGraph, classSizes } = buildClassElkGraph(diagram, options)
  const result = elkLayoutSync(elkGraph)
  return extractClassLayout(result, diagram, classSizes)
}

/** Calculate the max width of a list of class members (uses mono metrics) */
function maxMemberWidth(members: ClassMember[]): number {
  if (members.length === 0) return 0
  let maxW = 0
  for (const m of members) {
    const text = memberToString(m)
    const w = estimateMonoTextWidth(text, CLS.memberFontSize)
    if (w > maxW) maxW = w
  }
  return maxW
}

/** Convert a class member to its display string */
export function memberToString(m: ClassMember): string {
  const vis = m.visibility ? `${m.visibility} ` : ''
  const name = m.isMethod ? `${m.name}(${m.params || ''})` : m.name
  const type = m.type ? `: ${m.type}` : ''
  return `${vis}${name}${type}`
}
