const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function countTasks() {
  const count = await prisma.task.count();
  console.log(`There are ${count} tasks in the database.`);
}

countTasks()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
