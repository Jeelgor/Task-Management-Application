"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const task_controller_1 = require("../controllers/task.controller");
const auth_1 = require("../middlewares/auth");
const validate_1 = require("../middlewares/validate");
const task_schema_1 = require("../schemas/task.schema");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.post('/', (0, validate_1.validate)(task_schema_1.createTaskSchema), task_controller_1.createTask);
router.get('/', (0, validate_1.validate)(task_schema_1.taskQuerySchema), task_controller_1.getTasks);
router.get('/:id', task_controller_1.getTaskById);
router.patch('/:id', (0, validate_1.validate)(task_schema_1.updateTaskSchema), task_controller_1.updateTask);
router.delete('/:id', task_controller_1.deleteTask);
exports.default = router;
//# sourceMappingURL=task.routes.js.map