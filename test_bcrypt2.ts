import bcrypt from 'bcryptjs';

const refreshToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjZTYzOGIyYy02ZTRkLTQ2Y2QtYTQzNi1jZmJiYmEyNTllMWIiLCJzZXNzaW9uSWQiOiJhNTVmMWNlNDg3NDY5ZGU5YzFmNjkwNGM5ZWMyODg5MyIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzg2MjU5NzU2LCJleHAiOjE3ODg4NTE3NTZ9.lg82kaUJ6eF49XkNt8ipHH5mdYm_GaUS_H6MQNBLUk0";

// Test hashSync then compare
const hash1 = bcrypt.hashSync(refreshToken, 10);
console.log('hash1:', hash1);
const result1 = bcrypt.compareSync(refreshToken, hash1);
console.log('compareSync result1:', result1);

// Test hashSync again (different salt)
const hash2 = bcrypt.hashSync(refreshToken, 10);
console.log('hash2:', hash2);
const result2 = bcrypt.compareSync(refreshToken, hash2);
console.log('compareSync result2:', result2);

// Test with the stored hash from DB
const storedHash = "$2b$10$JKNb7FHW1oRyNAikQZBl9u9EDPr/8nN24XvJX8zuPjZ04CzUHDnaG";
const result3 = bcrypt.compareSync(refreshToken, storedHash);
console.log('compareSync with stored hash:', result3);
