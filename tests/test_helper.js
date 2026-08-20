const Blog = require('../models/blog')
const User = require('../models/user')

const initialBlogs = [
  {
    title: 'HTML is easy',
    author: 'Full Stack Open',
    url: 'https://fullstackopen.com/',
    likes: 5,
  },
  {
    title: 'Browser can execute only JavaScript',
    author: 'Full Stack Open',
    url: 'https://fullstackopen.com/en/part0/fundamentals_of_web_apps',
    likes: 10,
  },
]

const blogsInDb = async () => {
  const blogs = await Blog.find({})
  return blogs.map((blog) => blog.toJSON())
}

const usersInDb = async () => {
  const users = await User.find({})
  return users.map((user) => user.toJSON())
}

module.exports = {
  initialBlogs,
  blogsInDb,
  usersInDb,
}
