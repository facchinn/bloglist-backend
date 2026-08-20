const { test, after, beforeEach, describe } = require('node:test')
const assert = require('node:assert')
const bcrypt = require('bcrypt')
const mongoose = require('mongoose')
const supertest = require('supertest')

const app = require('../app')
const User = require('../models/user')
const helper = require('./test_helper')

const api = supertest(app)

describe('when there is initially one user in db', () => {
  beforeEach(async () => {
    await User.deleteMany({})

    const passwordHash = await bcrypt.hash('sekret', 10)
    const user = new User({
      username: 'root',
      name: 'Superuser',
      passwordHash,
    })

    await user.save()
  })

  test('users can be listed', async () => {
    const response = await api
      .get('/api/users')
      .expect(200)
      .expect('Content-Type', /application\/json/)

    assert.strictEqual(response.body.length, 1)
    assert.strictEqual(response.body[0].username, 'root')
    assert.strictEqual(response.body[0].passwordHash, undefined)
  })

  test('creation succeeds with a fresh username', async () => {
    const usersAtStart = await helper.usersInDb()

    const newUser = {
      username: 'mluukkai',
      name: 'Matti Luukkainen',
      password: 'salainen',
    }

    await api
      .post('/api/users')
      .send(newUser)
      .expect(201)
      .expect('Content-Type', /application\/json/)

    const usersAtEnd = await helper.usersInDb()
    assert.strictEqual(usersAtEnd.length, usersAtStart.length + 1)
    assert(usersAtEnd.map((user) => user.username).includes(newUser.username))
  })

  test('creation fails if username already exists', async () => {
    const usersAtStart = await helper.usersInDb()

    const newUser = {
      username: 'root',
      name: 'Another Root',
      password: 'salainen',
    }

    const result = await api
      .post('/api/users')
      .send(newUser)
      .expect(400)

    assert(result.body.error.includes('unique'))

    const usersAtEnd = await helper.usersInDb()
    assert.strictEqual(usersAtEnd.length, usersAtStart.length)
  })

  test('creation fails if username is shorter than 3 characters', async () => {
    const result = await api
      .post('/api/users')
      .send({ username: 'ab', name: 'Short', password: 'salainen' })
      .expect(400)

    assert(result.body.error.includes('at least 3'))
  })

  test('creation fails if password is shorter than 3 characters', async () => {
    const result = await api
      .post('/api/users')
      .send({ username: 'validuser', name: 'Short password', password: 'ab' })
      .expect(400)

    assert(result.body.error.includes('at least 3'))
  })

  test('creation fails if username is missing', async () => {
    const result = await api
      .post('/api/users')
      .send({ name: 'No username', password: 'salainen' })
      .expect(400)

    assert(result.body.error.includes('required'))
  })

  test('creation fails if password is missing', async () => {
    const result = await api
      .post('/api/users')
      .send({ username: 'nopassword', name: 'No password' })
      .expect(400)

    assert(result.body.error.includes('required'))
  })
})

after(async () => {
  await mongoose.connection.close()
})
