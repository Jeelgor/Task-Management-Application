"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTask = exports.updateTask = exports.getTaskById = exports.getTasks = exports.createTask = void 0;
const express_1 = require("express");
const prisma_1 = require("../prisma");
const auth_1 = require("../middlewares/auth");
const client_1 = require("@prisma/client");
const createTask = async (req, res) => {
    const userId = req.user.id;
    const { title, description, status, priority, dueDate } = req.body;
    try {
        const task = await prisma_1.prisma.task.create({
            data: {
                title,
                description: description || '',
                status,
                priority,
                dueDate: dueDate ? new Date(dueDate) : null,
                userId,
            },
        });
        return res.status(201).json(task);
    }
    catch (error) {
        return res.status(500).json({ message: 'Internal server error' });
    }
};
exports.createTask = createTask;
const getTasks = async (req, res) => {
    const userId = req.user.id;
    const { search, status, sortBy, sortOrder, page = 1, limit = 10 } = req.query;
    const where = { userId };
    if (status) {
        where.status = status;
    }
    if (search) {
        where.title = { contains: search, mode: 'insensitive' };
    }
    const orderBy = {};
    if (sortBy) {
        orderBy[sortBy] = sortOrder || 'asc';
    }
    else {
        orderBy.createdAt = 'desc';
    }
    const skip = (Number(page) - 1) * Number(limit);
    try {
        const [tasks, total] = await Promise.all([
            prisma_1.prisma.task.findMany({
                where,
                orderBy,
                skip,
                take: Number(limit),
            }),
            prisma_1.prisma.task.count({ where }),
        ]);
        return res.status(200).json({
            data: tasks,
            meta: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        return res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getTasks = getTasks;
const getTaskById = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
        const task = await prisma_1.prisma.task.findUnique({ where: { id } });
        if (!task || task.userId !== userId) {
            return res.status(404).json({ message: 'Task not found' });
        }
        return res.status(200).json(task);
    }
    catch (error) {
        return res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getTaskById = getTaskById;
const updateTask = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { title, description, status, priority, dueDate } = req.body;
    try {
        const task = await prisma_1.prisma.task.findUnique({ where: { id } });
        if (!task || task.userId !== userId) {
            return res.status(404).json({ message: 'Task not found' });
        }
        const updatedTask = await prisma_1.prisma.task.update({
            where: { id },
            data: {
                ...(title !== undefined && { title }),
                ...(description !== undefined && { description }),
                ...(status !== undefined && { status }),
                ...(priority !== undefined && { priority }),
                ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
            },
        });
        return res.status(200).json(updatedTask);
    }
    catch (error) {
        return res.status(500).json({ message: 'Internal server error' });
    }
};
exports.updateTask = updateTask;
const deleteTask = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
        const task = await prisma_1.prisma.task.findUnique({ where: { id } });
        if (!task || task.userId !== userId) {
            return res.status(404).json({ message: 'Task not found' });
        }
        await prisma_1.prisma.task.delete({ where: { id } });
        return res.status(204).send();
    }
    catch (error) {
        return res.status(500).json({ message: 'Internal server error' });
    }
};
exports.deleteTask = deleteTask;
//# sourceMappingURL=task.controller.js.map