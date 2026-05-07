import { useCallback, useEffect, useMemo } from 'react'
import { useNodesState } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import type { WorkspaceSlice } from '../../store/types'
import type { WorkspaceViewMode } from '../../store/types'
import type {
    CanvasTerminalNode,
    DraftAsset,
    MarkdownEditorNode,
    PerformerNode,
    WorkspaceAct,
} from '../../types'
import { composeCanvasEdges } from './canvas-edge-composer'
import { composeCanvasNodes } from './canvas-node-composer'
import {
    buildActCanvasNodes,
    buildCanvasTerminalWindowNodes,
    buildMarkdownEditorCanvasNodes,
    buildPerformerCanvasNodes,
} from './canvas-window-node-builders'

type CanvasNodeKind = 'performer' | 'markdownEditor' | 'canvasTerminal' | 'act'

type UseCanvasPresentationArgs = {
    acts: WorkspaceAct[]
    performers: PerformerNode[]
    markdownEditors: MarkdownEditorNode[]
    canvasTerminals: CanvasTerminalNode[]
    drafts: Record<string, DraftAsset>
    workingDir: string
    editingActId: string | null
    selectedActId: string | null
    selectedPerformerId: string | null
    selectedMarkdownEditorId: string | null
    focusedPerformerId: string | null
    viewMode: WorkspaceViewMode
    editingTarget: WorkspaceSlice['editingTarget']
    transformTarget: { id: string; type: CanvasNodeKind } | null
    performerMcpSummary: (performer: PerformerNode) => string | null
    onActivateTransform: (type: CanvasNodeKind, id: string) => void
    onDeactivateTransform: (type: CanvasNodeKind, id: string) => void
    onCloseTerminal: (id: string) => void
    onResizeTerminal: (id: string, width: number, height: number) => void
    onSessionChange: (id: string, sessionId: string | null, connected: boolean) => void
}

export function useCanvasPresentation(args: UseCanvasPresentationArgs) {
    const {
        acts,
        performers,
        markdownEditors,
        canvasTerminals,
        drafts,
        workingDir,
        editingActId,
        selectedActId,
        selectedPerformerId,
        selectedMarkdownEditorId,
        focusedPerformerId,
        viewMode,
        editingTarget,
        transformTarget,
        performerMcpSummary,
        onActivateTransform,
        onDeactivateTransform,
        onCloseTerminal,
        onResizeTerminal,
        onSessionChange,
    } = args

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])

    const buildPerformerNodes = useCallback(() => buildPerformerCanvasNodes({
        acts,
        editingActId,
        performers,
        selectedPerformerId,
        focusedPerformerId,
        editingTarget,
        transformTarget,
        drafts,
        performerMcpSummary,
        onActivateTransform,
        onDeactivateTransform,
    }), [
        acts,
        editingActId,
        performers,
        selectedPerformerId,
        focusedPerformerId,
        editingTarget,
        transformTarget,
        drafts,
        performerMcpSummary,
        onActivateTransform,
        onDeactivateTransform,
    ])

    const buildMarkdownEditorNodes = useCallback(() => buildMarkdownEditorCanvasNodes({
        markdownEditors,
        selectedMarkdownEditorId,
        transformTarget,
        workingDir,
        onActivateTransform,
        onDeactivateTransform,
    }), [
        markdownEditors,
        selectedMarkdownEditorId,
        transformTarget,
        workingDir,
        onActivateTransform,
        onDeactivateTransform,
    ])

    const buildCanvasTerminalNodes = useCallback(() => buildCanvasTerminalWindowNodes({
        canvasTerminals,
        transformTarget,
        onActivateTransform,
        onDeactivateTransform,
        onCloseTerminal,
        onResizeTerminal,
        onSessionChange,
    }), [
        canvasTerminals,
        transformTarget,
        onActivateTransform,
        onDeactivateTransform,
        onCloseTerminal,
        onResizeTerminal,
        onSessionChange,
    ])

    const buildActNodes = useCallback(() => buildActCanvasNodes({
        acts,
        editingActId,
        selectedActId,
        transformTarget,
        onActivateTransform,
        onDeactivateTransform,
    }), [
        acts,
        editingActId,
        selectedActId,
        transformTarget,
        onActivateTransform,
        onDeactivateTransform,
    ])

    useEffect(() => {
        const isCanvasMode = viewMode === 'canvas'
        setNodes(composeCanvasNodes({
            performerNodes: buildPerformerNodes(),
            markdownEditorNodes: isCanvasMode ? buildMarkdownEditorNodes() : [],
            canvasTerminalNodes: isCanvasMode ? buildCanvasTerminalNodes() : [],
            actNodes: buildActNodes(),
        }))
    }, [
        buildPerformerNodes,
        buildMarkdownEditorNodes,
        buildCanvasTerminalNodes,
        buildActNodes,
        viewMode,
        setNodes,
    ])

    const edges = useMemo(
        () => viewMode === 'canvas' ? composeCanvasEdges(acts, editingActId, performers) : [],
        [acts, editingActId, performers, viewMode],
    )

    return {
        nodes,
        setNodes,
        onNodesChange,
        edges,
    }
}
