import 'dotenv/config';
import { db } from '../src/db';
import { createUser } from '../src/db/users';
import { createWorkspace } from '../src/db/workspaces';
import { createChannel } from '../src/db/channels';
import { createMessage, listChannelMessages } from '../src/db/messages';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PERSONALITIES = {
  techie_tom: "A tech enthusiast who loves discussing the latest frameworks and always shares code snippets. Communicates with technical precision and often uses programming analogies.",
  creative_clara: "An imaginative thinker who brings fresh perspectives to discussions. Communicates with colorful language and often uses metaphors and storytelling.",
  analytical_alex: "A data-driven problem solver who loves breaking down complex issues. Communicates methodically and often backs up arguments with statistics.",
  friendly_fiona: "A supportive team player who excels at bringing people together. Communicates warmly and often uses encouraging language to foster collaboration."
};

async function generateMessage(username: string, channelId: string, userId: string, previousMessages: any[]) {
  const personality = PERSONALITIES[username as keyof typeof PERSONALITIES];
  
  const messageHistory = previousMessages.map(msg => `${msg.username}: ${msg.content}`).join('\n');
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "system",
      content: `You are ${username}. ${personality}\n\nRespond with a single message that fits your personality and communication style. Keep responses under 200 characters. DO NOT use quotation marks in your response.`
    }, {
      role: "user",
      content: messageHistory ? 
        `Given this chat history:\n${messageHistory}\n\nWhat would you say next?` :
        "Start a new conversation in the general channel."
    }],
    temperature: 0.9,
  });

  const content = response.choices[0]?.message?.content || "Hello!";
  
  return await createMessage(channelId, userId, {
    content: content.replace(/["']/g, ''),
    attachments: []
  });
}

async function main() {
  try {
    // Create 4 users with predefined personalities
    const users = await Promise.all([
      createUser({
        email: 'user1@example.com',
        username: 'techie_tom',
        password_hash: 'dummy_hash'
      }),
      createUser({
        email: 'user2@example.com',
        username: 'creative_clara',
        password_hash: 'dummy_hash'
      }),
      createUser({
        email: 'user3@example.com',
        username: 'analytical_alex',
        password_hash: 'dummy_hash'
      }),
      createUser({
        email: 'user4@example.com',
        username: 'friendly_fiona',
        password_hash: 'dummy_hash'
      })
    ]);

    if (!users[0]) throw new Error('Failed to create first user');

    // Create a workspace
    const workspace = await createWorkspace(users[0].id, {
      name: 'AI Chat Testing'
    });

    if (!workspace) throw new Error('Failed to create workspace');

    // Add all other users to the workspace
    await Promise.all(users.slice(1).map(async (user) => {
      if (!user) return;
      await db.insertInto('workspace_members')
        .values({
          workspace_id: workspace.id,
          user_id: user.id,
          role: 'member',
        })
        .execute();
    }));

    // Create a channel and add all users
    const memberIds = users.slice(1).map(u => u?.id).filter((id): id is string => id !== undefined);
    const channel = await createChannel(workspace.id, users[0].id, {
      name: 'general',
      is_private: false,
      member_ids: memberIds
    });

    // Generate a conversation (10 messages)
    console.log('\nGenerating conversation...');
    for (let i = 0; i < 10; i++) {
      const userIndex = i % users.length;
      const user = users[userIndex];
      if (!user) continue;

      const messages = await listChannelMessages(channel.id, user.id);
      await generateMessage(user.username, channel.id, user.id, messages);
      console.log(`Generated message ${i + 1}/10`);
    }

    console.log('\nTest data generation complete!');
    console.log('\nPersonalities for reference:');
    Object.entries(PERSONALITIES).forEach(([username, personality]) => {
      console.log(`\n${username}:\n${personality}`);
    });

    // Display the final conversation
    console.log('\nFinal conversation:');
    const finalMessages = await listChannelMessages(channel.id, users[0]?.id || '');
    finalMessages.reverse().forEach(msg => {
      console.log(`\n${msg.username}: ${msg.content}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error generating test data:', error);
    process.exit(1);
  }
}

main(); 