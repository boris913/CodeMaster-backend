// src/comments/types/comment.types.ts
import { Comment, User } from '@prisma/client';

export interface CommentWithRelations extends Comment {
  user: Partial<User>;
  replies?: CommentWithRelations[];
  _count?: {
    replies: number;
  };
}

export interface PaginatedComments {
  data: CommentWithRelations[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CommentFilters {
  page?: number;
  limit?: number;
  orderBy?: 'newest' | 'oldest' | 'mostReplies';
  includeReplies?: boolean;
}
