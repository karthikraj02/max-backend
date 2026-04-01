app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://max-frontend-nine.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
}));