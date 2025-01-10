import { Int8 } from "../../db/types";
import { z } from "zod";

export const SearchAttachmentSchema = z.object({
    id: z.string(),
    filename: z.string(),
    fileKey: z.string(),
    mimeType: z.string(),
    size: z.string(),
    createdAt: z.string(),
});

export const SearchMessageSchema = z.object({
    id: z.string(),
    content: z.string(),
    channelId: z.string(),
    userId: z.string(),
    username: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    matchContext: z.string(),
    attachments: z.array(SearchAttachmentSchema),
});

export const SearchResponseSchema = z.object({
    messages: z.array(SearchMessageSchema),
    nextId: z.string().nullable(),
    totalCount: z.number(),
});

export interface SearchRequest {
    // The search query string
    query: string;
    // Required workspace context
    workspaceId: string;
    // Optional channel filter
    channelId?: string;
    // Pagination
    beforeId?: string;
    limit?: number;
}

export interface SearchAttachment {
    id: string;
    filename: string;
    fileKey: string;
    mimeType: string;
    size: Int8;
    createdAt: Date;
}

export interface SearchMessage {
    id: Int8;
    content: string;
    channelId: string;
    userId: string;
    username: string;
    createdAt: Date;
    updatedAt: Date;
    // Snippet of text showing the match context
    matchContext: string;
    // Nested attachments that matched the search (if any)
    attachments: SearchAttachment[];
}

export interface SearchResponse {
    messages: SearchMessage[];
    // ID of the last message, null if no more results
    nextId: string | null;
    // Total count of results (across all pages)
    totalCount: number;
} 