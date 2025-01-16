import { db } from './index';
import { sql, SqlBool } from 'kysely';
import { isChannelMember } from './channels';
import { SearchMessage, SearchResponse } from '../routes/search/types';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { Int8 } from './types';

interface SearchOptions {
    query: string;
    workspaceId: string;
    channelId?: string;
    beforeId?: string;
    limit: number;
}

function formatSearchQuery(query: string): string {
    // Split into words, add :* to each word for prefix matching, and join with &
    return query
        .trim()
        .split(/\s+/)
        .map(word => `${word}:*`)
        .join(' & ');
}

export async function searchMessages(userId: string, options: SearchOptions): Promise<SearchResponse> {
    const { query, workspaceId, channelId, beforeId, limit } = options;
    const formattedQuery = formatSearchQuery(query);

    // First verify user has access to the workspace
    const hasAccess = await db
        .selectFrom('workspace_members')
        .where('workspace_id', '=', workspaceId)
        .where('user_id', '=', userId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();

    if (!hasAccess) {
        throw new Error('Not a member of this workspace');
    }

    // Base query for messages
    let messagesQuery = db
        .selectFrom('messages as m')
        .innerJoin('users as u', 'u.id', 'm.user_id')
        .innerJoin('channels as c', 'c.id', 'm.channel_id')
        .where('m.deleted_at', 'is', null)
        .where('c.workspace_id', '=', workspaceId)
        .where(eb =>
            eb.or([
                sql<SqlBool>`to_tsvector('english', m.content) @@ to_tsquery('english', ${formattedQuery})`,
                eb.exists(
                    eb.selectFrom('message_attachments as ma')
                        .whereRef('ma.message_id', '=', 'm.id')
                        .where(sql<SqlBool>`to_tsvector('english', ma.filename) @@ to_tsquery('english', ${formattedQuery})`)
                )
            ])
        );

    // Apply channel filter if provided
    if (channelId) {
        // Verify user has access to the channel
        const isMember = await isChannelMember(channelId, userId);
        if (!isMember) {
            throw new Error('Not a member of this channel');
        }

        messagesQuery = messagesQuery.where('m.channel_id', '=', channelId);
    }

    // Only show messages from channels the user is a member of
    const userChannels = db
        .selectFrom('channel_members')
        .where('user_id', '=', userId)
        .where('deleted_at', 'is', null)
        .select('channel_id')
        .as('user_channels');

    messagesQuery = messagesQuery
        .innerJoin(userChannels, 'user_channels.channel_id', 'm.channel_id');

    // Apply ID-based pagination
    if (beforeId) {
        messagesQuery = messagesQuery.where('m.id', '<', beforeId);
    }

    // Get total count (for pagination info)
    const countQuery = messagesQuery.select(eb => eb.fn.countAll().as('count'));
    const totalCount = Number((await countQuery.executeTakeFirst())?.count || 0);

    // Execute main query
    const messages = await messagesQuery
        .select(eb => [
            'm.id',
            'm.content',
            'm.channel_id as channelId',
            'm.user_id as userId',
            'u.username',
            'm.created_at as createdAt',
            'm.updated_at as updatedAt',
            'm.is_avatar',
            sql<string>`ts_headline('english', m.content, to_tsquery('english', ${formattedQuery}))`.as('matchContext'),
            jsonArrayFrom(
                eb.selectFrom('message_attachments as ma')
                    .whereRef('ma.message_id', '=', 'm.id')
                    .select([
                        'ma.id',
                        'ma.filename',
                        'ma.file_key as fileKey',
                        'ma.mime_type as mimeType',
                        'ma.size',
                        'ma.created_at as createdAt',
                        sql<SqlBool>`to_tsvector('english', ma.filename) @@ to_tsquery('english', ${formattedQuery})`.as('matches_search')
                    ])
            ).as('attachments')
        ])
        .orderBy('m.id', 'desc')
        .limit(limit)
        .execute();
    console.log(messages);

    const nextId = messages.length === limit ? messages[messages.length - 1].id.toString() : null;

    return {
        messages: messages.map(msg => ({
            ...msg,
            id: String(msg.id) as unknown as Int8,
            is_avatar: msg.is_avatar,
            // For messages that matched due to attachment, highlight the matching attachment filename
            matchContext: msg.matchContext || (msg.attachments.find(a => a.matches_search)
                ? `Matching attachment: ${msg.attachments.find(a => a.matches_search)?.filename}`
                : msg.content),
            attachments: msg.attachments.map(att => ({
                ...att,
                size: String(att.size) as unknown as Int8
            }))
        })),
        nextId,
        totalCount
    };
}

export async function semanticSearch(embedding: number[], limit: number = 10): Promise<Array<{
    id: string;
    content: string;
    score: number;
    channelId: string;
    userId: string;
    username: string;
    createdAt: Date;
    updatedAt: Date;
}>> {
    return db
        .selectFrom('messages as m')
        .innerJoin('message_embeddings as me', 'me.message_id', 'm.id')
        .innerJoin('users as u', 'u.id', 'm.user_id')
        .where('m.deleted_at', 'is', null)
        .select(eb => [
            'm.id',
            'm.content',
            'm.channel_id as channelId',
            'm.user_id as userId',
            'u.username',
            'm.created_at as createdAt',
            'm.updated_at as updatedAt',
            sql<number>`1 - (me.embedding <=> ${sql.raw(`'[${embedding.join(',')}]'::vector`)})`.as('score')
        ])
        .orderBy('score', 'desc')
        .limit(limit)
        .execute();
} 