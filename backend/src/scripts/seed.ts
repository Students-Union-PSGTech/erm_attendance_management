import { connectDb, disconnectDb } from '../config/db';
import { Member } from '../models/Member';
import { newId } from '../utils/ids';
import { TEAMS, ROLES, YEARS } from '../config/constants';

const sampleFirstNames = ['Aarav', 'Diya', 'Vihaan', 'Ananya', 'Aditya', 'Kavya', 'Rudra', 'Saanvi', 'Arjun', 'Isha', 'Rohan', 'Zara', 'Kabir', 'Myra', 'Dhruv'];
const sampleLastNames = ['Patel', 'Sharma', 'Singh', 'Gupta', 'Kumar', 'Reddy', 'Verma', 'Nair', 'Menon', 'Desai', 'Joshi', 'Chawla', 'Mehta', 'Rao', 'Iyer'];

async function seed() {
  await connectDb();
  try {
    console.log('Clearing existing members...');
    await Member.deleteMany({});
    
    console.log('Seeding dummy members...');
    const membersToInsert = [];
    
    // Generate 150 diverse dummy members
    for (let i = 1; i <= 150; i++) {
      const firstName = sampleFirstNames[Math.floor(Math.random() * sampleFirstNames.length)];
      const lastName = sampleLastNames[Math.floor(Math.random() * sampleLastNames.length)];
      
      const team = TEAMS[Math.floor(Math.random() * TEAMS.length)];
      
      // Weight roles so 'CORE' is more common than 'LEAD'
      const roleRand = Math.random();
      let role = 'CORE';
      if (roleRand > 0.95) role = 'LEAD';
      else if (roleRand > 0.85) role = 'CO-LEAD';
      else if (roleRand > 0.6) role = 'COORDINATOR';

      const year = YEARS[Math.floor(Math.random() * YEARS.length)];
      
      membersToInsert.push({
        _id: newId(),
        name: `${firstName} ${lastName}`,
        team,
        role,
        year,
        rollNo: `23${team.substring(0, 2).toUpperCase()}${i.toString().padStart(3, '0')}`,
        department: 'B.Tech',
        phone: '9' + Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')
      });
    }
    
    await Member.insertMany(membersToInsert);
    console.log(`Successfully seeded ${membersToInsert.length} members to the local database!`);
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await disconnectDb();
  }
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
