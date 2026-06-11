import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
export declare const createTask: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getTasks: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getTaskById: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updateTask: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const deleteTask: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=task.controller.d.ts.map