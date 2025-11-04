/**
 * Check if required environment variables are set
 */

import dotenv from 'dotenv';
dotenv.config();

function checkEnvVars() {
  console.log('\n🔍 Checking Environment Variables...\n');

  const requiredVars = [
    { name: 'ANTHROPIC_API_KEY', description: 'Anthropic Claude API' },
    { name: 'OPENAI_API_KEY', description: 'OpenAI GPT API' },
    { name: 'COINGECKO_API_KEY', description: 'CoinGecko API' },
    { name: 'COINBASE_API_KEY', description: 'Coinbase API' },
    { name: 'REDDIT_CLIENT_ID', description: 'Reddit API' },
    { name: 'CRYPTOPANIC_API_KEY', description: 'CryptoPanic News API' },
  ];

  let missingCount = 0;

  for (const v of requiredVars) {
    const value = process.env[v.name];
    if (!value || value === '') {
      console.log(`❌ ${v.name} - NOT SET`);
      console.log(`   Required for: ${v.description}\n`);
      missingCount++;
    } else {
      const masked = value.substring(0, 8) + '...' + value.substring(value.length - 4);
      console.log(`✅ ${v.name} - SET`);
      console.log(`   Value: ${masked}\n`);
    }
  }

  console.log('═══════════════════════════════════════');
  if (missingCount > 0) {
    console.log(`⚠️  ${missingCount} required API keys are missing!`);
    console.log('\nAI recommendations require at least one of:');
    console.log('  - ANTHROPIC_API_KEY (Claude)');
    console.log('  - OPENAI_API_KEY (GPT)');
    console.log('\nWithout these, recommendations cannot be generated.');
  } else {
    console.log('✅ All API keys are configured!');
  }
  console.log('═══════════════════════════════════════\n');

  process.exit(missingCount > 0 ? 1 : 0);
}

checkEnvVars();
