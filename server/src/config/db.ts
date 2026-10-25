import dns from 'dns';
import mongoose from 'mongoose';
import { env } from './env';

// Configure reliable DNS resolvers to prevent Windows/ISP querySrv ECONNREFUSED with mongodb+srv
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch {
  // Ignore if setServers fails in restricted container environments
}

const stateMap: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

let memoryServerInstance: any = null;

// Atlas free-tier (M0) needs relaxed timeouts — it wakes slowly after auto-pause
const MONGO_OPTIONS: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: env.NODE_ENV === 'production' ? 30000 : 10000,
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000,
  maxPoolSize: 10,
  minPoolSize: 1,
};

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const isNetworkError = (err: Error) =>
  err.message.includes('querySrv') ||
  err.message.includes('ECONNREFUSED') ||
  err.message.includes('ENOTFOUND') ||
  err.message.includes('ETIMEDOUT') ||
  err.message.includes('Could not connect to any servers') ||
  (err as any).code === 'SERVER_SELECTION_TIMEOUT' ||
  (err as any).name === 'MongooseServerSelectionError';

export async function connectDB(): Promise<void> {
  // Register listeners once to avoid duplicates on hot-reload
  if (mongoose.connection.listenerCount('connected') === 0) {
    mongoose.connection.on('connected', () =>
      logger().info('MongoDB connected')
    );
    mongoose.connection.on('error', (err: Error) =>
      logger().error({ err }, 'MongoDB error')
    );
    mongoose.connection.on('disconnected', () =>
      logger().warn('MongoDB disconnected — will auto-reconnect')
    );
    mongoose.connection.on('reconnected', () =>
      logger().info('MongoDB reconnected')
    );
  }

  let attempt = 0;

  const tryConnect = async (): Promise<void> => {
    const isAtlas = env.MONGODB_URI.includes('mongodb+srv');
    try {
      logger().info(
        `Connecting to ${isAtlas ? 'MongoDB Atlas' : 'MongoDB'} (attempt ${attempt + 1})...`
      );
      if (isAtlas && attempt === 0) {
        logger().info('Note: Atlas free-tier may take up to 30s to wake from auto-pause');
      }
      await mongoose.connect(env.MONGODB_URI, MONGO_OPTIONS);
    } catch (err: any) {
      if (isNetworkError(err) && attempt < MAX_RETRIES) {
        attempt++;
        const delay = RETRY_DELAY_MS * attempt;
        logger().warn(
          { err: err.message, attempt, delay },
          `Connection failed — retrying in ${delay / 1000}s. ` +
          'Check Atlas Network Access if this keeps failing.'
        );
        await sleep(delay);
        return tryConnect();
      }

      // In development, fall back to in-memory MongoDB if Atlas is unreachable or IP blocked
      if (env.NODE_ENV !== 'production') {
        try {
          logger().warn(
            'Atlas connection unavailable (IP whitelist or network). Launching embedded in-memory MongoDB fallback...'
          );
          const { MongoMemoryServer } = await import('mongodb-memory-server');
          memoryServerInstance = await MongoMemoryServer.create();
          const memoryUri = memoryServerInstance.getUri('hackathon_db');
          await mongoose.connect(memoryUri);
          logger().info({ uri: memoryUri }, 'Successfully connected to in-memory MongoDB fallback! All features ready.');
          return;
        } catch (memErr: any) {
          logger().error({ err: memErr.message }, 'Failed to start in-memory fallback');
        }
      }

      // Non-retryable or exhausted retries in production — log clearly
      logger().error(
        { uri: env.MONGODB_URI.replace(/:([^@]+)@/, ':****@') },
        'Could not connect to MongoDB. Running without persistent storage.'
      );
    }
  };

  await tryConnect();
}

export async function closeDB(): Promise<void> {
  await mongoose.connection.close();
  if (memoryServerInstance) {
    await memoryServerInstance.stop();
    memoryServerInstance = null;
  }
}

export interface DbStatus {
  connected: boolean;
  state: string;
  host?: string;
  name?: string;
  pingMs?: number;
}

export async function getDbStatus(): Promise<DbStatus> {
  const readyState = mongoose.connection.readyState;
  const connected = readyState === 1;
  let pingMs: number | undefined;

  if (connected && mongoose.connection.db) {
    try {
      const t = Date.now();
      await mongoose.connection.db.admin().ping();
      pingMs = Date.now() - t;
    } catch {
      // ignore — status stays undefined
    }
  }

  return {
    connected,
    state: stateMap[readyState] ?? 'unknown',
    host: mongoose.connection.host || undefined,
    name: mongoose.connection.name || undefined,
    pingMs,
  };
}

// Lazily resolve the logger to avoid circular imports at module load time
function logger() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/logger').logger as import('pino').Logger;
}
