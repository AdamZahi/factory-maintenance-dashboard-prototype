import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { prisma } from './db'

const app = express()
const port = Number(process.env.PORT ?? 4000)

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '1mb' }))

app.get('/health', async (_req, res) => {
  const equipmentCount = await prisma.equipment.count().catch(() => 0)
  res.json({ ok: true, equipmentCount })
})

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`)
})
