import { FunctionExecutor } from '../execution/function-executor';

export class HttpTrigger {
  constructor(private executor = new FunctionExecutor()) {}

  async handleRequest(functionId: string, req: any) {
    const result = await this.executor.invoke(functionId, req.body, {
      HTTP_METHOD: req.method,
      HTTP_PATH: req.path
    });

    return {
      statusCode: 200,
      body: JSON.stringify(result),
      headers: {
        'X-Cold-Start': result.coldStart.toString(),
        'Content-Type': 'application/json',
        'X-Execution-Id': result.metrics.executionId
      }
    };
  }

  createMiddleware(functionId: string) {
    return async (req: any, res: any) => {
      try {
        const response = await this.handleRequest(functionId, req);
        res.set(response.headers).status(response.statusCode).send(response.body);
      } catch (error) {
        res.status(500).json({ error: 'Function execution failed' });
      }
    };
  }
}