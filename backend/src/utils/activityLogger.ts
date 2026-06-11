import { prisma } from '../prisma';

export const logActivity = async (
  taskId: string,
  userId: string,
  action: string,
  oldValue: any = null,
  newValue: any = null
) => {
  try {
    await prisma.taskActivity.create({
      data: {
        taskId,
        userId,
        action,
        oldValue: oldValue ? JSON.stringify(oldValue) : null,
        newValue: newValue ? JSON.stringify(newValue) : null,
      },
    });
  } catch (error) {
    console.error('Failed to log activity', error);
  }
};
