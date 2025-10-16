import bcrypt from 'bcrypt';

async function generateHash() {
  const password = 'password123';
  const hash = await bcrypt.hash(password, 12);
  console.log('\n🔐 Bcrypt Hash for "password123":');
  console.log(hash);
  console.log('\n✅ Copy this hash into migration 003_create_default_admin.sql\n');
}

generateHash();
