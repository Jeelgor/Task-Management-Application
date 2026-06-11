import { Response } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from '../middlewares/auth';
import { Prisma } from '@prisma/client';
import { logActivity } from '../utils/activityLogger';
import { addClient, broadcastToUser } from '../services/sse.service';

export const streamTasks = (req: AuthRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const userId = req.user!.id;
  addClient(userId, res);
};

export const createTask = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { title, description, status, priority, dueDate } = req.body;

  try {
    const task = await prisma.task.create({
      data: {
        title,
        description: description || '',
        status,
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        userId,
      },
    });

    await logActivity(task.id, userId, 'CREATED', null, task);
    broadcastToUser(userId, 'TASK_CREATED', task);

    return res.status(201).json(task);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getTasks = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { search, status, sortBy, sortOrder, page = 1, limit = 10 } = req.query;

  const where: Prisma.TaskWhereInput = { userId };

  if (status) {
    where.status = status as any;
  }

  if (search) {
    where.OR = [
      { title: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const orderBy: Prisma.TaskOrderByWithRelationInput = {};
  if (sortBy) {
    (orderBy as any)[sortBy as string] = sortOrder || 'asc';
  } else {
    orderBy.createdAt = 'desc';
  }

  const skip = (Number(page) - 1) * Number(limit);

  try {
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy,
        skip,
        take: Number(limit),
        include: { attachments: true }
      }),
      prisma.task.count({ where }),
    ]);

    return res.status(200).json({
      data: tasks,
      meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getAllAdminTasks = async (req: AuthRequest, res: Response) => {
  const { search, status, sortBy, sortOrder, page = 1, limit = 10 } = req.query;
  const where: Prisma.TaskWhereInput = {};

  if (status) where.status = status as any;
  if (search) {
    where.OR = [
      { title: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const orderBy: Prisma.TaskOrderByWithRelationInput = {};
  if (sortBy) {
    (orderBy as any)[sortBy as string] = sortOrder || 'asc';
  } else {
    orderBy.createdAt = 'desc';
  }

  const skip = (Number(page) - 1) * Number(limit);

  try {
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy,
        skip,
        take: Number(limit),
        include: { user: { select: { email: true } } }
      }),
      prisma.task.count({ where }),
    ]);

    return res.status(200).json({
      data: tasks,
      meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getTaskById = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const id = req.params.id as string;

  try {
    const task = await prisma.task.findUnique({ 
      where: { id },
      include: { attachments: true, activities: { orderBy: { createdAt: 'desc' }, include: { user: { select: { email: true } } } } }
    });

    if (!task || (task.userId !== userId && req.user!.role !== 'ADMIN')) {
      return res.status(404).json({ message: 'Task not found' });
    }

    return res.status(200).json(task);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateTask = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const id = req.params.id as string;
  const { title, description, status, priority, dueDate } = req.body;

  try {
    const task = await prisma.task.findUnique({ where: { id } });

    if (!task || task.userId !== userId) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      },
    });

    await logActivity(task.id, userId, 'UPDATED', task, updatedTask);
    broadcastToUser(userId, 'TASK_UPDATED', updatedTask);

    return res.status(200).json(updatedTask);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const id = req.params.id as string;

  try {
    const task = await prisma.task.findUnique({ where: { id } });

    if (!task || task.userId !== userId) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await prisma.task.delete({ where: { id } });

    broadcastToUser(userId, 'TASK_DELETED', { id });

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const uploadAttachment = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const id = req.params.id as string;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task || task.userId !== userId) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const url = `/uploads/${file.filename}`;

    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId: id,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url,
      }
    });

    await logActivity(id, userId, 'ADDED_ATTACHMENT', null, attachment);
    broadcastToUser(userId, 'TASK_UPDATED', task);

    return res.status(201).json(attachment);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
};
