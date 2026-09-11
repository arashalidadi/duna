export interface HealthStatus {
  status: 'ok' | 'error';
  app: {
    name: string;
    version: string;
    environment: string;
    uptimeSeconds: number;
  };
  database: {
    status: 'up' | 'down';
  };
  timestamp: string;
}
