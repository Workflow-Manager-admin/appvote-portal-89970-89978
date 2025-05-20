import testStorage from './testStorage';

// Run the storage tests
console.log('Running Supabase storage tests...');
testStorage().then(() => {
  console.log('Tests execution completed');
});
