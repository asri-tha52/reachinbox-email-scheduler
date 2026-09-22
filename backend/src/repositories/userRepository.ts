import prisma from '../config/database';

export class UserRepository {
  static async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        slackConnection: true,
        senders: true,
      },
    });
  }

  static async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        slackConnection: true,
        senders: true,
      },
    });
  }

  static async findByGoogleId(googleId: string) {
    return prisma.user.findUnique({
      where: { googleId },
      include: {
        slackConnection: true,
        senders: true,
      },
    });
  }

  static async upsertGoogleUser(data: {
    googleId: string;
    email: string;
    name: string;
    avatar?: string | null;
  }) {
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: {
        googleId: data.googleId,
        name: data.name,
        avatar: data.avatar || undefined,
      },
      create: {
        googleId: data.googleId,
        email: data.email,
        name: data.name,
        avatar: data.avatar || null,
      },
      include: {
        slackConnection: true,
        senders: true,
      },
    });

    // Ensure user has at least one default sender
    await this.ensureDefaultSender(user.id, user.email, user.name);

    return user;
  }

  static async ensureDefaultSender(userId: string, email: string, name: string) {
    const existing = await prisma.sender.findFirst({
      where: { userId },
    });

    if (!existing) {
      return prisma.sender.create({
        data: {
          userId,
          email,
          name,
          hourlyLimit: 100,
          enabled: true,
        },
      });
    }

    return existing;
  }

  static async getUserSenders(userId: string) {
    return prisma.sender.findMany({
      where: { userId, enabled: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async createSender(data: {
    userId: string;
    email: string;
    name: string;
    hourlyLimit?: number;
  }) {
    return prisma.sender.create({
      data: {
        userId: data.userId,
        email: data.email,
        name: data.name,
        hourlyLimit: data.hourlyLimit || 100,
      },
    });
  }

  static async upsertSlackConnection(data: {
    userId: string;
    accessToken: string;
    teamId: string;
    channelId?: string;
  }) {
    return prisma.slackConnection.upsert({
      where: { userId: data.userId },
      update: {
        accessToken: data.accessToken,
        teamId: data.teamId,
        channelId: data.channelId || null,
        connected: true,
      },
      create: {
        userId: data.userId,
        accessToken: data.accessToken,
        teamId: data.teamId,
        channelId: data.channelId || null,
        connected: true,
      },
    });
  }

  static async disconnectSlack(userId: string) {
    return prisma.slackConnection.updateMany({
      where: { userId },
      data: { connected: false },
    });
  }

  static async getSlackConnection(userId: string) {
    return prisma.slackConnection.findUnique({
      where: { userId },
    });
  }
}
