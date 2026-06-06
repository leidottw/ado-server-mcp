import { z } from "zod";
import * as CoreInterfaces from "azure-devops-node-api/interfaces/CoreInterfaces";

/**
 * Azure DevOps schema mappings derived from the installed
 * azure-devops-node-api package (v15.1.2).
 *
 * Schema definitions are based on corresponding SDK interfaces.
 */
export interface AzureDevOpsListResponse<T> {
  count?: number;
  value?: T[];
  continuationToken?: string[];
}

/**
 * Azure DevOps identity reference.
 * Derived from azure-devops-node-api interfaces/common/VSSInterfaces.d.ts - IdentityRef
 */
const identityRefSchema = z
  .object({
    _links: z.record(z.string(), z.object({ href: z.string() })).optional(),
    descriptor: z.string(),
    displayName: z.string(),
    url: z.string(),
    id: z.string(),
    imageUrl: z.string(),
    directoryAlias: z.string(),
    inactive: z.boolean(),
    isAadIdentity: z.boolean(),
    isContainer: z.boolean(),
    isDeletedInOrigin: z.boolean(),
    profileUrl: z.string(),
    uniqueName: z.string(),
  })
  .partial()
  .passthrough();

const resourceRefSchema = z
  .object({
    id: z.string(),
    url: z.string(),
  })
  .partial()
  .passthrough();

const identityRefWithVoteSchema: z.ZodSchema = identityRefSchema
  .extend({
    hasDeclined: z.boolean().optional(),
    isFlagged: z.boolean().optional(),
    isReapprove: z.boolean().optional(),
    isRequired: z.boolean().optional(),
    reviewerUrl: z.string().optional(),
    vote: z.number().optional(),
    votedFor: z.array(z.lazy(() => identityRefWithVoteSchema)).optional(),
  })
  .partial()
  .passthrough();

/**
 * Azure DevOps team.
 * Derived from azure-devops-node-api interfaces/CoreInterfaces.d.ts - WebApiTeam
 */
const webApiTeamSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    url: z.string(),
    description: z.string(),
    identity: z.record(z.string(), z.unknown()).optional(),
    identityUrl: z.string(),
    projectId: z.string(),
    projectName: z.string(),
  })
  .partial()
  .passthrough();

/**
 * Azure DevOps project reference.
 * Derived from azure-devops-node-api interfaces/CoreInterfaces.d.ts - TeamProjectReference
 */
const teamProjectReferenceSchema = z
  .object({
    abbreviation: z.string(),
    defaultTeamImageUrl: z.string(),
    description: z.string(),
    id: z.string(),
    lastUpdateTime: z.string(),
    name: z.string(),
    revision: z.number(),
    state: z.any(),
    url: z.string(),
    visibility: z.nativeEnum(CoreInterfaces.ProjectVisibility),
  })
  .partial()
  .passthrough();

/**
 * Azure DevOps repository reference.
 * Derived from azure-devops-node-api interfaces/GitInterfaces.d.ts - GitRepositoryRef
 */
const gitRepositoryRefSchema = z
  .object({
    collection: z
      .object({
        id: z.string(),
        name: z.string(),
        url: z.string(),
      })
      .optional(),
    id: z.string(),
    isFork: z.boolean(),
    name: z.string(),
    project: teamProjectReferenceSchema.optional(),
    remoteUrl: z.string(),
    sshUrl: z.string(),
    url: z.string(),
  })
  .partial()
  .passthrough();

/**
 * Azure DevOps repository.
 * Derived from azure-devops-node-api interfaces/GitInterfaces.d.ts - GitRepository
 */
const gitRepositorySchema = z
  .object({
    _links: z.any().optional(),
    creationDate: z.string(),
    defaultBranch: z.string(),
    id: z.string(),
    isDisabled: z.boolean(),
    isFork: z.boolean(),
    isInMaintenance: z.boolean(),
    name: z.string(),
    parentRepository: gitRepositoryRefSchema.optional(),
    project: teamProjectReferenceSchema.optional(),
    remoteUrl: z.string(),
    size: z.number(),
    sshUrl: z.string(),
    url: z.string(),
    validRemoteUrls: z.array(z.string()),
    webUrl: z.string(),
  })
  .partial()
  .passthrough();

/**
 * Azure DevOps pull request.
 * Derived from azure-devops-node-api interfaces/GitInterfaces.d.ts - GitPullRequest
 */
const gitPullRequestSchema = z
  .object({
    _links: z.any().optional(),
    artifactId: z.string(),
    autoCompleteSetBy: identityRefSchema.optional(),
    closedBy: identityRefSchema.optional(),
    closedDate: z.string(),
    codeReviewId: z.number(),
    commits: z.array(z.any()),
    completionOptions: z.record(z.string(), z.unknown()),
    completionQueueTime: z.string(),
    createdBy: identityRefSchema.optional(),
    creationDate: z.string(),
    description: z.string(),
    forkSource: z.any(),
    hasMultipleMergeBases: z.boolean(),
    ignoreTargetRefAndChooseDynamically: z.boolean(),
    isDraft: z.boolean(),
    labels: z.array(z.any()),
    lastMergeCommit: z.any(),
    lastMergeSourceCommit: z.any(),
    lastMergeTargetCommit: z.any(),
    mergeFailureMessage: z.string(),
    mergeFailureType: z.any(),
    mergeId: z.string(),
    mergeOptions: z.record(z.string(), z.unknown()),
    mergeStatus: z.any(),
    pullRequestId: z.number(),
    remoteUrl: z.string(),
    repository: gitRepositorySchema.optional(),
    reviewers: z.array(identityRefWithVoteSchema),
    sourceRefName: z.string(),
    status: z.any(),
    supportsIterations: z.boolean(),
    targetRefName: z.string(),
    title: z.string(),
    url: z.string(),
    workItemRefs: z.array(resourceRefSchema),
  })
  .partial()
  .passthrough();

/**
 * Azure DevOps pull request comment.
 * Derived from azure-devops-node-api interfaces/GitInterfaces.d.ts - Comment
 */
const pullRequestCommentOutputSchema = z
  .object({
    _links: z.any().optional(),
    id: z.number(),
    parentCommentId: z.number(),
    author: identityRefSchema.optional(),
    content: z.string(),
    commentType: z.number(),
    isDeleted: z.boolean(),
    lastContentUpdatedDate: z.string(),
    lastUpdatedDate: z.string(),
    publishedDate: z.string(),
    usersLiked: z.array(identityRefSchema),
  })
  .partial()
  .passthrough();

const commentPositionSchema = z
  .object({
    line: z.number(),
    offset: z.number(),
  })
  .partial()
  .passthrough();

const commentThreadContextSchema = z
  .object({
    filePath: z.string(),
    leftFileEnd: commentPositionSchema.optional(),
    leftFileStart: commentPositionSchema.optional(),
    rightFileEnd: commentPositionSchema.optional(),
    rightFileStart: commentPositionSchema.optional(),
  })
  .partial()
  .passthrough();

const commentIterationContextSchema = z
  .object({
    firstComparingIteration: z.number(),
    secondComparingIteration: z.number(),
  })
  .partial()
  .passthrough();

const gitPullRequestCommentThreadContextSchema = z
  .object({
    changeTrackingId: z.number(),
    iterationContext: commentIterationContextSchema.optional(),
    trackingCriteria: z.record(z.string(), z.unknown()).optional(),
  })
  .partial()
  .passthrough();

/**
 * Azure DevOps pull request thread.
 * Derived from azure-devops-node-api interfaces/GitInterfaces.d.ts - GitPullRequestCommentThread
 */
const pullRequestThreadOutputSchemaInternal = z
  .object({
    _links: z.any().optional(),
    id: z.number(),
    comments: z.array(pullRequestCommentOutputSchema),
    identities: z.record(z.string(), identityRefSchema),
    isDeleted: z.boolean(),
    lastUpdatedDate: z.string(),
    properties: z.record(z.string(), z.unknown()).optional(),
    publishedDate: z.string(),
    status: z.string(),
    threadContext: commentThreadContextSchema.optional().nullable(), // 這裡發現與文件不相符, 實際測試發現可能為 null, 因此加上 nullable(),
    pullRequestThreadContext: gitPullRequestCommentThreadContextSchema
      .optional()
      .nullable(), // 這裡發現與文件不相符, 實際測試發現可能為 null, 因此加上 nullable()
  })
  .partial()
  .passthrough();

/**
 * Azure DevOps work item relation.
 * Derived from azure-devops-node-api interfaces/WorkItemTrackingInterfaces.d.ts - WorkItemRelation
 */
const workItemRelationSchema = z
  .object({
    rel: z.string(),
    url: z.string(),
    attributes: z.record(z.string(), z.unknown()).optional(),
  })
  .partial()
  .passthrough();

const workItemFieldReferenceSchema = z
  .object({
    name: z.string(),
    referenceName: z.string(),
    url: z.string(),
  })
  .partial()
  .passthrough();

const workItemReferenceSchema = z
  .object({
    id: z.number(),
    url: z.string(),
  })
  .partial()
  .passthrough();

const workItemLinkSchema = z
  .object({
    rel: z.string(),
    source: workItemReferenceSchema.optional(),
    target: workItemReferenceSchema.optional(),
  })
  .partial()
  .passthrough();

const workItemQuerySortColumnSchema = z
  .object({
    descending: z.boolean(),
    field: workItemFieldReferenceSchema.optional(),
  })
  .partial()
  .passthrough();

const workItemStateColorSchema = z
  .object({
    category: z.string(),
    color: z.string(),
    name: z.string(),
  })
  .partial()
  .passthrough();

const workItemStateTransitionSchema = z
  .object({
    actions: z.array(z.string()),
    to: z.string(),
  })
  .partial()
  .passthrough();

const workItemTypeFieldInstanceBaseSchema = workItemFieldReferenceSchema
  .extend({
    alwaysRequired: z.boolean().optional(),
    dependentFields: z.array(workItemFieldReferenceSchema).optional(),
    helpText: z.string().optional(),
  })
  .partial();

const workItemTypeFieldInstanceSchema = workItemTypeFieldInstanceBaseSchema
  .extend({
    allowedValues: z.array(z.string()).optional(),
    defaultValue: z.string().optional(),
  })
  .partial();

/**
 * Azure DevOps work item comment version reference.
 * Derived from azure-devops-node-api interfaces/WorkItemTrackingInterfaces.d.ts - WorkItemCommentVersionRef
 */
const workItemCommentVersionRefSchema = z
  .object({
    commentId: z.number(),
    createdInRevision: z.number(),
    isDeleted: z.boolean(),
    text: z.string(),
    url: z.string(),
    version: z.number(),
  })
  .partial()
  .passthrough();

/**
 * Azure DevOps work item.
 * Derived from azure-devops-node-api interfaces/WorkItemTrackingInterfaces.d.ts - WorkItem
 */
const workItemSchema = z
  .object({
    id: z.number(),
    rev: z.number(),
    fields: z.record(z.string(), z.unknown()).optional(),
    relations: z.array(workItemRelationSchema).optional(),
    _links: z.record(z.string(), z.object({ href: z.string() })).optional(),
    commentVersionRef: workItemCommentVersionRefSchema.optional(),
  })
  .partial()
  .passthrough();

/**
 * Azure DevOps work item type.
 * Derived from azure-devops-node-api interfaces/WorkItemTrackingInterfaces.d.ts - WorkItemType
 */
const workItemTypeSchema = z
  .object({
    _links: z.any().optional(),
    name: z.string(),
    description: z.string(),
    icon: z.any().optional(),
    color: z.string(),
    fieldInstances: z.array(workItemTypeFieldInstanceSchema).optional(),
    fields: z.array(workItemTypeFieldInstanceSchema).optional(),
    isDisabled: z.boolean(),
    referenceName: z.string(),
    states: z.array(workItemStateColorSchema).optional(),
    transitions: z
      .record(z.string(), z.array(workItemStateTransitionSchema))
      .optional(),
    xmlForm: z.string(),
  })
  .partial()
  .passthrough();

/**
 * Azure DevOps WIQL query result.
 * Derived from azure-devops-node-api interfaces/WorkItemTrackingInterfaces.d.ts - WorkItemQueryResult
 */
const workItemQueryResultSchema = z
  .object({
    asOf: z.string(),
    columns: z.array(workItemFieldReferenceSchema).optional(),
    queryResultType: z.number(),
    queryType: z.number(),
    sortColumns: z.array(workItemQuerySortColumnSchema).optional(),
    workItemRelations: z.array(workItemLinkSchema).optional(),
    workItems: z
      .array(
        z
          .object({
            id: z.number().optional(),
            url: z.string().optional(),
          })
          .partial(),
      )
      .optional(),
    workItemDetails: z.array(workItemSchema).optional(),
  })
  .partial()
  .passthrough();

/**
 * Azure DevOps work item comment.
 * Derived from azure-devops-node-api interfaces/WorkItemTrackingInterfaces.d.ts - WorkItemComment
 */
const workItemCommentSchema = z
  .object({
    _links: z.any().optional(),
    format: z.any().optional(),
    renderedText: z.string(),
    revisedBy: identityRefSchema.optional(),
    revisedDate: z.string(),
    revision: z.number(),
    text: z.string(),
  })
  .partial()
  .passthrough();

/**
 * Projects list schema.
 * Derived from azure-devops-node-api interfaces/CoreInterfaces.d.ts
 * - WebApiProject / TeamProjectReference
 */
export const projectOutputSchema = teamProjectReferenceSchema;

/**
 * Repository schema.
 * Derived from azure-devops-node-api interfaces/GitInterfaces.d.ts
 * - GitRepository
 */
export const repositoryOutputSchema = gitRepositorySchema;

/**
 * Pull request summary schema.
 * Derived from azure-devops-node-api interfaces/GitInterfaces.d.ts
 * - GitPullRequest
 */
export const pullRequestSummaryOutputSchema = gitPullRequestSchema;

/**
 * Pull request detail schema.
 * Derived from azure-devops-node-api interfaces/GitInterfaces.d.ts
 * - GitPullRequest
 */
export const pullRequestDetailOutputSchema = gitPullRequestSchema;

/**
 * Pull request thread schema.
 * Derived from azure-devops-node-api interfaces/GitInterfaces.d.ts
 * - GitPullRequestCommentThread
 */
export const pullRequestThreadOutputSchema =
  pullRequestThreadOutputSchemaInternal;

/**
 * Pull request comment creation schema.
 * Derived from azure-devops-node-api interfaces/GitInterfaces.d.ts
 * - GitPullRequestCommentThread
 */
export const createPullRequestCommentOutputSchema =
  pullRequestThreadOutputSchemaInternal;

/**
 * Pull request creation schema.
 * Derived from azure-devops-node-api interfaces/GitInterfaces.d.ts
 * - GitPullRequest
 */
export const createPullRequestOutputSchema = gitPullRequestSchema;

/**
 * Work item create schema.
 * Derived from azure-devops-node-api interfaces/WorkItemTrackingInterfaces.d.ts
 * - WorkItem
 */
export const createWorkItemOutputSchema = workItemSchema;

/**
 * Work item update schema.
 * Derived from azure-devops-node-api interfaces/WorkItemTrackingInterfaces.d.ts
 * - WorkItem
 */
export const updateWorkItemOutputSchema = workItemSchema;

/**
 * WIQL query schema.
 * Derived from azure-devops-node-api interfaces/WorkItemTrackingInterfaces.d.ts
 * - WorkItemQueryResult
 */
export const queryWorkItemsOutputSchema = workItemQueryResultSchema;

/**
 * Project teams schema.
 * Derived from azure-devops-node-api interfaces/CoreInterfaces.d.ts
 * - WebApiTeam
 */
export const projectTeamOutputSchema = webApiTeamSchema;

/**
 * Project team member schema.
 * Derived from azure-devops-node-api interfaces/common/VSSInterfaces.d.ts
 * - TeamMember
 */
export const projectTeamMemberOutputSchema = z
  .object({
    identity: identityRefSchema.optional(),
    isTeamAdmin: z.boolean().optional(),
  })
  .partial()
  .passthrough();

/**
 * Work item get schema.
 * Derived from azure-devops-node-api interfaces/WorkItemTrackingInterfaces.d.ts
 * - WorkItem
 */
export const workItemOutputSchema = workItemSchema;

/**
 * Pull request update schema.
 * Derived from azure-devops-node-api interfaces/GitInterfaces.d.ts
 * - GitPullRequest
 */
export const updatePullRequestOutputSchema = gitPullRequestSchema;

/**
 * Work item types list schema.
 * Derived from azure-devops-node-api interfaces/WorkItemTrackingInterfaces.d.ts
 * - WorkItemType
 */
export const workItemTypesOutputSchema = z
  .object({ workItemTypes: z.array(workItemTypeSchema) })
  .passthrough();

/**
 * Work item comment creation schema.
 * Derived from azure-devops-node-api interfaces/WorkItemTrackingInterfaces.d.ts
 * - WorkItemComment
 */
export const addWorkItemCommentOutputSchema = workItemCommentSchema;

// ─── Pipeline (Build) Schemas ─────────────────────────────────────────────────

const buildDefinitionReferenceSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    path: z.string(),
    url: z.string(),
    queueStatus: z.number(),
    type: z.number(),
  })
  .partial()
  .passthrough();

const buildSchema = z
  .object({
    id: z.number(),
    buildNumber: z.string(),
    status: z.number(),
    result: z.number(),
    queueTime: z.string(),
    startTime: z.string(),
    finishTime: z.string(),
    url: z.string(),
    definition: buildDefinitionReferenceSchema,
    requestedBy: identityRefSchema,
    requestedFor: identityRefSchema,
    sourceBranch: z.string(),
    sourceVersion: z.string(),
    parameters: z.string(),
    project: teamProjectReferenceSchema,
    reason: z.number(),
  })
  .partial()
  .passthrough();

export const listPipelinesOutputSchema = z
  .object({
    project: z.string(),
    pipelines: z.array(buildDefinitionReferenceSchema),
  })
  .passthrough();

export const getPipelineRunOutputSchema = buildSchema;

export const listPipelineRunsOutputSchema = z
  .object({ runs: z.array(buildSchema) })
  .passthrough();

export const queuePipelineOutputSchema = buildSchema;

const buildLogSchema = z
  .object({
    id: z.number(),
    type: z.string(),
    url: z.string(),
    lineCount: z.number(),
    createdOn: z.string(),
    lastChangedOn: z.string(),
  })
  .partial()
  .passthrough();

export const getBuildLogsOutputSchema = z
  .object({
    logs: z.array(buildLogSchema).optional(),
    lines: z.array(z.string()).optional(),
  })
  .passthrough();

const buildRepositorySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    defaultBranch: z.string(),
    url: z.string(),
    rootFolder: z.string(),
    clean: z.string(),
    checkoutSubmodules: z.boolean(),
  })
  .partial()
  .passthrough();

const buildDefinitionVariableSchema = z
  .object({
    allowOverride: z.boolean(),
    isSecret: z.boolean(),
    value: z.string().nullable(),
  })
  .partial()
  .passthrough();

export const getPipelineDefinitionOutputSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    path: z.string(),
    url: z.string(),
    revision: z.number(),
    createdDate: z.string(),
    description: z.string(),
    buildNumberFormat: z.string(),
    jobTimeoutInMinutes: z.number(),
    tags: z.array(z.string()),
    repository: buildRepositorySchema.optional(),
    variables: z.record(z.string(), buildDefinitionVariableSchema).optional(),
    authoredBy: identityRefSchema.optional(),
  })
  .partial()
  .passthrough();

export const getPipelineDefinitionYamlOutputSchema = z
  .object({ yaml: z.string().optional() })
  .passthrough();

// ─── PR Review Schemas ─────────────────────────────────────────────────────────

export const updatePrReviewerOutputSchema = identityRefWithVoteSchema;

export const replyPrThreadCommentOutputSchema = pullRequestCommentOutputSchema;

export const updatePrThreadOutputSchema = pullRequestThreadOutputSchemaInternal;

const gitChangeSchema = z
  .object({
    changeType: z.number(),
    changeId: z.number(),
    item: z
      .object({
        path: z.string(),
        url: z.string(),
      })
      .partial()
      .passthrough()
      .optional(),
  })
  .partial()
  .passthrough();

export const getPullRequestFileChangesOutputSchema = z
  .object({ changeEntries: z.array(gitChangeSchema) })
  .passthrough();

export function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

export function ensureRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeAzureDevOpsDates<T>(value: T): T {
  if (value instanceof Date) {
    return value.toISOString() as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeAzureDevOpsDates(item)) as unknown as T;
  }

  if (typeof value === "object" && value !== null) {
    const normalized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      normalized[key] = normalizeAzureDevOpsDates(item);
    }
    return normalized as unknown as T;
  }

  return value;
}
