// Imports
import "dotenv/config";
import {
  AttachmentBuilder,
  Client,
  Collection,
  Events,
  OAuth2Scopes,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import cron from "node-cron";
import { z } from "zod";

// Initializing
const env = z
  .object({
    DISCORD_BOT_TOKEN: z.string(),
    DISCORD_BOT_CLIENT_ID: z.string(),
    ENVIRONMENT: z.enum(["DEVELOPMENT", "PRODUCTION"]),
  })
  .parse(process.env);

const client = new Client({
  intents: ["Guilds"],
});

// Events
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "cat") {
      await interaction.deferReply();

      const attachment = await getRandomCatAttachmentBuilder();

      interaction.editReply({
        files: [attachment],
      });

      return;
    }
  }
});

client.on(Events.ChannelCreate, async (channel) => {
  if (channel.name === "daily-random-cat" && channel.isTextBased()) {
    const attachment = await getRandomCatAttachmentBuilder();
    channel.send({
      files: [attachment],
    });
  }
});

client.on(Events.ClientReady, (client) => {
  console.log(`- ${client.user.username}: Ready to work!`);

  if (process.argv.includes("invite")) {
    const invite = client.generateInvite({
      scopes: [OAuth2Scopes.Bot],
      permissions: [
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.UseApplicationCommands,
      ],
    });

    console.log(`- ${client.user.username}: ${invite}`);
  }
});

// Commands
const commands: SlashCommandBuilder[] = [];

const helloCommand = new SlashCommandBuilder()
  .setName("cat")
  .setDescription("Meooow");

commands.push(helloCommand);

// Update Slash Commands
const shouldUpdateSlashCommands =
  env.ENVIRONMENT === "PRODUCTION" ||
  (env.ENVIRONMENT === "DEVELOPMENT" && process.argv.includes("reload"));

if (shouldUpdateSlashCommands) {
  const rest = new REST().setToken(env.DISCORD_BOT_TOKEN);

  rest
    .put(Routes.applicationCommands(env.DISCORD_BOT_CLIENT_ID), {
      body: commands.map((command) => command.toJSON()),
    })
    .then(() => {
      console.log(`Successfully reloaded all Slash Commands.`);
    });
}

// Functions
async function getRandomCatAttachmentBuilder(): Promise<AttachmentBuilder> {
  const response = await fetch("https://cataas.com/cat/cute");
  const arrayBuffer = await response.arrayBuffer();
  return new AttachmentBuilder(Buffer.from(arrayBuffer));
}

function dailyRandomCatChannels(): TextChannel[] {
  const channels = client.channels.cache.filter((channel) => {
    if (!channel.isTextBased()) return false;
    if (!("send" in channel)) return false;
    if ("name" in channel) return channel.name === "daily-random-cat";

    return false;
  }) as Collection<string, TextChannel>;

  return channels.map((channel) => channel);
}

// Schedule to every day at 12:00
cron.schedule(
  "0 12 * * *",
  async () => {
    const channels = dailyRandomCatChannels();
    const attachment = await getRandomCatAttachmentBuilder();

    for (const channel of channels) {
      await channel.send({ files: [attachment] });
    }
  },
  {
    timezone: "America/Sao_Paulo",
  }
);

client.login(env.DISCORD_BOT_TOKEN);
