import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { prisma } from './db'
import { clerkAuth } from './middleware/auth'
import { equipmentRouter } from './routes/equipment'
import { techniciansRouter } from './routes/technicians'
import { assignmentsRouter } from './routes/assignments'
import { inspectionsRouter } from './routes/inspections'

const app = express()
const port = Number(process.env.PORT ?? 4000)

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? true,
    credentials: true,
  }),
)

app.use(express.json({ limit: '1mb' }))

// Parse the Clerk session onto every request. New users are mirrored into the
// DB lazily by requireUser on their first authenticated call (no webhook).
app.use(clerkAuth)

app.get('/health', async (_req, res) => {
  const equipmentCount = await prisma.equipment.count().catch(() => 0)
  res.json({ ok: true, equipmentCount })
})

app.use('/api/equipment', equipmentRouter)
app.use('/api/technicians', techniciansRouter)
app.use('/api/assignments', assignmentsRouter)
app.use('/api/inspections', inspectionsRouter)

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`)
})
