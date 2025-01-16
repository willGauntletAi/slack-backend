import { db } from '../db';
import { sql } from 'kysely';
import { Messages } from '../db/types';


export async function semanticSearch(
    embedding: number[], 
    userId: string,
    workspaceId: string,
    limit: number = 5, 
    channelId?: string
) {
    const similarityScore = sql<number>`1 - (me.embedding <=> ${JSON.stringify(embedding)}::vector)`;
    
    const query = db
        .selectFrom('messages as m')
        .innerJoin('message_embeddings as me', 'me.message_id', 'm.id')
        .innerJoin('users as u', 'u.id', 'm.user_id')
        .innerJoin('channels as c', 'c.id', 'm.channel_id')
        .innerJoin('workspace_members as wm', (join) => 
            join.onRef('wm.workspace_id', '=', 'c.workspace_id')
                .on('wm.user_id', '=', sql.lit(userId))
                .on('wm.deleted_at', 'is', null)
        )
        .leftJoin('channel_members as cm', (join) => 
            join.onRef('cm.channel_id', '=', 'm.channel_id')
                .on('cm.user_id', '=', sql.lit(userId))
                .on('cm.deleted_at', 'is', null)
        )
        .select([
            'm.id',
            'm.content',
            'm.user_id as userId',
            'u.username',
            'm.channel_id as channelId',
            'm.created_at as createdAt',
            'm.updated_at as updatedAt',
            'm.is_avatar',
            similarityScore.as('similarity')
        ])
        .where('m.deleted_at', 'is', null)
        .where('c.workspace_id', '=', workspaceId)
        .where('c.deleted_at', 'is', null)
        .where((eb) => 
            eb.or([
                eb('c.is_private', '=', false),
                eb.exists(
                    eb.selectFrom('channel_members')
                        .select('channel_id')
                        .where('channel_id', '=', eb.ref('m.channel_id'))
                        .where('user_id', '=', userId)
                        .where('deleted_at', 'is', null)
                )
            ])
        )

    if (channelId) {
        query.where('m.channel_id', '=', channelId);
    }

    const results = await query
        .orderBy('similarity', 'desc')
        .limit(limit)
        .execute();

    return results;
} 