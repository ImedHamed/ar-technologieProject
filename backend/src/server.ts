// Server entry point - POI FTTH Management
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import suiviEtudeRoutes from './routes/suivi-etude.routes';
import dossierEtudeRoutes from './routes/dossier-etude.routes';
import excelRoutes from './routes/excel.routes';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware — CORS must come before helmet
app.use(cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true
}));
app.use(helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'POI FTTH Management API'
    });
});

// API routes
app.get('/api/v1/', (_req, res) => {
    res.json({
        message: 'POI FTTH Management System API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/health',
            auth: '/api/v1/auth',
            suiviEtudes: '/api/v1/suivi-etudes',
            dossierEtudes: '/api/v1/dossier-etudes'
        }
    });
});

// Authentication routes
app.use('/api/v1/auth', authRoutes);

// User management routes
app.use('/api/v1/users', userRoutes);

// Suivi études routes
app.use('/api/v1/suivi-etudes', suiviEtudeRoutes);
app.use('/api/v1/dossier-etudes', dossierEtudeRoutes);
app.use('/api/v1/excel', excelRoutes);


// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
            status: err.status || 500
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

export default app;

