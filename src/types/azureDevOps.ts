import { z } from "zod";

/**
 * Azure DevOps REST API schema mappings.
 *
 * Sources are provided above each schema definition.
 */
export const SUPPORTED_API_VERSIONS = ["5.1", "6.0", "7.0", "7.1"] as const;
export type SupportedApiVersion = (typeof SUPPORTED_API_VERSIONS)[number];

export interface AzureDevOpsListResponse<T> {
  count?: number;
  value?: T[];
  continuationToken?: string[];
}

/**
 * Projects list schema.
 * Sources:
 * - 5.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/core/projects/list?view=azure-devops-rest-5.1
 * - 6.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/core/projects/list?view=azure-devops-rest-6.0
 * - 7.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/core/projects/list?view=azure-devops-rest-7.0
 * - 7.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/core/projects/list?view=azure-devops-rest-7.1
 */
export const projectOutputSchemaByVersion = {
  "5.1": z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    description: z.string().nullable(),
    url: z.string().nullable(),
    state: z.string().nullable(),
  }),
  "6.0": z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    description: z.string().nullable(),
    url: z.string().nullable(),
    state: z.string().nullable(),
    visibility: z.string().nullable(),
  }),
  "7.0": z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    description: z.string().nullable(),
    abbreviation: z.string().nullable(),
    url: z.string().nullable(),
    state: z.string().nullable(),
    visibility: z.string().nullable(),
    revision: z.number().nullable(),
    defaultTeamImageUrl: z.string().nullable(),
    lastUpdateTime: z.string().nullable(),
    defaultTeam: z
      .object({
        id: z.string().nullable(),
        name: z.string().nullable(),
        url: z.string().nullable(),
      })
      .nullable(),
  }),
  "7.1": z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    description: z.string().nullable(),
    abbreviation: z.string().nullable(),
    url: z.string().nullable(),
    state: z.string().nullable(),
    visibility: z.string().nullable(),
    revision: z.number().nullable(),
    defaultTeamImageUrl: z.string().nullable(),
    lastUpdateTime: z.string().nullable(),
    defaultTeam: z
      .object({
        id: z.string().nullable(),
        name: z.string().nullable(),
        url: z.string().nullable(),
      })
      .nullable(),
  }),
} as const;

/**
 * Repository schema.
 * Sources:
 * - 5.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/repositories/list?view=azure-devops-rest-5.1
 * - 6.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/repositories/list?view=azure-devops-rest-6.0
 * - 7.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/repositories/list?view=azure-devops-rest-7.0
 * - 7.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/repositories/list?view=azure-devops-rest-7.1
 */
export const repositoryOutputSchemaByVersion = {
  "5.1": z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    url: z.string().nullable(),
    defaultBranch: z.string().nullable(),
  }),
  "6.0": z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    url: z.string().nullable(),
    defaultBranch: z.string().nullable(),
    remoteUrl: z.string().nullable(),
  }),
  "7.0": z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    url: z.string().nullable(),
    defaultBranch: z.string().nullable(),
    remoteUrl: z.string().nullable(),
    sshUrl: z.string().nullable(),
    projectId: z.string().nullable(),
    projectName: z.string().nullable(),
  }),
  "7.1": z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    url: z.string().nullable(),
    defaultBranch: z.string().nullable(),
    remoteUrl: z.string().nullable(),
    sshUrl: z.string().nullable(),
    projectId: z.string().nullable(),
    projectName: z.string().nullable(),
  }),
} as const;

/**
 * Pull request summary schema.
 * This is a normalized subset derived from the Git Pull Request list response.
 * Sources:
 * - 5.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get-pull-requests-by-project?view=azure-devops-rest-5.1
 * - 6.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get-pull-requests-by-project?view=azure-devops-rest-6.0
 * - 7.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get-pull-requests-by-project?view=azure-devops-rest-7.0
 * - 7.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get-pull-requests-by-project?view=azure-devops-rest-7.1
 */
export const pullRequestSummaryOutputSchemaByVersion = {
  "5.1": z.object({
    pullRequestId: z.number().nullable(),
    repositoryId: z.string().nullable(),
    title: z.string().nullable(),
    status: z.string().nullable(),
    createdBy: z.string().nullable(),
    url: z.string().nullable(),
  }),
  "6.0": z.object({
    pullRequestId: z.number().nullable(),
    repositoryId: z.string().nullable(),
    title: z.string().nullable(),
    status: z.string().nullable(),
    sourceRefName: z.string().nullable(),
    targetRefName: z.string().nullable(),
    createdBy: z.string().nullable(),
    url: z.string().nullable(),
  }),
  "7.0": z.object({
    pullRequestId: z.number().nullable(),
    repositoryId: z.string().nullable(),
    title: z.string().nullable(),
    status: z.string().nullable(),
    sourceRefName: z.string().nullable(),
    targetRefName: z.string().nullable(),
    creationDate: z.string().nullable(),
    mergeStatus: z.string().nullable(),
    createdBy: z.string().nullable(),
    url: z.string().nullable(),
  }),
  "7.1": z.object({
    pullRequestId: z.number().nullable(),
    repositoryId: z.string().nullable(),
    title: z.string().nullable(),
    status: z.string().nullable(),
    sourceRefName: z.string().nullable(),
    targetRefName: z.string().nullable(),
    creationDate: z.string().nullable(),
    mergeStatus: z.string().nullable(),
    createdBy: z.string().nullable(),
    url: z.string().nullable(),
  }),
} as const;

const pullRequestCommentOutputSchema = z
  .object({
    id: z.number().nullable(),
    parentCommentId: z.number().nullable(),
    author: z
      .object({
        id: z.string().nullable(),
        displayName: z.string().nullable(),
        uniqueName: z.string().nullable(),
        url: z.string().nullable(),
      })
      .nullable(),
    content: z.string().nullable(),
    commentType: z.number().nullable(),
    isDeleted: z.boolean().nullable(),
    publishedDate: z.string().nullable(),
    lastUpdatedDate: z.string().nullable(),
    url: z.string().nullable(),
  })
  .passthrough();

const pullRequestReviewerOutputSchema = z
  .object({
    id: z.string().nullable(),
    displayName: z.string().nullable(),
    uniqueName: z.string().nullable(),
    url: z.string().nullable(),
  })
  .passthrough();

/**
 * Pull request detail schema.
 * This is a normalized subset derived from the Git Pull Request response.
 * Sources:
 * - 5.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get?view=azure-devops-rest-5.1
 * - 6.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get?view=azure-devops-rest-6.0
 * - 7.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get?view=azure-devops-rest-7.0
 * - 7.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get?view=azure-devops-rest-7.1
 */
export const pullRequestDetailOutputSchemaByVersion = {
  "5.1": z
    .object({
      pullRequestId: z.number().nullable(),
      title: z.string().nullable(),
      description: z.string().nullable(),
      status: z.string().nullable(),
      sourceRefName: z.string().nullable(),
      targetRefName: z.string().nullable(),
      creationDate: z.string().nullable(),
      mergeStatus: z.string().nullable(),
      url: z.string().nullable(),
      repository: z
        .object({
          id: z.string().nullable(),
          name: z.string().nullable(),
          url: z.string().nullable(),
        })
        .nullable(),
      createdBy: z
        .object({
          id: z.string().nullable(),
          displayName: z.string().nullable(),
          uniqueName: z.string().nullable(),
          url: z.string().nullable(),
        })
        .nullable(),
      reviewers: z.array(pullRequestReviewerOutputSchema).nullable(),
    })
    .passthrough(),
  "6.0": z
    .object({
      pullRequestId: z.number().nullable(),
      title: z.string().nullable(),
      description: z.string().nullable(),
      status: z.string().nullable(),
      sourceRefName: z.string().nullable(),
      targetRefName: z.string().nullable(),
      creationDate: z.string().nullable(),
      mergeStatus: z.string().nullable(),
      url: z.string().nullable(),
      repository: z
        .object({
          id: z.string().nullable(),
          name: z.string().nullable(),
          url: z.string().nullable(),
        })
        .nullable(),
      createdBy: z
        .object({
          id: z.string().nullable(),
          displayName: z.string().nullable(),
          uniqueName: z.string().nullable(),
          url: z.string().nullable(),
        })
        .nullable(),
      reviewers: z.array(pullRequestReviewerOutputSchema).nullable(),
    })
    .passthrough(),
  "7.0": z
    .object({
      pullRequestId: z.number().nullable(),
      title: z.string().nullable(),
      description: z.string().nullable(),
      status: z.string().nullable(),
      sourceRefName: z.string().nullable(),
      targetRefName: z.string().nullable(),
      creationDate: z.string().nullable(),
      mergeStatus: z.string().nullable(),
      url: z.string().nullable(),
      repository: z
        .object({
          id: z.string().nullable(),
          name: z.string().nullable(),
          url: z.string().nullable(),
        })
        .nullable(),
      createdBy: z
        .object({
          id: z.string().nullable(),
          displayName: z.string().nullable(),
          uniqueName: z.string().nullable(),
          url: z.string().nullable(),
        })
        .nullable(),
      reviewers: z.array(pullRequestReviewerOutputSchema).nullable(),
    })
    .passthrough(),
  "7.1": z
    .object({
      pullRequestId: z.number().nullable(),
      title: z.string().nullable(),
      description: z.string().nullable(),
      status: z.string().nullable(),
      sourceRefName: z.string().nullable(),
      targetRefName: z.string().nullable(),
      creationDate: z.string().nullable(),
      mergeStatus: z.string().nullable(),
      url: z.string().nullable(),
      repository: z
        .object({
          id: z.string().nullable(),
          name: z.string().nullable(),
          url: z.string().nullable(),
        })
        .nullable(),
      createdBy: z
        .object({
          id: z.string().nullable(),
          displayName: z.string().nullable(),
          uniqueName: z.string().nullable(),
          url: z.string().nullable(),
        })
        .nullable(),
      reviewers: z.array(pullRequestReviewerOutputSchema).nullable(),
    })
    .passthrough(),
} as const;

/**
 * Pull request thread schema.
 * Sources:
 * - 5.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/list?view=azure-devops-rest-5.1
 * - 6.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/list?view=azure-devops-rest-6.0
 * - 7.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/list?view=azure-devops-rest-7.0
 * - 7.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/list?view=azure-devops-rest-7.1
 */
export const pullRequestThreadOutputSchemaByVersion = {
  "5.1": z
    .object({
      id: z.number().nullable(),
      status: z.string().nullable(),
      threadContext: z.record(z.string(), z.unknown()).optional(),
      comments: z.array(pullRequestCommentOutputSchema),
      properties: z.record(z.string(), z.unknown()).optional(),
      url: z.string().nullable(),
    })
    .passthrough(),
  "6.0": z
    .object({
      id: z.number().nullable(),
      status: z.string().nullable(),
      threadContext: z.record(z.string(), z.unknown()).optional(),
      comments: z.array(pullRequestCommentOutputSchema),
      properties: z.record(z.string(), z.unknown()).optional(),
      url: z.string().nullable(),
    })
    .passthrough(),
  "7.0": z
    .object({
      id: z.number().nullable(),
      status: z.string().nullable(),
      threadContext: z.record(z.string(), z.unknown()).optional(),
      comments: z.array(pullRequestCommentOutputSchema),
      properties: z.record(z.string(), z.unknown()).optional(),
      url: z.string().nullable(),
    })
    .passthrough(),
  "7.1": z
    .object({
      id: z.number().nullable(),
      status: z.string().nullable(),
      threadContext: z.record(z.string(), z.unknown()).optional(),
      comments: z.array(pullRequestCommentOutputSchema),
      properties: z.record(z.string(), z.unknown()).optional(),
      url: z.string().nullable(),
    })
    .passthrough(),
} as const;

/**
 * Pull request comment creation schema.
 * Sources:
 * - 5.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/create?view=azure-devops-rest-5.1
 * - 6.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/create?view=azure-devops-rest-6.0
 * - 7.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/create?view=azure-devops-rest-7.0
 * - 7.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/create?view=azure-devops-rest-7.1
 */
export const createPullRequestCommentOutputSchemaByVersion = {
  "5.1": z.object({
    threadId: z.number().nullable(),
    comments: z.array(pullRequestCommentOutputSchema),
  }),
  "6.0": z.object({
    threadId: z.number().nullable(),
    comments: z.array(pullRequestCommentOutputSchema),
  }),
  "7.0": z.object({
    threadId: z.number().nullable(),
    comments: z.array(pullRequestCommentOutputSchema),
  }),
  "7.1": z.object({
    threadId: z.number().nullable(),
    comments: z.array(pullRequestCommentOutputSchema),
  }),
} as const;

/**
 * Pull request creation schema.
 * This is a normalized subset derived from the create pull request response.
 * Sources:
 * - 5.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/create?view=azure-devops-rest-5.1
 * - 6.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/create?view=azure-devops-rest-6.0
 * - 7.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/create?view=azure-devops-rest-7.0
 * - 7.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/create?view=azure-devops-rest-7.1
 */
export const createPullRequestOutputSchemaByVersion = {
  "5.1": z.object({
    pullRequestId: z.number().nullable(),
    url: z.string().nullable(),
  }),
  "6.0": z.object({
    pullRequestId: z.number().nullable(),
    url: z.string().nullable(),
  }),
  "7.0": z.object({
    pullRequestId: z.number().nullable(),
    url: z.string().nullable(),
  }),
  "7.1": z.object({
    pullRequestId: z.number().nullable(),
    url: z.string().nullable(),
  }),
} as const;

/**
 * Work item create schema.
 * Sources:
 * - 5.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/create?view=azure-devops-rest-5.1
 * - 6.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/create?view=azure-devops-rest-6.0
 * - 7.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/create?view=azure-devops-rest-7.0
 * - 7.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/create?view=azure-devops-rest-7.1
 */
export const createWorkItemOutputSchemaByVersion = {
  "5.1": z.object({
    id: z.number().nullable(),
    rev: z.number().nullable(),
    url: z.string().nullable(),
    fields: z.record(z.string(), z.unknown()),
  }),
  "6.0": z.object({
    id: z.number().nullable(),
    rev: z.number().nullable(),
    url: z.string().nullable(),
    fields: z.record(z.string(), z.unknown()),
  }),
  "7.0": z.object({
    id: z.number().nullable(),
    rev: z.number().nullable(),
    url: z.string().nullable(),
    fields: z.record(z.string(), z.unknown()),
  }),
  "7.1": z.object({
    id: z.number().nullable(),
    rev: z.number().nullable(),
    url: z.string().nullable(),
    fields: z.record(z.string(), z.unknown()),
  }),
} as const;

/**
 * Work item update schema.
 * Sources:
 * - 5.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/update?view=azure-devops-rest-5.1
 * - 6.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/update?view=azure-devops-rest-6.0
 * - 7.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/update?view=azure-devops-rest-7.0
 * - 7.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/update?view=azure-devops-rest-7.1
 */
export const updateWorkItemOutputSchemaByVersion = {
  "5.1": z.object({
    id: z.number().nullable(),
    rev: z.number().nullable(),
    state: z.string().nullable(),
    fields: z.record(z.string(), z.unknown()),
    url: z.string().nullable(),
  }),
  "6.0": z.object({
    id: z.number().nullable(),
    rev: z.number().nullable(),
    state: z.string().nullable(),
    fields: z.record(z.string(), z.unknown()),
    url: z.string().nullable(),
  }),
  "7.0": z.object({
    id: z.number().nullable(),
    rev: z.number().nullable(),
    state: z.string().nullable(),
    fields: z.record(z.string(), z.unknown()),
    url: z.string().nullable(),
  }),
  "7.1": z.object({
    id: z.number().nullable(),
    rev: z.number().nullable(),
    state: z.string().nullable(),
    fields: z.record(z.string(), z.unknown()),
    url: z.string().nullable(),
  }),
} as const;

/**
 * WIQL query schema.
 * Sources:
 * - 5.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/wiql/query-by-wiql?view=azure-devops-rest-5.1
 * - 6.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/wiql/query-by-wiql?view=azure-devops-rest-6.0
 * - 7.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/wiql/query-by-wiql?view=azure-devops-rest-7.0
 * - 7.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/wiql/query-by-wiql?view=azure-devops-rest-7.1
 */
export const queryWorkItemsOutputSchemaByVersion = {
  "5.1": z.object({
    query: z.string(),
    queryResultUrl: z.string().nullable(),
    workItems: z.array(
      z.object({
        id: z.number().nullable(),
        url: z.string().nullable(),
      }),
    ),
  }),
  "6.0": z.object({
    query: z.string(),
    queryResultUrl: z.string().nullable(),
    workItems: z.array(
      z.object({
        id: z.number().nullable(),
        url: z.string().nullable(),
      }),
    ),
  }),
  "7.0": z.object({
    query: z.string(),
    queryResultUrl: z.string().nullable(),
    workItems: z.array(
      z.object({
        id: z.number().nullable(),
        url: z.string().nullable(),
      }),
    ),
  }),
  "7.1": z.object({
    query: z.string(),
    queryResultUrl: z.string().nullable(),
    workItems: z.array(
      z.object({
        id: z.number().nullable(),
        url: z.string().nullable(),
      }),
    ),
  }),
} as const;

/**
 * Project teams schema.
 * Sources:
 * - 5.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/core/teams/list?view=azure-devops-rest-5.1
 * - 6.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/core/teams/list?view=azure-devops-rest-6.0
 * - 7.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/core/teams/list?view=azure-devops-rest-7.0
 * - 7.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/core/teams/list?view=azure-devops-rest-7.1
 */
export const projectTeamOutputSchemaByVersion = {
  "5.1": z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    description: z.string().nullable(),
    url: z.string().nullable(),
    identityUrl: z.string().nullable(),
    projectId: z.string().nullable(),
    projectName: z.string().nullable(),
    isDeleted: z.boolean().nullable(),
  }),
  "6.0": z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    description: z.string().nullable(),
    url: z.string().nullable(),
    identityUrl: z.string().nullable(),
    projectId: z.string().nullable(),
    projectName: z.string().nullable(),
    isDeleted: z.boolean().nullable(),
  }),
  "7.0": z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    description: z.string().nullable(),
    url: z.string().nullable(),
    identityUrl: z.string().nullable(),
    projectId: z.string().nullable(),
    projectName: z.string().nullable(),
    isDeleted: z.boolean().nullable(),
  }),
  "7.1": z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    description: z.string().nullable(),
    url: z.string().nullable(),
    identityUrl: z.string().nullable(),
    projectId: z.string().nullable(),
    projectName: z.string().nullable(),
    isDeleted: z.boolean().nullable(),
  }),
} as const;

/**
 * Project team member schema.
 * Sources:
 * - 5.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/core/teams/get-team-members?view=azure-devops-rest-5.1
 * - 6.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/core/teams/get-team-members?view=azure-devops-rest-6.0
 * - 7.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/core/teams/get-team-members?view=azure-devops-rest-7.0
 * - 7.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/core/teams/get-team-members?view=azure-devops-rest-7.1
 */
export const projectTeamMemberOutputSchemaByVersion = {
  "5.1": z.object({
    id: z.string().nullable(),
    displayName: z.string().nullable(),
    uniqueName: z.string().nullable(),
    url: z.string().nullable(),
    imageUrl: z.string().nullable(),
    descriptor: z.string().nullable(),
  }),
  "6.0": z.object({
    id: z.string().nullable(),
    displayName: z.string().nullable(),
    uniqueName: z.string().nullable(),
    url: z.string().nullable(),
    imageUrl: z.string().nullable(),
    descriptor: z.string().nullable(),
  }),
  "7.0": z.object({
    id: z.string().nullable(),
    displayName: z.string().nullable(),
    uniqueName: z.string().nullable(),
    url: z.string().nullable(),
    imageUrl: z.string().nullable(),
    descriptor: z.string().nullable(),
  }),
  "7.1": z.object({
    id: z.string().nullable(),
    displayName: z.string().nullable(),
    uniqueName: z.string().nullable(),
    url: z.string().nullable(),
    imageUrl: z.string().nullable(),
    descriptor: z.string().nullable(),
  }),
} as const;

/**
 * Work item get schema.
 * This is a normalized subset derived from the work item get response.
 * It includes title/state/assignedTo values extracted from the fields payload.
 * Sources:
 * - 5.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get-work-item?view=azure-devops-rest-5.1
 * - 6.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get-work-item?view=azure-devops-rest-6.0
 * - 7.0: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get-work-item?view=azure-devops-rest-7.0
 * - 7.1: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get-work-item?view=azure-devops-rest-7.1
 */
export const workItemOutputSchemaByVersion = {
  "5.1": z.object({
    id: z.number().nullable(),
    rev: z.number().nullable(),
    title: z.string().nullable(),
    state: z.string().nullable(),
    assignedTo: z.string().nullable(),
    fields: z.record(z.string(), z.unknown()),
    relations: z.array(
      z.object({
        rel: z.string().nullable(),
        url: z.string().nullable(),
        attributes: z.record(z.string(), z.unknown()).nullable(),
      }),
    ),
    _links: z
      .record(z.string(), z.object({ href: z.string().nullable() }))
      .nullable(),
    commentVersionRef: z
      .object({
        commentId: z.number().nullable(),
        createdInRevision: z.number().nullable(),
        isDeleted: z.boolean().nullable(),
        text: z.string().nullable(),
        url: z.string().nullable(),
        version: z.number().nullable(),
      })
      .nullable(),
    url: z.string().nullable(),
  }),
  "6.0": z.object({
    id: z.number().nullable(),
    rev: z.number().nullable(),
    title: z.string().nullable(),
    state: z.string().nullable(),
    assignedTo: z.string().nullable(),
    fields: z.record(z.string(), z.unknown()),
    relations: z.array(
      z.object({
        rel: z.string().nullable(),
        url: z.string().nullable(),
        attributes: z.record(z.string(), z.unknown()).nullable(),
      }),
    ),
    _links: z
      .record(z.string(), z.object({ href: z.string().nullable() }))
      .nullable(),
    commentVersionRef: z
      .object({
        commentId: z.number().nullable(),
        createdInRevision: z.number().nullable(),
        isDeleted: z.boolean().nullable(),
        text: z.string().nullable(),
        url: z.string().nullable(),
        version: z.number().nullable(),
      })
      .nullable(),
    url: z.string().nullable(),
  }),
  "7.0": z.object({
    id: z.number().nullable(),
    rev: z.number().nullable(),
    title: z.string().nullable(),
    state: z.string().nullable(),
    assignedTo: z.string().nullable(),
    fields: z.record(z.string(), z.unknown()),
    relations: z.array(
      z.object({
        rel: z.string().nullable(),
        url: z.string().nullable(),
        attributes: z.record(z.string(), z.unknown()).nullable(),
      }),
    ),
    _links: z
      .record(z.string(), z.object({ href: z.string().nullable() }))
      .nullable(),
    commentVersionRef: z
      .object({
        commentId: z.number().nullable(),
        createdInRevision: z.number().nullable(),
        isDeleted: z.boolean().nullable(),
        text: z.string().nullable(),
        url: z.string().nullable(),
        version: z.number().nullable(),
      })
      .nullable(),
    url: z.string().nullable(),
  }),
  "7.1": z.object({
    id: z.number().nullable(),
    rev: z.number().nullable(),
    title: z.string().nullable(),
    state: z.string().nullable(),
    assignedTo: z.string().nullable(),
    fields: z.record(z.string(), z.unknown()),
    relations: z.array(
      z.object({
        rel: z.string().nullable(),
        url: z.string().nullable(),
        attributes: z.record(z.string(), z.unknown()).nullable(),
      }),
    ),
    _links: z
      .record(z.string(), z.object({ href: z.string().nullable() }))
      .nullable(),
    commentVersionRef: z
      .object({
        commentId: z.number().nullable(),
        createdInRevision: z.number().nullable(),
        isDeleted: z.boolean().nullable(),
        text: z.string().nullable(),
        url: z.string().nullable(),
        version: z.number().nullable(),
      })
      .nullable(),
    url: z.string().nullable(),
  }),
} as const;

export type AzureDevOpsProjectV51 = z.infer<
  (typeof projectOutputSchemaByVersion)["5.1"]
>;
export type AzureDevOpsProjectV71 = z.infer<
  (typeof projectOutputSchemaByVersion)["7.1"]
>;
export type AzureDevOpsRepositoryV51 = z.infer<
  (typeof repositoryOutputSchemaByVersion)["5.1"]
>;
export type AzureDevOpsRepositoryV71 = z.infer<
  (typeof repositoryOutputSchemaByVersion)["7.1"]
>;
export type AzureDevOpsPullRequestSummaryV51 = z.infer<
  (typeof pullRequestSummaryOutputSchemaByVersion)["5.1"]
>;
export type AzureDevOpsPullRequestSummaryV71 = z.infer<
  (typeof pullRequestSummaryOutputSchemaByVersion)["7.1"]
>;
export type AzureDevOpsWorkItemV51 = z.infer<
  (typeof workItemOutputSchemaByVersion)["5.1"]
>;
export type AzureDevOpsWorkItemV71 = z.infer<
  (typeof workItemOutputSchemaByVersion)["7.1"]
>;

export interface AzureDevOpsTeam {
  id?: string;
  name?: string;
  description?: string;
  url?: string;
  identityUrl?: string;
  projectId?: string;
  projectName?: string;
  isDeleted?: boolean;
}

export interface AzureDevOpsTeamReference {
  id?: string;
  name?: string;
  url?: string;
}

export interface AzureDevOpsProject {
  id?: string;
  name?: string;
  description?: string;
  abbreviation?: string;
  url?: string;
  state?: string;
  visibility?: string;
  revision?: number;
  defaultTeamImageUrl?: string;
  lastUpdateTime?: string;
  defaultTeam?: AzureDevOpsTeamReference;
}

export interface AzureDevOpsTeam {
  id?: string;
  name?: string;
  description?: string;
  url?: string;
  identityUrl?: string;
  projectId?: string;
  projectName?: string;
  isDeleted?: boolean;
}

export interface AzureDevOpsTeamMember {
  id?: string;
  displayName?: string;
  uniqueName?: string;
  url?: string;
  imageUrl?: string;
  descriptor?: string;
  identity?: AzureDevOpsIdentityRef;
  _links?: AzureDevOpsReferenceLinks;
}

export interface AzureDevOpsReferenceLinks {
  [rel: string]: {
    href?: string;
  };
}

export interface AzureDevOpsIdentityRef {
  id?: string;
  displayName?: string;
  uniqueName?: string;
  url?: string;
  imageUrl?: string;
  descriptor?: string;
  _links?: AzureDevOpsReferenceLinks;
}

export interface AzureDevOpsRepositoryRef {
  id?: string;
  name?: string;
  url?: string;
  remoteUrl?: string;
  sshUrl?: string;
  project?: AzureDevOpsProject;
  isFork?: boolean;
  parentRepository?: AzureDevOpsRepositoryRef;
  validRemoteUrls?: string[];
  _links?: AzureDevOpsReferenceLinks;
}

export interface AzureDevOpsRepository {
  id?: string;
  name?: string;
  url?: string;
  project?: AzureDevOpsProject;
  defaultBranch?: string;
  remoteUrl?: string;
  sshUrl?: string;
  webUrl?: string;
  isFork?: boolean;
  parentRepository?: AzureDevOpsRepositoryRef;
  validRemoteUrls?: string[];
  _links?: AzureDevOpsReferenceLinks;
}

export interface AzureDevOpsPullRequestSummary {
  pullRequestId?: number;
  title?: string;
  description?: string;
  status?: string;
  sourceRefName?: string;
  targetRefName?: string;
  creationDate?: string;
  mergeStatus?: string;
  repository?: AzureDevOpsRepositoryRef;
  createdBy?: AzureDevOpsIdentityRef;
  url?: string;
}

export interface AzureDevOpsPullRequestDetail extends AzureDevOpsPullRequestSummary {
  reviewers?: AzureDevOpsIdentityRef[];
  completionOptions?: Record<string, unknown>;
  mergeOptions?: Record<string, unknown>;
  lastMergeSourceCommit?: Record<string, unknown>;
  lastMergeTargetCommit?: Record<string, unknown>;
  lastMergeCommit?: Record<string, unknown>;
}

export interface AzureDevOpsComment {
  id?: number;
  parentCommentId?: number;
  author?: AzureDevOpsIdentityRef;
  content?: string;
  commentType?: number;
  isDeleted?: boolean;
  publishedDate?: string;
  lastUpdatedDate?: string;
  url?: string;
  _links?: AzureDevOpsReferenceLinks;
}

export interface AzureDevOpsCommentThread {
  id?: number;
  status?: string;
  threadContext?: Record<string, unknown>;
  comments?: AzureDevOpsComment[];
  properties?: Record<string, unknown>;
  url?: string;
  _links?: AzureDevOpsReferenceLinks;
}

export interface AzureDevOpsWorkItemRelation {
  rel?: string;
  url?: string;
  attributes?: Record<string, unknown>;
}

export interface AzureDevOpsWorkItemCommentVersionRef {
  commentId?: number;
  createdInRevision?: number;
  isDeleted?: boolean;
  text?: string;
  url?: string;
  version?: number;
}

export interface AzureDevOpsWorkItem {
  id?: number;
  rev?: number;
  fields?: Record<string, unknown>;
  relations?: AzureDevOpsWorkItemRelation[];
  _links?: AzureDevOpsReferenceLinks;
  url?: string;
  commentVersionRef?: AzureDevOpsWorkItemCommentVersionRef;
}

export interface AzureDevOpsWiqlResult {
  queryType?: string;
  queryResultType?: number;
  asOf?: string;
  columns?: Array<{
    referenceName?: string;
    name?: string;
    url?: string;
  }>;
  workItems?: Array<{
    id?: number;
    url?: string;
  }>;
  queryResultUrl?: string;
}

export function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

export function ensureRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}
