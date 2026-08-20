const { test, after, beforeEach, describe } = require('node:test')
const assert = require('node:assert')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const supertest = require('supertest')

const app = require('../app')
const Blog = require('../models/blog')
const User = require('../models/user')
const helper = require('./test_helper')

const api = supertest(app)

let token
let testUserId

describe('when there are initially some blogs saved', () => {
  beforeEach(async () => {
    await Blog.deleteMany({})
    await User.deleteMany({})

    const user = await User.create({
      username: 'bloguser',
      name: 'Blog User',
      passwordHash: 'hash',
    })

    testUserId = user._id.toString()
    token = jwt.sign(
      { username: user.username, id: user._id },
      process.env.SECRET
    )

    const blogs = await Blog.insertMany(
      helper.initialBlogs.map((blog) => ({
        ...blog,
        user: user._id,
      }))
    )

    user.blogs = blogs.map((blog) => blog._id)
    await user.save()
  })

  test('blogs are returned as json and correct amount is returned', async () => {
    const response = await api
      .get('/api/blogs')
      .expect(200)
      .expect('Content-Type', /application\/json/)

    assert.strictEqual(response.body.length, helper.initialBlogs.length)
  })

  test('blog identifier property is named id', async () => {
    const response = await api.get('/api/blogs')

    response.body.forEach((blog) => {
      assert(blog.id)
      assert.strictEqual(blog._id, undefined)
    })
  })

  test('blogs include creator information', async () => {
    const response = await api.get('/api/blogs').expect(200)

    assert.strictEqual(response.body[0].user.username, 'bloguser')
    assert.strictEqual(response.body[0].user.name, 'Blog User')
  })

  test('users include their created blogs', async () => {
    const response = await api.get('/api/users').expect(200)

    assert.strictEqual(response.body[0].blogs.length, helper.initialBlogs.length)
    assert(response.body[0].blogs[0].title)
  })

  test('a valid blog can be added', async () => {
    const newBlog = {
      title: 'Testing Express applications',
      author: 'SuperTest User',
      url: 'https://example.com/testing-express',
      likes: 4,
    }

    const response = await api
      .post('/api/blogs')
      .set('Authorization', `Bearer ${token}`)
      .send(newBlog)
      .expect(201)
      .expect('Content-Type', /application\/json/)

    assert.strictEqual(response.body.user, testUserId)

    const blogsAtEnd = await helper.blogsInDb()

    assert.strictEqual(blogsAtEnd.length, helper.initialBlogs.length + 1)
    assert(blogsAtEnd.map((blog) => blog.title).includes(newBlog.title))
  })

  test('likes defaults to zero if it is missing', async () => {
    const newBlog = {
      title: 'Blog without likes',
      author: 'Test User',
      url: 'https://example.com/no-likes',
    }

    const response = await api
      .post('/api/blogs')
      .set('Authorization', `Bearer ${token}`)
      .send(newBlog)
      .expect(201)

    assert.strictEqual(response.body.likes, 0)
  })

  test('blog without title is rejected with status 400', async () => {
    const newBlog = {
      author: 'Test User',
      url: 'https://example.com/no-title',
      likes: 2,
    }

    await api
      .post('/api/blogs')
      .set('Authorization', `Bearer ${token}`)
      .send(newBlog)
      .expect(400)

    const blogsAtEnd = await helper.blogsInDb()
    assert.strictEqual(blogsAtEnd.length, helper.initialBlogs.length)
  })

  test('blog without url is rejected with status 400', async () => {
    const newBlog = {
      title: 'Blog without url',
      author: 'Test User',
      likes: 2,
    }

    await api
      .post('/api/blogs')
      .set('Authorization', `Bearer ${token}`)
      .send(newBlog)
      .expect(400)

    const blogsAtEnd = await helper.blogsInDb()
    assert.strictEqual(blogsAtEnd.length, helper.initialBlogs.length)
  })

  test('a blog can be deleted by its creator', async () => {
    const blogsAtStart = await helper.blogsInDb()
    const blogToDelete = blogsAtStart[0]

    await api
      .delete(`/api/blogs/${blogToDelete.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204)

    const blogsAtEnd = await helper.blogsInDb()

    assert.strictEqual(blogsAtEnd.length, helper.initialBlogs.length - 1)
    assert(!blogsAtEnd.map((blog) => blog.id).includes(blogToDelete.id))
  })

  test('a blog cannot be deleted without a token', async () => {
    const blogsAtStart = await helper.blogsInDb()
    const blogToDelete = blogsAtStart[0]

    await api
      .delete(`/api/blogs/${blogToDelete.id}`)
      .expect(401)

    const blogsAtEnd = await helper.blogsInDb()
    assert.strictEqual(blogsAtEnd.length, helper.initialBlogs.length)
  })

  test('a blog cannot be deleted by another user', async () => {
    const blogsAtStart = await helper.blogsInDb()
    const blogToDelete = blogsAtStart[0]

    const otherUser = await User.create({
      username: 'otheruser',
      name: 'Other User',
      passwordHash: 'hash',
    })

    const otherToken = jwt.sign(
      { username: otherUser.username, id: otherUser._id },
      process.env.SECRET
    )

    await api
      .delete(`/api/blogs/${blogToDelete.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403)

    const blogsAtEnd = await helper.blogsInDb()
    assert.strictEqual(blogsAtEnd.length, helper.initialBlogs.length)
  })

  test('a blog likes can be updated', async () => {
    const blogsAtStart = await helper.blogsInDb()
    const blogToUpdate = blogsAtStart[0]

    const updatedBlog = {
      title: blogToUpdate.title,
      author: blogToUpdate.author,
      url: blogToUpdate.url,
      likes: 99,
    }

    const response = await api
      .put(`/api/blogs/${blogToUpdate.id}`)
      .send(updatedBlog)
      .expect(200)
      .expect('Content-Type', /application\/json/)

    assert.strictEqual(response.body.likes, 99)

    const blogsAtEnd = await helper.blogsInDb()
    const blogAfterUpdate = blogsAtEnd.find((blog) => blog.id === blogToUpdate.id)

    assert.strictEqual(blogAfterUpdate.likes, 99)
  })
})

after(async () => {
  await mongoose.connection.close()
})
