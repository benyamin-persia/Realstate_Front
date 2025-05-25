import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function updatePropertyTypesRaw() {
  try {
    const oldToNewMap = {
      'apartment': 'AKHUND',
      'house': 'AFGHANI',
      'condo': 'AFGHAN_MAL',
      'land': 'SEPAHI',
      // Add other old values and their new mappings if necessary
    };

    console.log('Starting raw database property type update...');

    for (const oldType in oldToNewMap) {
      const newType = oldToNewMap[oldType];
      console.log(`Attempting to update posts with property type: "${oldType}" to "${newType}"`);

      try {
        // Use $runCommandRaw to execute a native MongoDB updateMany command
        // This bypasses Prisma's schema validation for the query part
        const updateResult = await prisma.$runCommandRaw({
          update: 'Post', // The collection name
          updates: [
            {
              q: { property: oldType }, // Query for documents with the old property type
              u: { $set: { property: newType } }, // Update the property field to the new type
              upsert: false, // Don't insert if no match
              multi: true // Update multiple documents
            }
          ],
          ordered: true // Execute updates in order
        });

        console.log(`Raw update command result for type "${oldType}":`, JSON.stringify(updateResult));
        // Note: The exact structure of updateResult might vary, check logs for details

      } catch (updateErr) {
        console.error(`Error updating posts with type "${oldType}":`, updateErr);
        // Continue to the next type even if one fails
      }
    }

    console.log('Finished raw database property type update script.');
  } catch (err) {
    console.error('An error occurred during the update process:', err);
  } finally {
    await prisma.$disconnect();
  }
}

updatePropertyTypesRaw(); 