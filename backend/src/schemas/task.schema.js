"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskQuerySchema = exports.updateTaskSchema = exports.createTaskSchema = void 0;
const zod_1 = require("zod");
exports.createTaskSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().min(1, 'Title is required').max(255),
        description: zod_1.z.string().optional(),
        status: zod_1.z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
        priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
        dueDate: zod_1.z.string().datetime().optional().nullable(),
    }),
});
exports.updateTaskSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().min(1, 'Title cannot be empty').max(255).optional(),
        description: zod_1.z.string().optional(),
        status: zod_1.z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
        priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
        dueDate: zod_1.z.string().datetime().optional().nullable(),
    }),
});
exports.taskQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        search: zod_1.z.string().optional(),
        status: zod_1.z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
        sortBy: zod_1.z.enum(['dueDate', 'priority', 'createdAt']).optional(),
        sortOrder: zod_1.z.enum(['asc', 'desc']).optional(),
        page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
        limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
    }),
});
//# sourceMappingURL=task.schema.js.map