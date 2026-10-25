# Prime Scale: setup (about 15 minutes, all free)

1. Upload everything in this folder to your GitHub repository (replace the old files). Vercel redeploys by itself.
2. Vercel dashboard > your project > Storage > Create Database > Upstash for Redis (Free). Connect it to the project, then Redeploy.
   Without this step, appointments and chats are NOT saved permanently.
3. Vercel > Settings > Environment Variables: add ADMIN_USER and ADMIN_PASS with your own login, then Redeploy.
   Until you do, the login is admin / password, and anyone who guesses it can read your leads.
4. Optional: add ANTHROPIC_API_KEY to make the chat assistant answer with real AI. Without it, it uses built-in scripted answers.
5. Admin page: your-site.vercel.app/admin/
