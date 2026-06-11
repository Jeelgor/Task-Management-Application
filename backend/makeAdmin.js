const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function makeAdmin() {
  await prisma.user.updateMany({
    data: {
      role: 'ADMIN',
    },
  });
  console.log('All users have been upgraded to ADMIN role!');
}

makeAdmin()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
