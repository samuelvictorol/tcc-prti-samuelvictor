require('dotenv').config()

const bcrypt = require('bcryptjs')
const { connectDatabase } = require('../config/database')
const User = require('../models/User.model')

async function run () {
  await connectDatabase()

  const email = 'admin@ejug.local'
  const exists = await User.findOne({ email })

  if (exists) {
    console.log('[seed] Admin já existe:', email)
    process.exit(0)
  }

  const passwordHash = await bcrypt.hash('admin123', 10)

  await User.create({
    name: 'Administrador EJUG',
    email,
    passwordHash,
    role: 'ADMIN'
  })

  console.log('[seed] Admin criado com sucesso.')
  console.log('E-mail: admin@ejug.local')
  console.log('Senha: admin123')

  process.exit(0)
}

run().catch((error) => {
  console.error('[seed] Erro:', error)
  process.exit(1)
})
