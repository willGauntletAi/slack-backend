import { db } from './index';

export async function createWebsocketConnection(userId: string, serverId: string) {
    const result = await db
        .insertInto('websocket_connections')
        .values({
            user_id: userId,
            server_id: serverId,
        })
        .returning(['connection_id'])
        .executeTakeFirstOrThrow();

    return result.connection_id;
}

export async function deleteWebsocketConnection(connectionId: string) {
    await db
        .deleteFrom('websocket_connections')
        .where('connection_id', '=', connectionId)
        .execute();
}

export async function getConnectionsForChannel(channelId: string, serverId: string) {
    const result = await db
        .selectFrom('websocket_connections')
        .select('websocket_connections.connection_id')
        .where('server_id', '=', serverId)
        .innerJoin('users', 'users.id', 'websocket_connections.user_id')
        .innerJoin('channel_members', 'channel_members.user_id', 'websocket_connections.user_id')
        .where('channel_members.deleted_at', 'is', null)
        .where('channel_members.channel_id', '=', channelId)
        .execute();

    return result;
}

export async function getConnectionsForDM(channelId: string, serverId: string) {
    const result = await db
        .selectFrom('websocket_connections')
        .select('websocket_connections.connection_id')
        .where('server_id', '=', serverId)
        .innerJoin('users', 'users.id', 'websocket_connections.user_id')
        .innerJoin('direct_message_members', 'direct_message_members.user_id', 'websocket_connections.user_id')
        .where('direct_message_members.deleted_at', 'is', null)
        .where('direct_message_members.channel_id', '=', channelId)
        .execute();

    return result;
}