import { describe, expect, it } from 'vitest'
import {
    ACT_DEFAULT_EXPANDED_HEIGHT,
    ACT_DEFAULT_WIDTH,
} from '../lib/act-layout'
import { createPerformerNode, PERFORMER_DEFAULT_HEIGHT } from '../lib/performers'
import {
    addSplitViewPaneImpl,
    buildSyncFocusViewportState,
    buildExitFocusModeState,
    enterEmptyFullViewImpl,
    enterEmptySplitViewImpl,
    enterFocusModeImpl,
    enterSplitViewImpl,
    exitFocusModeImpl,
    insertSplitViewPaneImpl,
    moveSplitViewPaneImpl,
    removeSplitViewPaneImpl,
    replaceSplitViewPaneImpl,
    resizeSplitViewBoundaryImpl,
    switchFocusTargetImpl,
} from './workspace-focus-actions'
import { createEmptySplitViewState, createSplitViewPane, resolveSplitDropIntent } from '../lib/focus-utils'
import { createMarkdownEditorImpl } from './workspace-draft-actions'
import type { StudioState } from './types'

function createTestState(): StudioState {
    return {
        performers: [
            createPerformerNode({ id: 'performer-1', name: 'Alpha', x: 0, y: 0 }),
            createPerformerNode({ id: 'performer-2', name: 'Beta', x: 240, y: 0 }),
        ],
        acts: [],
        markdownEditors: [],
        drafts: {},
        workingDir: '',
        workspaceId: null,
        selectedPerformerId: null,
        selectedPerformerSessionId: null,
        selectedMarkdownEditorId: null,
        viewMode: 'canvas',
        splitView: createEmptySplitViewState(),
        focusSnapshot: null,
        canvasRevealTarget: null,
        inspectorFocus: null,
        workspaceList: [],
        workspaceDirty: false,
        theme: 'dark',
        isTerminalOpen: true,
        isTrackingOpen: false,
        isAssetLibraryOpen: true,
        canvasTerminals: [],
        canvasCenter: null,
        layoutActId: null,
        editingTarget: null,
        selectedActId: null,
        actEditorState: null,
        actThreads: {},
        activeThreadId: null,
        activeThreadParticipantKey: null,
        chatDrafts: {},
        chatPrefixes: {},
        activeChatPerformerId: null,
        sessions: [],
        seEntities: {},
        seMessages: {},
        seStatuses: {},
        sePermissions: {},
        seQuestions: {},
        seTodos: {},
        chatKeyToSession: {},
        sessionToChatKey: {},
        sessionLoading: {},
        sessionReverts: {},
        isAssistantOpen: true,
        assistantModel: null,
        assistantAvailableModels: [],
        appliedAssistantActionMessageIds: {},
        assistantActionResults: {},
        recordStudioChange: (() => 'lazy_projection') as StudioState['recordStudioChange'],
    } as unknown as StudioState
}

function createStateHarness(initialState = createTestState()) {
    let state = initialState

    return {
        get: () => state,
        set: (partial: Partial<StudioState> | ((current: StudioState) => Partial<StudioState>)) => {
            const nextPartial = typeof partial === 'function' ? partial(state) : partial
            state = { ...state, ...nextPartial }
        },
        read: () => state,
    }
}

describe('workspace focus actions', () => {
    it('records the focused node id and closes side panels when entering performer focus', () => {
        const harness = createStateHarness()

        enterFocusModeImpl(harness.get, harness.set, 'performer-1', 'performer', { width: 900, height: 700 })

        const state = harness.read()
        expect(state.focusSnapshot?.nodeId).toBe('performer-1')
        expect(state.focusSnapshot?.type).toBe('performer')
        expect(state.viewMode).toBe('full')
        expect(state.isAssetLibraryOpen).toBe(false)
        expect(state.isAssistantOpen).toBe(false)
        expect(state.isTrackingOpen).toBe(false)
        expect(state.isTerminalOpen).toBe(false)
        expect(state.performers.find((entry) => entry.id === 'performer-1')).toMatchObject({
            hidden: false,
            width: 900,
            height: 700,
        })
        expect(state.performers.find((entry) => entry.id === 'performer-2')?.hidden).toBe(true)
    })

    it('restores performer size from the snapshot when exiting focus mode', () => {
        const harness = createStateHarness()

        enterFocusModeImpl(harness.get, harness.set, 'performer-1', 'performer', { width: 900, height: 700 })

        exitFocusModeImpl(harness.get, harness.set)

        const state = harness.read()
        expect(state.focusSnapshot).toBeNull()
        expect(state.viewMode).toBe('canvas')
        expect(state.performers.find((entry) => entry.id === 'performer-1')).toMatchObject({
            hidden: false,
            width: 320,
            height: PERFORMER_DEFAULT_HEIGHT,
        })
        expect(state.isAssetLibraryOpen).toBe(true)
        expect(state.isAssistantOpen).toBe(true)
        expect(state.isTrackingOpen).toBe(false)
        expect(state.isTerminalOpen).toBe(true)
    })

    it('closes and restores workspace tracking around focus mode', () => {
        const harness = createStateHarness({
            ...createTestState(),
            isAssistantOpen: false,
            isTrackingOpen: true,
        } as StudioState)

        enterFocusModeImpl(harness.get, harness.set, 'performer-1', 'performer', { width: 900, height: 700 })

        expect(harness.read().isTrackingOpen).toBe(false)
        expect(harness.read().focusSnapshot).toMatchObject({
            assistantOpen: false,
            trackingOpen: true,
        })

        exitFocusModeImpl(harness.get, harness.set)

        expect(harness.read().isAssistantOpen).toBe(false)
        expect(harness.read().isTrackingOpen).toBe(true)
    })

    it('switches focus targets by restoring the baseline layout before refocusing', () => {
        const harness = createStateHarness()

        enterFocusModeImpl(harness.get, harness.set, 'performer-1', 'performer', { width: 900, height: 700 })

        switchFocusTargetImpl(harness.get, harness.set, 'performer-2', 'performer')

        const state = harness.read()
        expect(state.focusSnapshot?.nodeId).toBe('performer-2')
        expect(state.performers.find((entry) => entry.id === 'performer-1')).toMatchObject({
            hidden: true,
            position: { x: 0, y: 0 },
            width: 320,
            height: PERFORMER_DEFAULT_HEIGHT,
        })
        expect(state.performers.find((entry) => entry.id === 'performer-2')).toMatchObject({
            hidden: false,
            width: 900,
            height: 700,
        })
    })

    it('switches from an act focus target back to a performer using the restored baseline state', () => {
        const harness = createStateHarness({
            ...createTestState(),
            acts: [{
                id: 'act-1',
                name: 'Control',
                position: { x: 220, y: 160 },
                width: ACT_DEFAULT_WIDTH,
                height: ACT_DEFAULT_EXPANDED_HEIGHT,
                participants: {},
                relations: [],
                createdAt: Date.now(),
                hidden: false,
            }],
        } as StudioState)

        enterFocusModeImpl(harness.get, harness.set, 'act-1', 'act', { width: 1000, height: 760 })
        switchFocusTargetImpl(harness.get, harness.set, 'performer-2', 'performer')

        const state = harness.read()
        expect(state.focusSnapshot).toMatchObject({
            nodeId: 'performer-2',
            type: 'performer',
            assetLibraryOpen: true,
            assistantOpen: true,
            trackingOpen: false,
            terminalOpen: true,
        })
        expect(state.performers.find((entry) => entry.id === 'performer-2')).toMatchObject({
            hidden: false,
            width: 1000,
            height: 760,
        })
        expect(state.acts.find((entry) => entry.id === 'act-1')).toMatchObject({
            hidden: true,
            width: ACT_DEFAULT_WIDTH,
            height: ACT_DEFAULT_EXPANDED_HEIGHT,
            position: { x: 220, y: 160 },
        })
    })

    it('builds an exit patch that restores act position and side panels', () => {
        const harness = createStateHarness({
            ...createTestState(),
            acts: [{
                id: 'act-1',
                name: 'Control',
                position: { x: 220, y: 160 },
                width: ACT_DEFAULT_WIDTH,
                height: ACT_DEFAULT_EXPANDED_HEIGHT,
                participants: {},
                relations: [],
                createdAt: Date.now(),
                hidden: false,
            }],
        } as StudioState)

        enterFocusModeImpl(harness.get, harness.set, 'act-1', 'act', { width: 1000, height: 760 })

        const patch = buildExitFocusModeState(harness.read())

        expect(patch).toMatchObject({
            focusSnapshot: null,
            isAssetLibraryOpen: true,
            isAssistantOpen: true,
            isTerminalOpen: true,
        })
        expect((patch?.acts as StudioState['acts'])[0]).toMatchObject({
            id: 'act-1',
            hidden: false,
            position: { x: 220, y: 160 },
            width: ACT_DEFAULT_WIDTH,
            height: ACT_DEFAULT_EXPANDED_HEIGHT,
        })
    })

    it('exits focus mode before creating a markdown editor', () => {
        const harness = createStateHarness()
        const markdownEditorIdCounter = { value: 0 }

        enterFocusModeImpl(harness.get, harness.set, 'performer-1', 'performer', { width: 960, height: 720 })

        createMarkdownEditorImpl(
            harness.get,
            harness.set,
            markdownEditorIdCounter,
            (prefix) => `${prefix}-1`,
            'tal',
        )

        const state = harness.read()
        expect(state.focusSnapshot).toBeNull()
        expect(state.selectedMarkdownEditorId).toBe('markdown-editor-1')
        expect(state.isAssetLibraryOpen).toBe(true)
        expect(state.isAssistantOpen).toBe(true)
        expect(state.isTrackingOpen).toBe(false)
        expect(state.isTerminalOpen).toBe(true)
        expect(state.performers.find((entry) => entry.id === 'performer-1')).toMatchObject({
            hidden: false,
            width: 320,
            height: PERFORMER_DEFAULT_HEIGHT,
        })
        expect(state.markdownEditors).toHaveLength(1)
        expect(state.markdownEditors[0]).toMatchObject({
            id: 'markdown-editor-1',
            hidden: false,
        })
    })

    it('keeps the focused performer pinned to the canvas origin while syncing viewport size', () => {
        const harness = createStateHarness()

        enterFocusModeImpl(harness.get, harness.set, 'performer-1', 'performer', { width: 900, height: 700 })
        harness.set((state) => ({
            performers: state.performers.map((entry) => (
                entry.id === 'performer-1'
                    ? { ...entry, hidden: true, position: { x: 48, y: 36 }, width: 860, height: 640 }
                    : entry
            )),
        }))

        const patch = buildSyncFocusViewportState(harness.read(), { width: 960, height: 720 })

        expect((patch?.performers as StudioState['performers'])[0]).toMatchObject({
            id: 'performer-1',
            hidden: false,
            position: { x: 0, y: 0 },
            width: 960,
            height: 720,
        })
    })

    it('enters and exits empty Full View without requiring a selected node', () => {
        const harness = createStateHarness()

        enterEmptyFullViewImpl(harness.get, harness.set)

        expect(harness.read()).toMatchObject({
            viewMode: 'full',
            focusSnapshot: null,
            selectedPerformerId: null,
            selectedActId: null,
        })
        expect(harness.read().splitView.panes).toEqual([])

        exitFocusModeImpl(harness.get, harness.set)

        expect(harness.read()).toMatchObject({
            viewMode: 'canvas',
            focusSnapshot: null,
        })
    })

    it('lets empty Split View seed its first pane from a workspace-node drop', () => {
        const harness = createStateHarness()

        enterEmptySplitViewImpl(harness.get, harness.set)

        expect(harness.read()).toMatchObject({
            viewMode: 'split',
            focusSnapshot: null,
            selectedPerformerId: null,
            selectedActId: null,
        })
        expect(harness.read().splitView.panes).toEqual([])

        insertSplitViewPaneImpl(harness.get, harness.set, 'performer-1', 'performer', 0, { width: 900, height: 700 })

        const state = harness.read()
        expect(state.viewMode).toBe('split')
        expect(state.focusSnapshot).toMatchObject({
            nodeId: 'performer-1',
            type: 'performer',
        })
        expect(state.splitView.panes.map((pane) => pane.paneId)).toEqual(['performer:performer-1'])
        expect(state.performers.find((entry) => entry.id === 'performer-1')).toMatchObject({
            hidden: false,
            position: { x: 0, y: 0 },
            width: 900,
            height: 700,
        })
    })

    it('restores a focused layout before entering empty Split View', () => {
        const harness = createStateHarness()

        enterFocusModeImpl(harness.get, harness.set, 'performer-1', 'performer', { width: 900, height: 700 })
        enterEmptySplitViewImpl(harness.get, harness.set)

        const state = harness.read()
        expect(state).toMatchObject({
            viewMode: 'split',
            focusSnapshot: null,
            selectedPerformerId: null,
            selectedActId: null,
        })
        expect(state.splitView.panes).toEqual([])
        expect(state.performers.find((entry) => entry.id === 'performer-1')).toMatchObject({
            hidden: false,
            position: { x: 0, y: 0 },
            width: 320,
            height: PERFORMER_DEFAULT_HEIGHT,
        })
        expect(state.performers.find((entry) => entry.id === 'performer-2')?.hidden).toBe(false)
    })

    it('lays out selected Act and Performer panes in Split View without losing baseline sizes', () => {
        const harness = createStateHarness({
            ...createTestState(),
            selectedActId: 'act-1',
            acts: [{
                id: 'act-1',
                name: 'Control',
                position: { x: 220, y: 160 },
                width: ACT_DEFAULT_WIDTH,
                height: ACT_DEFAULT_EXPANDED_HEIGHT,
                participants: {},
                relations: [],
                createdAt: Date.now(),
                hidden: false,
            }],
        } as StudioState)

        enterSplitViewImpl(harness.get, harness.set, 'act-1', 'act', { width: 1000, height: 700 })
        addSplitViewPaneImpl(harness.get, harness.set, 'performer-1', 'performer', { width: 1000, height: 700 })

        const splitState = harness.read()
        expect(splitState.viewMode).toBe('split')
        expect(splitState.splitView.panes).toHaveLength(2)
        expect(splitState.acts.find((entry) => entry.id === 'act-1')).toMatchObject({
            hidden: false,
            position: { x: 0, y: 0 },
            width: 496,
            height: 700,
        })
        expect(splitState.performers.find((entry) => entry.id === 'performer-1')).toMatchObject({
            hidden: false,
            position: { x: 504, y: 0 },
            width: 496,
            height: 700,
        })
        expect(splitState.performers.find((entry) => entry.id === 'performer-2')?.hidden).toBe(true)

        exitFocusModeImpl(harness.get, harness.set)

        const restored = harness.read()
        expect(restored.viewMode).toBe('canvas')
        expect(restored.acts.find((entry) => entry.id === 'act-1')).toMatchObject({
            hidden: false,
            position: { x: 220, y: 160 },
            width: ACT_DEFAULT_WIDTH,
            height: ACT_DEFAULT_EXPANDED_HEIGHT,
        })
        expect(restored.performers.find((entry) => entry.id === 'performer-1')).toMatchObject({
            hidden: false,
            position: { x: 0, y: 0 },
            width: 320,
            height: PERFORMER_DEFAULT_HEIGHT,
        })
    })

    it('removes panes from Split View while staying in fullscreen split mode', () => {
        const harness = createStateHarness()

        enterSplitViewImpl(harness.get, harness.set, 'performer-1', 'performer', { width: 1000, height: 700 })
        addSplitViewPaneImpl(harness.get, harness.set, 'performer-2', 'performer', { width: 1000, height: 700 })

        removeSplitViewPaneImpl(harness.get, harness.set, 'performer:performer-1', { width: 1000, height: 700 })

        const state = harness.read()
        expect(state.viewMode).toBe('split')
        expect(state.splitView.panes.map((pane) => pane.nodeId)).toEqual(['performer-2'])
        expect(state.performers.find((entry) => entry.id === 'performer-1')?.hidden).toBe(true)
        expect(state.performers.find((entry) => entry.id === 'performer-2')).toMatchObject({
            hidden: false,
            position: { x: 0, y: 0 },
            width: 1000,
            height: 700,
        })
    })

    it('replaces a Split View pane with another workspace node', () => {
        const harness = createStateHarness({
            ...createTestState(),
            acts: [{
                id: 'act-1',
                name: 'Control',
                position: { x: 220, y: 160 },
                width: ACT_DEFAULT_WIDTH,
                height: ACT_DEFAULT_EXPANDED_HEIGHT,
                participants: {},
                relations: [],
                createdAt: Date.now(),
                hidden: false,
            }],
        } as StudioState)

        enterSplitViewImpl(harness.get, harness.set, 'performer-1', 'performer', { width: 1000, height: 700 })
        addSplitViewPaneImpl(harness.get, harness.set, 'performer-2', 'performer', { width: 1000, height: 700 })

        replaceSplitViewPaneImpl(harness.get, harness.set, 'performer:performer-2', 'act-1', 'act', { width: 1000, height: 700 })

        const state = harness.read()
        expect(state.splitView.panes.map((pane) => pane.paneId)).toEqual(['performer:performer-1', 'act:act-1'])
        expect(state.splitView.activePaneId).toBe('act:act-1')
        expect(state.selectedActId).toBe('act-1')
        expect(state.selectedPerformerId).toBeNull()
        expect(state.acts.find((entry) => entry.id === 'act-1')).toMatchObject({
            hidden: false,
            position: { x: 504, y: 0 },
            width: 496,
            height: 700,
        })
        expect(state.performers.find((entry) => entry.id === 'performer-2')?.hidden).toBe(true)
    })

    it('lays out Split View rows with independent column counts', () => {
        const harness = createStateHarness({
            ...createTestState(),
            acts: [{
                id: 'act-1',
                name: 'Control',
                position: { x: 220, y: 160 },
                width: ACT_DEFAULT_WIDTH,
                height: ACT_DEFAULT_EXPANDED_HEIGHT,
                participants: {},
                relations: [],
                createdAt: Date.now(),
                hidden: false,
            }],
        } as StudioState)

        enterSplitViewImpl(harness.get, harness.set, 'performer-1', 'performer', { width: 1000, height: 700 })
        insertSplitViewPaneImpl(
            harness.get,
            harness.set,
            'performer-2',
            'performer',
            { rowIndex: 0, columnIndex: 1, rowMode: 'existing' },
            { width: 1000, height: 700 },
        )
        insertSplitViewPaneImpl(
            harness.get,
            harness.set,
            'act-1',
            'act',
            { rowIndex: 1, columnIndex: 0, rowMode: 'new' },
            { width: 1000, height: 700 },
        )

        const state = harness.read()
        expect(state.splitView.rows).toEqual([
            ['performer:performer-1', 'performer:performer-2'],
            ['act:act-1'],
        ])

        expect(state.performers.find((entry) => entry.id === 'performer-1')).toMatchObject({
            position: { x: 0, y: 0 },
            width: 496,
            height: 346,
        })
        expect(state.performers.find((entry) => entry.id === 'performer-2')).toMatchObject({
            position: { x: 504, y: 0 },
            width: 496,
            height: 346,
        })
        expect(state.acts.find((entry) => entry.id === 'act-1')).toMatchObject({
            position: { x: 0, y: 354 },
            width: 1000,
            height: 346,
        })
    })

    it('restores saved Split View rows after switching through Canvas and empty Full View', () => {
        const harness = createStateHarness({
            ...createTestState(),
            acts: [{
                id: 'act-1',
                name: 'Control',
                position: { x: 220, y: 160 },
                width: ACT_DEFAULT_WIDTH,
                height: ACT_DEFAULT_EXPANDED_HEIGHT,
                participants: {},
                relations: [],
                createdAt: Date.now(),
                hidden: false,
            }],
        } as StudioState)

        enterSplitViewImpl(harness.get, harness.set, 'performer-1', 'performer', { width: 1000, height: 700 })
        insertSplitViewPaneImpl(
            harness.get,
            harness.set,
            'performer-2',
            'performer',
            { rowIndex: 0, columnIndex: 1, rowMode: 'existing' },
            { width: 1000, height: 700 },
        )
        insertSplitViewPaneImpl(
            harness.get,
            harness.set,
            'act-1',
            'act',
            { rowIndex: 1, columnIndex: 0, rowMode: 'new' },
            { width: 1000, height: 700 },
        )

        const savedRows = harness.read().splitView.rows
        const savedPaneIds = harness.read().splitView.panes.map((pane) => pane.paneId)

        exitFocusModeImpl(harness.get, harness.set)

        expect(harness.read()).toMatchObject({
            viewMode: 'canvas',
            focusSnapshot: null,
        })
        expect(harness.read().splitView.rows).toEqual(savedRows)
        expect(harness.read().splitView.panes.map((pane) => pane.paneId)).toEqual(savedPaneIds)

        enterEmptyFullViewImpl(harness.get, harness.set)
        enterSplitViewImpl(harness.get, harness.set, undefined, undefined, { width: 1000, height: 700 })

        const restored = harness.read()
        expect(restored.viewMode).toBe('split')
        expect(restored.splitView.rows).toEqual(savedRows)
        expect(restored.splitView.panes.map((pane) => pane.paneId)).toEqual(savedPaneIds)
        expect(restored.acts.find((entry) => entry.id === 'act-1')).toMatchObject({
            hidden: false,
            position: { x: 0, y: 354 },
            width: 1000,
            height: 346,
        })
    })

    it('resizes Split View row and column boundaries with persistent weights', () => {
        const harness = createStateHarness({
            ...createTestState(),
            acts: [{
                id: 'act-1',
                name: 'Control',
                position: { x: 220, y: 160 },
                width: ACT_DEFAULT_WIDTH,
                height: ACT_DEFAULT_EXPANDED_HEIGHT,
                participants: {},
                relations: [],
                createdAt: Date.now(),
                hidden: false,
            }],
        } as StudioState)

        enterSplitViewImpl(harness.get, harness.set, 'performer-1', 'performer', { width: 1000, height: 700 })
        insertSplitViewPaneImpl(
            harness.get,
            harness.set,
            'performer-2',
            'performer',
            { rowIndex: 0, columnIndex: 1, rowMode: 'existing' },
            { width: 1000, height: 700 },
        )
        insertSplitViewPaneImpl(
            harness.get,
            harness.set,
            'act-1',
            'act',
            { rowIndex: 1, columnIndex: 0, rowMode: 'new' },
            { width: 1000, height: 700 },
        )

        resizeSplitViewBoundaryImpl(harness.get, harness.set, 'column', 0, 0, 120, { width: 1000, height: 700 })
        resizeSplitViewBoundaryImpl(harness.get, harness.set, 'row', 0, 0, 80, { width: 1000, height: 700 })

        const resized = harness.read()
        expect(resized.splitView.rowWeights[0]).toBeGreaterThan(resized.splitView.rowWeights[1])
        expect(resized.splitView.columnWeights[0][0]).toBeGreaterThan(resized.splitView.columnWeights[0][1])
        expect(resized.performers.find((entry) => entry.id === 'performer-1')).toMatchObject({
            position: { x: 0, y: 0 },
            width: 616,
            height: 426,
        })
        expect(resized.performers.find((entry) => entry.id === 'performer-2')).toMatchObject({
            position: { x: 624, y: 0 },
            width: 376,
            height: 426,
        })
        expect(resized.acts.find((entry) => entry.id === 'act-1')).toMatchObject({
            position: { x: 0, y: 434 },
            width: 1000,
            height: 266,
        })

        exitFocusModeImpl(harness.get, harness.set)
        enterSplitViewImpl(harness.get, harness.set, undefined, undefined, { width: 1000, height: 700 })

        expect(harness.read().splitView.rowWeights).toEqual(resized.splitView.rowWeights)
        expect(harness.read().splitView.columnWeights).toEqual(resized.splitView.columnWeights)
    })

    it('derives Split View row placement from pointer position', () => {
        const panes = [createSplitViewPane('performer-1', 'performer')]
        const rightIntent = resolveSplitDropIntent({
            point: { x: 890, y: 350 },
            panes,
            viewportSize: { width: 900, height: 700 },
            columns: 1,
            canPlaceAtEdge: true,
        })

        expect(rightIntent).toMatchObject({
            direction: 'right',
            targetIndex: 1,
            placement: {
                rowIndex: 0,
                columnIndex: 1,
                rowMode: 'existing',
            },
        })

        const bottomIntent = resolveSplitDropIntent({
            point: { x: 450, y: 690 },
            panes,
            viewportSize: { width: 900, height: 700 },
            columns: 1,
            canPlaceAtEdge: true,
        })

        expect(bottomIntent).toMatchObject({
            direction: 'bottom',
            targetIndex: 1,
            placement: {
                rowIndex: 1,
                columnIndex: 0,
                rowMode: 'new',
            },
        })
    })

    it('inserts and reorders Split View panes by row placement', () => {
        const harness = createStateHarness({
            ...createTestState(),
            acts: [{
                id: 'act-1',
                name: 'Control',
                position: { x: 220, y: 160 },
                width: ACT_DEFAULT_WIDTH,
                height: ACT_DEFAULT_EXPANDED_HEIGHT,
                participants: {},
                relations: [],
                createdAt: Date.now(),
                hidden: false,
            }],
        } as StudioState)

        enterSplitViewImpl(harness.get, harness.set, 'performer-1', 'performer', { width: 1000, height: 700 })
        addSplitViewPaneImpl(harness.get, harness.set, 'performer-2', 'performer', { width: 1000, height: 700 })
        insertSplitViewPaneImpl(harness.get, harness.set, 'act-1', 'act', 1, { width: 1000, height: 700 })

        expect(harness.read().splitView.panes.map((pane) => pane.paneId)).toEqual([
            'performer:performer-1',
            'act:act-1',
            'performer:performer-2',
        ])

        moveSplitViewPaneImpl(harness.get, harness.set, 'performer:performer-2', 0, { width: 1000, height: 700 })

        const state = harness.read()
        expect(state.splitView.panes.map((pane) => pane.paneId)).toEqual([
            'performer:performer-2',
            'performer:performer-1',
            'act:act-1',
        ])
        expect(state.splitView.rows).toEqual([[
            'performer:performer-2',
            'performer:performer-1',
            'act:act-1',
        ]])
        expect(state.splitView.activePaneId).toBe('performer:performer-2')
        expect(state.performers.find((entry) => entry.id === 'performer-2')).toMatchObject({
            position: { x: 0, y: 0 },
            width: 328,
            height: 700,
        })
    })
})
