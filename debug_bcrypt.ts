import bcrypt from 'bcryptjs';

async function main() {
  const refreshToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjZTYzOGIyYy02ZTRkLTQ2Y2QtYTQzNi1jZmJiYmEyNTllMWIiLCJzZXNzaW9uSWQiOiJlYjZiYTBiMTY5NWM5YTkyZmYwMGM0YTc2ZDA3MTA4NyIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzg2MjU5MzE5LCJleHAiOjE3ODg4NTEzMTl9.oiFGKdyuZyxRgNRVpgYfaGPAXoN3tnmpSuPr90L13fI";
  const storedHash = "$2b$10$eZT0yBuoH81cbVBL1X2jZOWnNFSDsqypMS3mEN1kv4PcuMNVk0mty";

  const result = await bcrypt.compare(refreshToken, storedHash);
  console.log('bcrypt.compare result:', result);

  // Test with hashSync
  const newHash = bcrypt.hashSync(refreshToken, 10);
  console.log('newHash:', newHash);
  const result2 = await bcrypt.compare(refreshToken, newHash);
  console.log('bcrypt.compare with new hash:', result2);

  // Test verifyPassword function
  const verifyPassword = async (password: string, hash: string) => bcrypt.compare(password, hash);
  const result3 = await verifyPassword(refreshToken, storedHash);
  console.log('verifyPassword result:', result3);
}

main().catch(console.error);
