import prisma from "../lib/prisma.js";

async function makeAdmin(username) {
  try {
    const updatedUser = await prisma.user.update({
      where: { username },
      data: { isAdmin: true },
    });
    console.log(`User ${username} is now an admin!`);
    console.log(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get username from command line argument
const username = process.argv[2];
if (!username) {
  console.error('Please provide a username as an argument');
  process.exit(1);
}

makeAdmin(username); 