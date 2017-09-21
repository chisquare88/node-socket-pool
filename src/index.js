import {
  createPool
} from 'generic-pool'

import Socket from './socket'

import {
  delegate
} from './utils'


export class SocketError extends Error {
  constructor (message, err) {
    super(message)
    Object.assign(this, err)
    this.name = 'SocketError'
  }
}

export class TimeoutError extends Error {
  constructor (message) {
    super(message)
    this.name = 'TimeoutError'
  }
}

export default class Pool {
  constructor ({
    // options of generic-pool
    pool,
    connect,
    connectTimeout = 3000,
    ...socket
  }) {

    // allowHalfOpen defaults to true
    socket.allowHalfOpen = socket.allowHalfOpen === false
      ? false
      : true

    this._connectOptions = connect
    this._connectTimeout = connectTimeout

    this._pool = createPool({
      create: () => {
        const s = new Socket(socket)
        s._pool = this
        return s
      },

      destroy: socket => {
        socket._pool = null
        socket.destroy()
        this.emit('factoryDestroy')
      }
    }, pool)
  }

  acquire (priority) {
    return this._pool.acquire(priority)
    .then(socket => {
      return socket.connect(this._connectOptions, this._connectTimeout)
      .then(socket => {
        this.emit('factoryCreate')

        return socket
      })
      .catch(err => {
        this.destroy(socket)

        if (err.name === 'TimeoutError') {
          const error = new TimeoutError(`socket fails to connect to server after ${timeout} milliseconds`)
          return Promise.reject(error)
        }

        const error = new SocketError(err.message, err)
        return Promise.reject(error)
      })
    })
  }
}


delegate(Pool, '_pool', [
  'on',
  'emit',
  'once',
  'drain',
  'destroy',
  'release'
])
