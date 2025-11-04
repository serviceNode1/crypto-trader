import { query } from '../src/config/database';

async function checkConstraints() {
  const result = await query(`
    SELECT constraint_name, constraint_type 
    FROM information_schema.table_constraints 
    WHERE table_name = 'prices'
  `);
  
  console.log('\nPrices table constraints:');
  result.rows.forEach(row => {
    console.log(`  ${row.constraint_name}: ${row.constraint_type}`);
  });
  
  process.exit(0);
}

checkConstraints();
