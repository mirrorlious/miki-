import crypto from 'node:crypto'

const MAX_IMAGE_BYTES = 6 * 1024 * 1024
const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function hmacSha1(key, value, encoding = 'hex') {
  return crypto.createHmac('sha1', key).update(value).digest(encoding)
}

function sha1(value) {
  return crypto.createHash('sha1').update(value).digest('hex')
}

function cleanPart(value = '') {
  return String(value)
    .replace(/[\\/]+/g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'image'
}

function extFromName(filename = '', contentType = '') {
  const match = String(filename).toLowerCase().match(/\.([a-z0-9]{2,8})$/)
  if (match?.[1]) return match[1]
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/webp') return 'webp'
  if (contentType === 'image/gif') return 'gif'
  if (contentType === 'image/svg+xml') return 'svg'
  return 'jpg'
}

function encodeObjectKey(key) {
  return `/${String(key).split('/').map((part) => encodeURIComponent(part)).join('/')}`
}

function makeCosAuthorization({ secretId, secretKey, method, pathname, host, start, end }) {
  const keyTime = `${start};${end}`
  const headerList = 'host'
  const httpString = `${method.toLowerCase()}\n${pathname}\n\nhost=${host}\n`
  const signKey = hmacSha1(secretKey, keyTime)
  const stringToSign = `sha1\n${keyTime}\n${sha1(httpString)}\n`
  const signature = hmacSha1(signKey, stringToSign)
  return [
    'q-sign-algorithm=sha1',
    `q-ak=${secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    `q-header-list=${headerList}`,
    'q-url-param-list=',
    `q-signature=${signature}`,
  ].join('&')
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  return {}
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { message: 'Method Not Allowed' })

  const secretId = process.env.TENCENT_COS_SECRET_ID
  const secretKey = process.env.TENCENT_COS_SECRET_KEY
  const bucket = process.env.TENCENT_COS_BUCKET || 'miki-image-1258353277'
  const region = process.env.TENCENT_COS_REGION || 'ap-chongqing'
  const publicBase = (process.env.TENCENT_COS_PUBLIC_BASE || `https://${bucket}.cos.${region}.myqcloud.com`).replace(/\/$/, '')
  const prefix = cleanPart(process.env.TENCENT_COS_UPLOAD_PREFIX || 'miki/user-media')

  if (!secretId || !secretKey) return sendJson(res, 500, { message: 'COS 上传密钥未配置。' })

  const body = parseBody(req)
  const filename = cleanPart(body.filename || 'image')
  const contentType = String(body.contentType || '').toLowerCase()
  const size = Number(body.size) || 0
  const uid = cleanPart(body.uid || 'user')

  if (!req.headers['x-firebase-token']) return sendJson(res, 401, { message: '请先登录账号再上传图片。' })
  if (!IMAGE_TYPES.has(contentType)) return sendJson(res, 400, { message: '只支持 jpg/png/webp/gif/svg 图片。' })
  if (size <= 0 || size > MAX_IMAGE_BYTES) return sendJson(res, 400, { message: '图片不能超过 6MB。' })

  const now = Math.floor(Date.now() / 1000)
  const expires = now + 10 * 60
  const yyyyMm = new Date().toISOString().slice(0, 7)
  const random = crypto.randomBytes(6).toString('hex')
  const ext = extFromName(filename, contentType)
  const baseName = cleanPart(filename.replace(/\.[^.]+$/, ''))
  const objectKey = `${prefix}/${uid}/${yyyyMm}/${Date.now()}-${random}-${baseName}.${ext}`
  const pathname = encodeObjectKey(objectKey)
  const host = `${bucket}.cos.${region}.myqcloud.com`
  const uploadUrl = `https://${host}${pathname}`
  const authorization = makeCosAuthorization({
    secretId,
    secretKey,
    method: 'PUT',
    pathname,
    host,
    start: now,
    end: expires,
  })

  return sendJson(res, 200, {
    uploadUrl,
    publicUrl: `${publicBase}/${objectKey}`,
    contentType,
    headers: {
      Authorization: authorization,
    },
  })
}
