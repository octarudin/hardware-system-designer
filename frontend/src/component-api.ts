import type {
  ComponentDraft,
  ComponentListQuery,
  ComponentListResponse,
  ComponentReviewQueueResponse,
  ComponentRevisionResponse,
  PublishComponentRequest,
  ReviewComponentRequest,
} from '@hwsd/shared';

import { apiRequest } from './auth-api.js';

function queryString(query: ComponentListQuery): string {
  const values = Object.entries(query).filter((entry): entry is [string, string | number] =>
    ['string', 'number'].includes(typeof entry[1]),
  );
  const parameters = new URLSearchParams(values.map(([key, value]) => [key, String(value)]));
  return parameters.size ? `?${parameters}` : '';
}

export const componentApi = {
  list: (query: ComponentListQuery = {}) =>
    apiRequest<ComponentListResponse>(`/components${queryString(query)}`),
  revision: (componentId: string, revision: number) =>
    apiRequest<ComponentRevisionResponse>(`/components/${componentId}/revisions/${revision}`),
  create: (definition: ComponentDraft) =>
    apiRequest<ComponentRevisionResponse>('/components', {
      method: 'POST',
      body: JSON.stringify({ definition } satisfies PublishComponentRequest),
    }),
  revise: (componentId: string, definition: ComponentDraft) =>
    apiRequest<ComponentRevisionResponse>(`/components/${componentId}/revisions`, {
      method: 'POST',
      body: JSON.stringify({ definition } satisfies PublishComponentRequest),
    }),
  reviewQueue: () => apiRequest<ComponentReviewQueueResponse>('/admin/component-reviews'),
  review: (componentId: string, revision: number, review: ReviewComponentRequest) =>
    apiRequest<ComponentRevisionResponse>(
      `/admin/component-reviews/${componentId}/${revision}/actions`,
      { method: 'POST', body: JSON.stringify(review) },
    ),
};
