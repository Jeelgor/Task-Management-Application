import { Response } from 'express';

const clients = new Map<string, Response[]>();

export const addClient = (userId: string, res: Response) => {
  if (!clients.has(userId)) {
    clients.set(userId, []);
  }
  clients.get(userId)!.push(res);

  res.on('close', () => {
    removeClient(userId, res);
  });
};

const removeClient = (userId: string, res: Response) => {
  const userClients = clients.get(userId);
  if (userClients) {
    const updatedClients = userClients.filter(c => c !== res);
    if (updatedClients.length === 0) {
      clients.delete(userId);
    } else {
      clients.set(userId, updatedClients);
    }
  }
};

export const broadcastToUser = (userId: string, event: string, data: any) => {
  const userClients = clients.get(userId);
  if (userClients) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    userClients.forEach(res => res.write(payload));
  }
};
