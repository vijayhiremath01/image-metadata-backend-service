import "dotenv/config";
import app from './src/app';

const port = parseInt(process.env.PORT || '3000', 10);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});