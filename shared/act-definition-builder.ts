import type { ActDefinition, ActRelation, ParticipantSubscriptions } from './act-types.js'
import type { SharedAssetRef } from './chat-contracts.js'

export type ActDefinitionPerformerInput = {
    id: string
    name?: string
    meta?: {
        derivedFrom?: string | null
        authoring?: {
            description?: string
        }
    }
}

export type ActDefinitionParticipantBindingInput = {
    performerRef: SharedAssetRef
    displayName?: string
    subscriptions?: ParticipantSubscriptions
    description?: string
}

export type ActDefinitionWorkspaceInput = {
    id: string
    name: string
    description?: string
    actRules?: string[]
    participants: Record<string, ActDefinitionParticipantBindingInput>
    relations: ActRelation[]
    safety?: ActDefinition['safety']
}

export function resolvePerformerFromActBindingInput(
    performers: ActDefinitionPerformerInput[],
    binding: ActDefinitionParticipantBindingInput | null | undefined,
) {
    if (!binding) return null
    const ref = binding.performerRef
    return ref.kind === 'draft'
        ? performers.find((performer) =>
            performer.id === ref.draftId
            || performer.meta?.derivedFrom === `draft:${ref.draftId}`,
        ) || null
        : performers.find((performer) => performer.meta?.derivedFrom === ref.urn) || null
}

function normalizeSubscriptions<T extends Record<string, unknown> | null | undefined>(subscriptions: T): T {
    if (!subscriptions || typeof subscriptions !== 'object') return subscriptions
    const callboardKeys = Array.isArray(subscriptions.callboardKeys) ? subscriptions.callboardKeys : undefined
    return {
        ...subscriptions,
        ...(callboardKeys ? { callboardKeys } : {}),
    } as T
}

function resolveParticipantDescription(
    binding: ActDefinitionParticipantBindingInput,
    performers: ActDefinitionPerformerInput[],
) {
    const explicit = binding.description?.trim()
    if (explicit) return explicit
    const performer = resolvePerformerFromActBindingInput(performers, binding)
    const description = performer?.meta?.authoring?.description?.trim()
    return description ? description : undefined
}

export function buildActDefinition(
    act: ActDefinitionWorkspaceInput,
    performers: ActDefinitionPerformerInput[] = [],
): ActDefinition {
    return {
        id: act.id,
        name: act.name,
        description: act.description,
        actRules: act.actRules,
        participants: Object.fromEntries(
            Object.entries(act.participants).map(([key, binding]) => [key, {
                performerRef: binding.performerRef,
                displayName: binding.displayName,
                description: resolveParticipantDescription(binding, performers),
                subscriptions: normalizeSubscriptions(binding.subscriptions),
            }]),
        ),
        relations: act.relations,
        safety: act.safety,
    }
}
