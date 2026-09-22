import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import config from './config';
import routes from './routes';
import { bullBoardRouter } from './queues/bullBoard';
import { errorHandler } from './middleware/errorHandler';
import { sendError } from './utils/response';

const app = express();

// Security and parser middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Required for Bull Board UI assets
  })
);

app.use(
  cors({
    origin: [config.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);

app.use(cookieParser(config.SESSION_SECRET));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount Bull Board queue monitoring dashboard
app.use('/admin/queues', bullBoardRouter);

// Mount main REST API
app.use('/api', routes);

// Handle unknown API routes
app.use('/api/*', (req: Request, res: Response) => {
  sendError(res, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`, 404);
});

// Centralized error handling
app.use(errorHandler);

export default app;
